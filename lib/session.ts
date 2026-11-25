import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, type Officer } from './db';
import { safeEqual } from './hash.mjs';

/**
 * Two kinds of login, each in its own signed cookie:
 *  - admin:  clerks who manage officers and the register
 *  - viewer: directors (officers with can_view_board) who may see who is signed in.
 *            Short-lived, because directors may log in on a shared tablet.
 *  - kiosk:  an officer who just entered their PIN on the sign-in screen and is looking at
 *            their status. Lasts 2 minutes at most and ends as soon as they sign in or out.
 */
const KINDS = {
  admin: { cookie: 'reg_admin', maxAgeS: 8 * 60 * 60 },
  viewer: { cookie: 'reg_viewer', maxAgeS: 60 * 60 },
  kiosk: { cookie: 'reg_kiosk', maxAgeS: 2 * 60 },
} as const;
type Kind = keyof typeof KINDS;

export type Admin = { id: number; username: string };
export type Viewer = { id: number; full_name: string; title: string };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET missing: start the app with "npm start" (server.mjs).');
  return s;
}

// The kind is part of the signature, so an officer's viewer cookie can never pass as an admin cookie.
const sign = (kind: Kind, data: string) =>
  crypto.createHmac('sha256', secret()).update(`${kind}.${data}`).digest('base64url');

async function setSession(kind: Kind, id: number) {
  const { cookie, maxAgeS } = KINDS[kind];
  const payload = Buffer.from(JSON.stringify({ id, exp: Date.now() + maxAgeS * 1000 })).toString('base64url');
  (await cookies()).set(cookie, `${payload}.${sign(kind, payload)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.SECURE_COOKIES === 'true',
    path: '/',
    maxAge: maxAgeS,
  });
}

async function sessionId(kind: Kind): Promise<number | null> {
  const raw = (await cookies()).get(KINDS[kind].cookie)?.value;
  if (!raw) return null;
  const [payload, mac] = raw.split('.');
  if (!payload || !mac || !safeEqual(mac, sign(kind, payload))) return null;
  try {
    const { id, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof id === 'number' && typeof exp === 'number' && exp > Date.now() ? id : null;
  } catch {
    return null;
  }
}

export const setAdminSession = (admin: Admin) => setSession('admin', admin.id);
export const setViewerSession = (officerId: number) => setSession('viewer', officerId);
export const setKioskSession = (officerId: number) => setSession('kiosk', officerId);
export const clearAdminSession = async () => (await cookies()).delete(KINDS.admin.cookie);
export const clearViewerSession = async () => (await cookies()).delete(KINDS.viewer.cookie);
export const clearKioskSession = async () => (await cookies()).delete(KINDS.kiosk.cookie);

const kioskOfficerById = db.prepare('SELECT * FROM officers WHERE id = ? AND active = 1');

/** The officer currently identified on the sign-in screen, or null. */
export async function getKioskOfficer(): Promise<Officer | null> {
  const id = await sessionId('kiosk');
  return id === null ? null : ((kioskOfficerById.get(id) as Officer | undefined) ?? null);
}

const adminById = db.prepare('SELECT id, username FROM admins WHERE id = ?');
const viewerById = db.prepare(
  'SELECT id, full_name, title FROM officers WHERE id = ? AND active = 1 AND can_view_board = 1',
);

/** The logged-in admin, or null. Re-checks the database so removed admins lose access at once. */
export async function getAdmin(): Promise<Admin | null> {
  const id = await sessionId('admin');
  return id === null ? null : ((adminById.get(id) as Admin | undefined) ?? null);
}

/** The logged-in director, or null. Loses access as soon as the admin removes permission. */
export async function getViewer(): Promise<Viewer | null> {
  const id = await sessionId('viewer');
  return id === null ? null : ((viewerById.get(id) as Viewer | undefined) ?? null);
}

/** Use at the top of every admin page and every admin Server Function. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}

/** The "who's in" list: open to directors with permission, and to admins. */
export async function requireBoardAccess(): Promise<{ admin: Admin | null; viewer: Viewer | null }> {
  const [admin, viewer] = await Promise.all([getAdmin(), getViewer()]);
  if (!admin && !viewer) redirect('/whos-in/login');
  return { admin, viewer };
}

/** Client IP verified by server.mjs. */
export async function clientIp() {
  return (await headers()).get('x-client-ip') ?? 'unknown';
}
