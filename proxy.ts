// Second line of defence. server.mjs already blocks outside addresses; this rejects any
// request that did not come through server.mjs (e.g. someone ran `next start` directly,
// where X-Forwarded-For could be faked). It fails closed: no token, no access.
import { NextResponse, type NextRequest } from 'next/server';
import { isAllowed } from './lib/network.mjs';
import { safeEqual } from './lib/hash.mjs';

export function proxy(request: NextRequest) {
  const token = process.env.REGISTER_GUARD_TOKEN;
  const ip = request.headers.get('x-client-ip') ?? '';
  if (!token || !safeEqual(request.headers.get('x-register-guard'), token) || !isAllowed(ip)) {
    return new NextResponse('Access restricted: start the app with "npm start" (server.mjs).', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return NextResponse.next();
}
// No matcher: runs on every request, including static files and Server Function calls.
