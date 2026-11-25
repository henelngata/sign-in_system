/** East Africa Time (UTC+3) unless TIMEZONE says otherwise. */
export const timezone = process.env.TIMEZONE || 'Africa/Nairobi';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
});
const stampFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: timezone, dateStyle: 'medium', timeStyle: 'medium',
});
const longDateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: 'numeric', hour12: false });

/** "Good morning" / "Good afternoon" / "Good evening" in the configured timezone. */
export function greeting(d = new Date()) {
  const h = Number(hourFmt.format(d));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Today's calendar date (YYYY-MM-DD) in the configured timezone. */
export const localDay = (d = new Date()) => dayFmt.format(d);
export const localTime = (iso?: string | null) => (iso ? timeFmt.format(new Date(iso)) : '');
export const localStamp = (iso?: string | null) => (iso ? stampFmt.format(new Date(iso)) : '');
export const longDate = (day: string) => longDateFmt.format(new Date(`${day}T12:00:00Z`));
export const nowIso = () => new Date().toISOString();
export const isDay = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
