'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { burnTime, verifySecret } from '@/lib/hash.mjs';
import { clearAdminSession, requireAdmin, setAdminSession } from '@/lib/session';
import { getOfficer, readOfficerForm, saveOfficer, toggleOfficer, unlockOfficer } from '@/lib/register';

const MAX_ATTEMPTS = Number(process.env.MAX_PIN_ATTEMPTS || 5);
const LOCKOUT_MS = Number(process.env.LOCKOUT_MINUTES || 15) * 60_000;
const failures = new Map<string, { count: number; until: number }>();

export type FormState = { errors: string[] } | null;

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const f = failures.get(username);
  if (f && f.until > Date.now()) return { errors: ['Too many failed attempts. Try again later.'] };

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username) as
    | { id: number; username: string; password_hash: string }
    | undefined;
  const ok = admin ? verifySecret(password, admin.password_hash) : (burnTime(password), false);
  if (!admin || !ok) {
    const count = (f?.count ?? 0) + 1;
    failures.set(username, count >= MAX_ATTEMPTS ? { count: 0, until: Date.now() + LOCKOUT_MS } : { count, until: 0 });
    return { errors: ['Invalid username or password.'] };
  }
  failures.delete(username);
  await setAdminSession({ id: admin.id, username: admin.username });
  redirect('/admin');
}

export async function logoutAction() {
  await clearAdminSession();
  redirect('/admin/login');
}

export async function saveOfficerAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const idRaw = form.get('id');
  const id = idRaw ? Number(idRaw) : null;
  if (id !== null && !getOfficer(id)) return { errors: ['Officer not found.'] };

  const { data, errors } = readOfficerForm(form, id === null);
  if (errors.length) return { errors };
  const saveErrors = saveOfficer(id, data);
  if (saveErrors.length) return { errors: saveErrors };

  revalidatePath('/admin', 'layout');
  redirect(`/admin/officers?notice=${id === null ? 'added' : data.pin ? 'pin' : 'updated'}`);
}

export async function toggleOfficerAction(id: number) {
  await requireAdmin();
  toggleOfficer(id);
  revalidatePath('/admin', 'layout');
}

export async function unlockOfficerAction(id: number) {
  await requireAdmin();
  unlockOfficer(id);
  revalidatePath('/admin', 'layout');
}
