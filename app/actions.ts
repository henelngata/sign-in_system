'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { clearKioskSession, clientIp, getKioskOfficer, setKioskSession } from '@/lib/session';
import { authenticateOfficer, signInOut } from '@/lib/register';
import { localTime, nowIso } from '@/lib/time';

export type IdentifyState = { error: string } | null;

/** Step 1: staff number + PIN. On success the page re-renders showing that officer's status. */
export async function identifyAction(_prev: IdentifyState, form: FormData): Promise<IdentifyState> {
  const auth = authenticateOfficer(form.get('staff_no'), form.get('pin'));
  if ('error' in auth) return { error: auth.error.text };
  await setKioskSession(auth.officer.id);
  revalidatePath('/');
  return null;
}

export type SignResult = {
  id: string;
  type: 'success' | 'warning' | 'error';
  action: 'in' | 'out' | null;
  text: string;
  time: string;
  firstName: string;
} | null;

/** Step 2: sign the identified officer in or out. Always ends the kiosk session afterwards. */
export async function signAction(_prev: SignResult, form: FormData): Promise<SignResult> {
  const id = randomUUID();
  const officer = await getKioskOfficer();
  if (!officer) {
    return { id, type: 'error', action: null, time: '', firstName: '', text: 'Your session timed out. Please enter your staff number and PIN again.' };
  }
  const action = form.get('action');
  const msg = signInOut(officer, action, await clientIp());
  await clearKioskSession();
  revalidatePath('/');
  return {
    id,
    type: msg.type,
    action: action === 'in' || action === 'out' ? action : null,
    text: msg.text,
    time: localTime(nowIso()),
    firstName: officer.full_name.split(/\s+/)[0],
  };
}

/** "Not you?" / "Done" / idle timeout: forget the identified officer. */
export async function endKioskAction() {
  await clearKioskSession();
  revalidatePath('/');
}
