// Shared by server.mjs (plain Node) and the Next.js app, so it is plain JavaScript.
import { BlockList, isIP } from 'node:net';

/**
 * Parse "10.20.0.0/16, 192.168.5.10, 2001:db8::/48" into a BlockList.
 * @param {string} spec
 * @returns {{ list: BlockList, entries: string[] }}
 */
export function parseNetworks(spec) {
  const list = new BlockList();
  const entries = String(spec).split(',').map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) {
    throw new Error('ALLOWED_NETWORKS is empty: refusing to start with no permitted networks.');
  }
  for (const entry of entries) {
    const [addr, bits] = entry.split('/');
    const family = isIP(addr);
    if (!family) throw new Error(`ALLOWED_NETWORKS: "${entry}" is not a valid IP or CIDR.`);
    const type = family === 4 ? 'ipv4' : 'ipv6';
    if (bits === undefined) {
      list.addAddress(addr, type);
    } else {
      const max = family === 4 ? 32 : 128;
      if (!/^\d+$/.test(bits) || Number(bits) > max) {
        throw new Error(`ALLOWED_NETWORKS: "${entry}" has an invalid prefix length.`);
      }
      list.addSubnet(addr, Number(bits), type);
    }
  }
  return { list, entries };
}

/** @type {{ list: BlockList, entries: string[] } | undefined} */
let cached;
export function allowedNetworks() {
  cached ??= parseNetworks(process.env.ALLOWED_NETWORKS || '127.0.0.1,::1');
  return cached;
}

/** True when the list opens the register to every address (e.g. "0.0.0.0/0" for a demo). */
export function allowsEverything() {
  return allowedNetworks().entries.some((e) => /^(0\.0\.0\.0\/0|::\/0)$/.test(e));
}

/**
 * "::ffff:10.0.0.5" -> "10.0.0.5" so IPv4 rules still match on dual-stack sockets.
 * @param {string | undefined | null} raw
 */
export function normaliseIp(raw) {
  if (!raw) return '';
  return raw.startsWith('::ffff:') && isIP(raw.slice(7)) === 4 ? raw.slice(7) : raw;
}

/** @param {string} ip */
export function isAllowed(ip) {
  const family = isIP(ip);
  if (!family) return false;
  return allowedNetworks().list.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Work out the real client address.
 * hops = 0: clients connect directly, so the socket address is the client (headers ignored).
 * hops = n: n trusted proxies sit in front; each appends to X-Forwarded-For, so the client
 * is the entry just before the last n hops. Anything further left is client-supplied.
 * @param {string | undefined} socketAddr
 * @param {string | string[] | undefined} xff
 * @param {number} hops
 */
export function resolveClientIp(socketAddr, xff, hops) {
  const socketIp = normaliseIp(socketAddr);
  if (!hops) return socketIp;
  const header = Array.isArray(xff) ? xff.join(',') : xff || '';
  const chain = header.split(',').map((s) => normaliseIp(s.trim())).filter(Boolean);
  chain.push(socketIp);
  const idx = chain.length - 1 - hops;
  return chain[Math.max(idx, 0)];
}
