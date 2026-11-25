// Entry point. Next.js can't see the real connection IP on its own (it only fills in
// X-Forwarded-For when the client hasn't sent one, which can be faked), so this small server
// runs first: it reads the IP from the TCP socket, blocks outsiders, and passes the verified
// IP to Next.js in a header that clients can't set themselves.
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import nextEnv from '@next/env';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
nextEnv.loadEnvConfig(process.cwd(), dev);

const { allowedNetworks, allowsEverything, isAllowed, resolveClientIp } = await import('./lib/network.mjs');
const { openDb } = await import('./lib/schema.mjs');

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
const orgName = process.env.ORG_NAME || 'Parliament';
const networks = allowedNetworks(); // throws on bad config: better to fail at startup

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[config] SESSION_SECRET not set: using a random one. Admin logins reset on restart.');
}
// Per-process secret proving to proxy.ts that a request passed through this server.
const guardToken = crypto.randomBytes(32).toString('hex');
process.env.REGISTER_GUARD_TOKEN = guardToken;

const db = await openDb(); // also creates/updates the schema before the first request
const { deniedPage } = await import('./lib/denied.mjs');

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();
await app.prepare();

createServer((req, res) => {
  const ip = resolveClientIp(req.socket.remoteAddress, req.headers['x-forwarded-for'], hops);

  // Never trust these from the client.
  delete req.headers['x-client-ip'];
  delete req.headers['x-register-guard'];
  if (!hops) {
    delete req.headers['x-forwarded-host'];
    delete req.headers['x-forwarded-proto'];
    delete req.headers['x-forwarded-port'];
  }

  if (!isAllowed(ip)) {
    db.execute({
      sql: 'INSERT INTO access_denied (at, ip, method, path) VALUES (?, ?, ?, ?)',
      args: [new Date().toISOString(), ip || 'unknown', req.method || '?', String(req.url).slice(0, 300)],
    }).catch(() => { /* a logging failure must never let the request through */ });
    console.warn(`[ip-guard] denied ${ip || 'unknown'} ${req.method} ${req.url}`);
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(deniedPage(ip, orgName));
    return;
  }

  req.headers['x-client-ip'] = ip;
  req.headers['x-forwarded-for'] = ip;
  req.headers['x-register-guard'] = guardToken;
  handle(req, res);
}).listen(port, host, () => {
  console.log(`Daily register (${dev ? 'development' : 'production'}) on http://${host}:${port}`);
  console.log(`Allowed networks: ${networks.entries.join(', ')}`);
  if (allowsEverything()) console.warn('[config] ALLOWED_NETWORKS allows every address: demo mode, no network restriction.');
  console.log(`Timezone: ${process.env.TIMEZONE || 'Africa/Nairobi'}; trusted proxy hops: ${hops}`);
});
