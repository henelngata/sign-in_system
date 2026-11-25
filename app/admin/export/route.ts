import { getAdmin } from '@/lib/session';
import { getExportRows } from '@/lib/register';
import { isDay, localDay, localTime } from '@/lib/time';

function csvCell(v: unknown) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  if (!(await getAdmin())) return new Response('Not logged in', { status: 401 });
  const url = new URL(request.url);
  const today = localDay();
  const from = isDay(url.searchParams.get('from')) ? url.searchParams.get('from')! : today;
  const to = isDay(url.searchParams.get('to')) ? url.searchParams.get('to')! : from;

  const lines = [['Date', 'Staff No', 'Name', 'Title', 'Department', 'Time In', 'IP In', 'Time Out', 'IP Out'].join(',')];
  for (const r of await getExportRows(from, to)) {
    lines.push([r.day, r.staff_no, r.full_name, r.title, r.department,
      localTime(r.sign_in_at), r.sign_in_ip, localTime(r.sign_out_at), r.sign_out_ip].map(csvCell).join(','));
  }
  return new Response(`﻿${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="register_${from}_to_${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
