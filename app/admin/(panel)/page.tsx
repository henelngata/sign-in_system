import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { getRegister } from '@/lib/register';
import { isDay, localDay, localTime, longDate, shiftDay } from '@/lib/time';
import { initials } from '@/lib/format';
import { Download } from '@/components/icons';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdmin();
  const { date } = await searchParams;
  const today = localDay();
  const day = isDay(date) && date <= today ? date : today;
  const rows = await getRegister(day);
  const present = rows.filter((r) => r.sign_in_at && !r.sign_out_at).length;
  const left = rows.filter((r) => r.sign_out_at).length;
  const absent = rows.filter((r) => !r.sign_in_at).length;
  const next = day < today ? shiftDay(day, 1) : null;

  return (
    <>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Daily register</p>
          <h1>{longDate(day)}</h1>
          {day === today && <p className="muted">Today. Refresh to see new sign-ins.</p>}
        </div>
        <div className="daynav">
          <Link className="btn secondary" href={`/admin?date=${shiftDay(day, -1)}`}>← Previous</Link>
          <form method="get" action="/admin" className="inline">
            <input type="date" name="date" defaultValue={day} max={today} />
            <button className="btn secondary">Go</button>
          </form>
          {next && <Link className="btn secondary" href={`/admin?date=${next}`}>Next →</Link>}
          {day !== today && <Link className="btn secondary" href="/admin">Today</Link>}
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span>{rows.length}</span>Officers</div>
        <div className="stat ok"><span>{present}</span>In the building</div>
        <div className="stat"><span>{left}</span>Signed out</div>
        <div className="stat bad"><span>{absent}</span>Not signed in</div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Staff no</th><th>Name</th><th>Title</th><th>Department</th><th>Time in</th><th>Time out</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="muted center">
                No officers registered yet. <Link href="/admin/officers/new">Add one</Link>.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.staff_no}</td>
                <td><span className="person-cell"><span className="avatar">{initials(r.full_name)}</span>{r.full_name}</span></td>
                <td>{r.title}</td>
                <td>{r.department}</td>
                <td title={r.sign_in_ip ?? ''}>{localTime(r.sign_in_at) || '—'}</td>
                <td title={r.sign_out_ip ?? ''}>{localTime(r.sign_out_at) || '—'}</td>
                <td>
                  {r.sign_out_at ? <span className="pill">Signed out</span>
                    : r.sign_in_at ? <span className="pill ok">Present</span>
                    : <span className="pill bad">Absent</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Export to spreadsheet (CSV)</h2>
        <form method="get" action="/admin/export" className="row">
          <label>From <input type="date" name="from" defaultValue={day} max={today} required /></label>
          <label>To <input type="date" name="to" defaultValue={day} max={today} required /></label>
          <button className="btn primary"><Download /> Download CSV</button>
        </form>
      </div>
    </>
  );
}
