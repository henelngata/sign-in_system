import { requireAdmin } from '@/lib/session';
import { getDeniedLog } from '@/lib/register';
import { allowedNetworks, allowsEverything } from '@/lib/network.mjs';
import { localStamp } from '@/lib/time';

export default async function SecurityPage() {
  await requireAdmin();
  const entries = await getDeniedLog();
  const networks = allowedNetworks().entries;

  return (
    <>
      <h1>Network access</h1>
      {allowsEverything() && (
        <div className="flash warning" role="alert">
          <span>
            Open to every network: anyone on the internet can reach the register. Fine for a demo. Before real use,
            set <code>ALLOWED_NETWORKS</code> to the parliament’s IP address(es).
          </span>
        </div>
      )}
      <div className="card">
        <h2>Allowed networks</h2>
        <p className="muted">Set with the <code>ALLOWED_NETWORKS</code> setting (the <code>.env</code> file, or Vercel → Settings → Environment Variables). Restart or redeploy after changing it.</p>
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
