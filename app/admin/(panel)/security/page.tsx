import { requireAdmin } from '@/lib/session';
import { getDeniedLog } from '@/lib/register';
import { allowedNetworks } from '@/lib/network.mjs';
import { localStamp } from '@/lib/time';

export default async function SecurityPage() {
  await requireAdmin();
  const entries = getDeniedLog();
  const networks = allowedNetworks().entries;

  return (
    <>
      <h1>Network access</h1>
      <div className="card">
        <h2>Allowed networks</h2>
        <p className="muted">Set in <code>ALLOWED_NETWORKS</code> in the <code>.env</code> file. Restart the app after changing it.</p>
        <ul className="nets">{networks.map((n) => <li key={n}><code>{n}</code></li>)}</ul>
      </div>
      <div className="card">
        <h2>Blocked attempts (latest 200)</h2>
        <table>
          <thead><tr><th>When</th><th>IP address</th><th>Request</th></tr></thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={3} className="muted center">No blocked attempts recorded.</td></tr>}
            {entries.map((e) => (
              <tr key={e.id}><td>{localStamp(e.at)}</td><td><code>{e.ip}</code></td><td>{e.method} {e.path}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
