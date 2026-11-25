import { requireBoardAccess } from '@/lib/session';
import { getRegister } from '@/lib/register';
import { localDay, localTime, longDate, nowIso } from '@/lib/time';
import { initials } from '@/lib/format';
import AutoRefresh from '@/components/AutoRefresh';
import { viewerLogoutAction } from './actions';

export const metadata = { title: 'Who’s in' };

export default async function WhosInPage() {
  const { viewer } = await requireBoardAccess();
  const today = localDay();
  const rows = await getRegister(today);
  const inBuilding = rows.filter((r) => r.sign_in_at && !r.sign_out_at)
    .sort((a, b) => a.sign_in_at!.localeCompare(b.sign_in_at!));
  const left = rows.filter((r) => r.sign_out_at);
  const notIn = rows.filter((r) => !r.sign_in_at);

  return (
    <main className="wide">
      <AutoRefresh seconds={30} />
      <div className="board-head">
        <div>
          <p className="eyebrow">{longDate(today)}</p>
          <h1>Who’s signed in</h1>
          <p className="muted small"><span className="live">Live</span> · updated {localTime(nowIso())}, refreshes every 30 seconds</p>
        </div>
        {viewer && (
          <div className="who">
            <span className="person-cell"><span className="avatar">{initials(viewer.full_name)}</span>{viewer.full_name}</span>
            <form action={viewerLogoutAction}>
              <button className="btn secondary">Log out</button>
            </form>
          </div>
        )}
      </div>

      <div className="stats">
        <div className="stat ok"><span className="big-num">{inBuilding.length}</span>Signed in now</div>
        <div className="stat"><span className="big-num">{left.length}</span>Signed out</div>
        <div className="stat bad"><span className="big-num">{notIn.length}</span>Not signed in</div>
      </div>

      <div className="card">
        <h2>Signed in now ({inBuilding.length})</h2>
        <table>
          <thead><tr><th>Name</th><th>Title</th><th>Department</th><th>Since</th></tr></thead>
          <tbody>
            {inBuilding.length === 0 && <tr><td colSpan={4} className="muted center">Nobody is signed in yet.</td></tr>}
            {inBuilding.map((r) => (
              <tr key={r.id}>
                <td><span className="person-cell"><span className="avatar">{initials(r.full_name)}</span>{r.full_name}</span></td>
                <td>{r.title}</td>
                <td>{r.department}</td>
                <td><span className="pill ok">{localTime(r.sign_in_at)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Signed out today ({left.length})</h2>
        <table>
          <thead><tr><th>Name</th><th>Title</th><th>Department</th><th>In</th><th>Out</th></tr></thead>
          <tbody>
            {left.length === 0 && <tr><td colSpan={5} className="muted center">Nobody has signed out yet.</td></tr>}
            {left.map((r) => (
              <tr key={r.id}>
                <td><span className="person-cell"><span className="avatar">{initials(r.full_name)}</span>{r.full_name}</span></td>
                <td>{r.title}</td>
                <td>{r.department}</td>
                <td>{localTime(r.sign_in_at)}</td>
                <td>{localTime(r.sign_out_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Not signed in today ({notIn.length})</h2>
        {notIn.length === 0 ? <p className="muted">Everyone has signed in.</p> : (
          <ul className="names">
            {notIn.map((r) => (
              <li key={r.id}><span className="avatar">{initials(r.full_name)}</span>{r.full_name} <small>· {r.title}</small></li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
