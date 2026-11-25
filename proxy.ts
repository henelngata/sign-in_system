// Network guard inside Next.js. Runs on every request (no matcher), including static files
// and Server Function calls.
//
// Two ways the app can run:
//  - Own server (`npm start` → server.mjs): server.mjs reads the IP from the TCP socket and has
//    already blocked outsiders. Here we only check its per-process token, so running plain
//    `next start` (where X-Forwarded-For could be faked) fails closed.
//  - Vercel (VERCEL=1): there is no server.mjs. Vercel's edge sets X-Real-IP / X-Forwarded-For
//    itself and overwrites anything the client sends, so the IP check happens here.
import { NextResponse, type NextRequest } from 'next/server';
import { isAllowed, normaliseIp } from './lib/network.mjs';
import { safeEqual } from './lib/hash.mjs';
import { deniedPage } from './lib/denied.mjs';
import { logDenied } from './lib/register';

const onVercel = process.env.VERCEL === '1';
const orgName = process.env.ORG_NAME || 'Parliament';

function deny(ip: string) {
  return new NextResponse(deniedPage(ip, orgName), {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** The visitor's IP as reported by Vercel's edge (which overwrites any client-sent value). */
function vercelClientIp(request: NextRequest) {
  const real = request.headers.get('x-real-ip');
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
  return normaliseIp((real ?? forwarded ?? '').trim());
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname + request.nextUrl.search;

  if (onVercel) {
    const ip = vercelClientIp(request);
    if (!isAllowed(ip)) {
      await logDenied(ip, request.method, path);
      return deny(ip);
    }
    // Hand the verified IP to the app (overwriting anything the client sent).
    const headers = new Headers(request.headers);
    headers.set('x-client-ip', ip);
    return NextResponse.next({ request: { headers } });
  }

  const token = process.env.REGISTER_GUARD_TOKEN;
  const ip = request.headers.get('x-client-ip') ?? '';
  if (!token || !safeEqual(request.headers.get('x-register-guard'), token)) {
    return new NextResponse(
      'Access restricted: start the app with "npm start" (server.mjs). On Vercel this check is automatic.',
      { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
  if (!isAllowed(ip)) return deny(ip);
  return NextResponse.next();
}
