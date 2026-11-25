import { db, type Attendance, type Officer } from './db';
import { burnTime, hashSecret, verifySecret } from './hash.mjs';
import { localDay, localTime, nowIso } from './time';

const MAX_PIN_ATTEMPTS = Number(process.env.MAX_PIN_ATTEMPTS || 5);
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES || 15);

export type Message = { type: 'success' | 'error' | 'warning'; text: string };

const q = {
  officerByStaffNo: db.prepare('SELECT * FROM officers WHERE staff_no = ?'),
  officerById: db.prepare('SELECT * FROM officers WHERE id = ?'),
  recordFor: db.prepare('SELECT * FROM attendance WHERE officer_id = ? AND day = ?'),
  // ON CONFLICT: if two taps / two devices race, the second insert does nothing instead of erroring.
  signIn: db.prepare(`INSERT INTO attendance (officer_id, day, sign_in_at, sign_in_ip) VALUES (?, ?, ?, ?)
                      ON CONFLICT (officer_id, day) DO NOTHING`),
  signOut: db.prepare('UPDATE attendance SET sign_out_at = ?, sign_out_ip = ? WHERE id = ? AND sign_out_at IS NULL'),
  failAttempt: db.prepare('UPDATE officers SET failed_attempts = failed_attempts + 1 WHERE id = ?'),
  lock: db.prepare('UPDATE officers SET failed_attempts = 0, locked_until = ? WHERE id = ?'),
  resetAttempts: db.prepare('UPDATE officers SET failed_attempts = 0, locked_until = NULL WHERE id = ?'),
};

export const normaliseStaffNo = (s: unknown) => String(s ?? '').trim().toUpperCase();

/**
 * Check a staff number + PIN, applying the lockout rules.
 * Shared by the sign-in screen and the directors' "who's in" login, so both count towards the same lockout.
 */
export function authenticateOfficer(staffNoRaw: unknown, pinRaw: unknown): { officer: Officer } | { error: Message } {
  const staffNo = normaliseStaffNo(staffNoRaw);
  const pin = String(pinRaw ?? '');
  if (!staffNo || !pin) return { error: { type: 'error', text: 'Enter your staff number and PIN.' } };

  const officer = q.officerByStaffNo.get(staffNo) as Officer | undefined;
  if (!officer || !officer.active) {
    burnTime(pin);
    return { error: { type: 'error', text: 'Invalid staff number or PIN.' } };
  }
  if (officer.locked_until && new Date(officer.locked_until) > new Date()) {
    return { error: { type: 'error', text: `Too many wrong PINs. Try again after ${localTime(officer.locked_until)} or contact the administrator.` } };
  }
  if (!verifySecret(pin, officer.pin_hash)) {
    if (officer.failed_attempts + 1 >= MAX_PIN_ATTEMPTS) {
      q.lock.run(new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString(), officer.id);
      return { error: { type: 'error', text: `Too many wrong PINs. Locked for ${LOCKOUT_MINUTES} minutes.` } };
    }
    q.failAttempt.run(officer.id);
    return { error: { type: 'error', text: 'Invalid staff number or PIN.' } };
  }
  q.resetAttempts.run(officer.id);
  return { officer };
}

/** Today's attendance entry for an officer, if any. */
export const todayRecord = (officerId: number) =>
  q.recordFor.get(officerId, localDay()) as Attendance | undefined;

export type DayStatus = 'none' | 'in' | 'done';
export const statusOf = (r: Attendance | undefined): DayStatus => (!r ? 'none' : r.sign_out_at ? 'done' : 'in');

/**
 * One sign-in and one sign-out per officer per day. Once signed in, signing in again is refused,
 * including after signing out. The day's entry is then complete and can't be redone.
 * The officer must already be authenticated (see authenticateOfficer).
 */
export function signInOut(officer: Officer, action: unknown, ip: string): Message {
  if (action !== 'in' && action !== 'out') {
    return { type: 'error', text: 'Choose Sign In or Sign Out.' };
  }

  const day = localDay();
  const now = nowIso();
  const who = `${officer.title} ${officer.full_name}`.trim();
  const current = () => q.recordFor.get(officer.id, day) as Attendance | undefined;
  const complete = (r: Attendance): Message => ({
    type: 'warning',
    text: `${who}, today's register is already complete: signed in at ${localTime(r.sign_in_at)} and out at ${localTime(r.sign_out_at)}. You cannot sign in again today.`,
  });

  if (action === 'in') {
    const result = q.signIn.run(officer.id, day, now, ip);
    if (result.changes === 0) {
      const r = current()!;
      if (r.sign_out_at) return complete(r);
      return { type: 'warning', text: `${who}, you are already signed in (since ${localTime(r.sign_in_at)}). You cannot sign in twice.` };
    }
    return { type: 'success', text: `Welcome, ${who}. Signed in at ${localTime(now)}.` };
  }

  const record = current();
  if (!record) return { type: 'warning', text: `${who}, you have not signed in today. Sign in first.` };
  if (record.sign_out_at) return complete(record);
  const result = q.signOut.run(now, ip, record.id);
  if (result.changes === 0) return complete(current()!); // signed out on another device a moment ago
  return { type: 'success', text: `Goodbye, ${who}. Signed out at ${localTime(now)}.` };
}

// ---------------------------------------------------------------- Register views

export type RegisterRow = Pick<Officer, 'id' | 'staff_no' | 'full_name' | 'title' | 'department'> &
  Pick<Attendance, 'sign_in_at' | 'sign_out_at' | 'sign_in_ip' | 'sign_out_ip'>;

const registerFor = db.prepare(`
  SELECT o.id, o.staff_no, o.full_name, o.title, o.department,
         a.sign_in_at, a.sign_out_at, a.sign_in_ip, a.sign_out_ip
  FROM officers o
  LEFT JOIN attendance a ON a.officer_id = o.id AND a.day = ?
  WHERE o.active = 1 OR a.id IS NOT NULL
  ORDER BY CASE WHEN o.title LIKE '%Director%' THEN 0 ELSE 1 END, o.full_name
`);
export const getRegister = (day: string) => registerFor.all(day) as RegisterRow[];

const exportQuery = db.prepare(`
  SELECT a.day, o.staff_no, o.full_name, o.title, o.department,
         a.sign_in_at, a.sign_in_ip, a.sign_out_at, a.sign_out_ip
  FROM attendance a JOIN officers o ON o.id = a.officer_id
  WHERE a.day BETWEEN ? AND ?
  ORDER BY a.day, o.full_name
`);
export const getExportRows = (from: string, to: string) =>
  exportQuery.all(from, to) as (RegisterRow & { day: string })[];

// ---------------------------------------------------------------- Officers

const listQuery = db.prepare(`
  SELECT * FROM officers
  ORDER BY active DESC, CASE WHEN title LIKE '%Director%' THEN 0 ELSE 1 END, full_name
`);
export const listOfficers = () => listQuery.all() as Officer[];
export const getOfficer = (id: number) => q.officerById.get(id) as Officer | undefined;

export type OfficerInput = {
  staff_no: string; full_name: string; title: string; department: string; pin: string; can_view_board: boolean;
};

export function readOfficerForm(form: FormData, pinRequired: boolean) {
  const data: OfficerInput = {
    staff_no: normaliseStaffNo(form.get('staff_no')),
    full_name: String(form.get('full_name') ?? '').trim(),
    title: String(form.get('title') ?? '').trim() || 'Officer',
    department: String(form.get('department') ?? '').trim(),
    pin: String(form.get('pin') ?? '').trim(),
    can_view_board: form.get('can_view_board') === 'on',
  };
  const errors: string[] = [];
  if (!/^[A-Z0-9\-/]{1,30}$/.test(data.staff_no)) errors.push('Staff number: letters, digits, "-" or "/" only (max 30).');
  if (!data.full_name || data.full_name.length > 100) errors.push('Full name is required (max 100 characters).');
  if (data.title.length > 60 || data.department.length > 100) errors.push('Title or department is too long.');
  if ((data.pin || pinRequired) && !/^\d{4,8}$/.test(data.pin)) errors.push('PIN must be 4 to 8 digits.');
  return { data, errors };
}

export function saveOfficer(id: number | null, data: OfficerInput): string[] {
  const clash = q.officerByStaffNo.get(data.staff_no) as Officer | undefined;
  if (clash && clash.id !== id) return ['That staff number is already registered to someone else.'];
  if (id === null) {
    db.prepare(`INSERT INTO officers (staff_no, full_name, title, department, can_view_board, pin_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(data.staff_no, data.full_name, data.title, data.department, data.can_view_board ? 1 : 0, hashSecret(data.pin), nowIso());
  } else {
    db.prepare('UPDATE officers SET staff_no = ?, full_name = ?, title = ?, department = ?, can_view_board = ? WHERE id = ?')
      .run(data.staff_no, data.full_name, data.title, data.department, data.can_view_board ? 1 : 0, id);
    if (data.pin) {
      db.prepare('UPDATE officers SET pin_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?')
        .run(hashSecret(data.pin), id);
    }
  }
  return [];
}

export const toggleOfficer = (id: number) => db.prepare('UPDATE officers SET active = 1 - active WHERE id = ?').run(id);
export const unlockOfficer = (id: number) => q.resetAttempts.run(id);

// ---------------------------------------------------------------- Security log

export type DeniedEntry = { id: number; at: string; ip: string; method: string; path: string };
export const getDeniedLog = () =>
  db.prepare('SELECT * FROM access_denied ORDER BY id DESC LIMIT 200').all() as DeniedEntry[];
