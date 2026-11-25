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

const { allowedNetworks, isAllowed, resolveClientIp } = await import('./lib/network.mjs');
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

const db = openDb();
const logDenied = db.prepare('INSERT INTO access_denied (at, ip, method, path) VALUES (?, ?, ?, ?)');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const deniedPage = (ip) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Access restricted</title><style>
body{font-family:system-ui,sans-serif;background:#f4f1ea;color:#1d2433;display:grid;place-items:center;min-height:100vh;margin:0}
.box{max-width:30rem;padding:2rem;background:#fff;border-radius:12px;border-top:6px solid #a3281f;box-shadow:0 8px 30px rgba(0,0,0,.08)}
h1{margin-top:0;font-size:1.4rem}code{background:#f4f1ea;padding:.1rem .4rem;border-radius:4px}p{line-height:1.5}
</style></head><body><div class="box"><h1>Access restricted</h1>
<p>The ${escapeHtml(orgName)} Daily Register can only be used from inside the ${escapeHtml(orgName)} network.</p>
<p>Your address <code>${escapeHtml(ip || 'unknown')}</code> is not on the workplace network. This attempt has been logged.</p>
<p>If you are on the premises and seeing this, contact ICT support.</p></div></body></html>`;

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
    try {
      logDenied.run(new Date().toISOString(), ip || 'unknown', req.method || '?', String(req.url).slice(0, 300));
    } catch {
      // A logging failure must never let the request through.
    }
    console.warn(`[ip-guard] denied ${ip || 'unknown'} ${req.method} ${req.url}`);
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(deniedPage(ip));
    return;
  }

  req.headers['x-client-ip'] = ip;
  req.headers['x-forwarded-for'] = ip;
  req.headers['x-register-guard'] = guardToken;
  handle(req, res);
}).listen(port, host, () => {
  console.log(`Daily register (${dev ? 'development' : 'production'}) on http://${host}:${port}`);
  console.log(`Allowed networks: ${networks.entries.join(', ')}`);
  console.log(`Timezone: ${process.env.TIMEZONE || 'Africa/Nairobi'}; trusted proxy hops: ${hops}`);
});
