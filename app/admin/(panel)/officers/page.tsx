import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { listOfficers } from '@/lib/register';
import { toggleOfficerAction, unlockOfficerAction } from '../../actions';
import { initials } from '@/lib/format';
import { Plus } from '@/components/icons';

const NOTICES: Record<string, string> = {
  added: 'Officer added.',
  updated: 'Officer updated.',
  pin: 'Officer updated and PIN reset.',
};

export default async function OfficersPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireAdmin();
  const { notice } = await searchParams;
  const officers = await listOfficers();
  const now = new Date();

  return (
    <>
      {notice && NOTICES[notice] && <div className="flash success" role="status">{NOTICES[notice]}</div>}
      <div className="pagehead">
        <h1>Directors &amp; officers</h1>
        <Link className="btn primary" href="/admin/officers/new"><Plus /> Add officer</Link>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Staff no</th><th>Name</th><th>Title</th><th>Department</th><th>Who’s in access</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {officers.length === 0 && <tr><td colSpan={7} className="muted center">No officers yet.</td></tr>}
            {officers.map((o) => {
              const locked = !!o.locked_until && new Date(o.locked_until) > now;
              return (
                <tr key={o.id} className={o.active ? '' : 'inactive'}>
                  <td>{o.staff_no}</td>
                  <td><span className="person-cell"><span className="avatar">{initials(o.full_name)}</span>{o.full_name}</span></td>
                  <td>{o.title}</td>
                  <td>{o.department}</td>
                  <td>{o.can_view_board ? 'Yes' : '—'}</td>
                  <td>
                    {!o.active ? <span className="pill">Inactive</span>
                      : locked ? <span className="pill bad">Locked</span>
                      : <span className="pill ok">Active</span>}
                  </td>
                  <td className="rowactions">
                    <Link href={`/admin/officers/${o.id}`}>Edit / reset PIN</Link>
                    {locked && (
                      <form action={unlockOfficerAction.bind(null, o.id)} className="inline">
                        <button className="link">Unlock</button>
                      </form>
                    )}
                    <form action={toggleOfficerAction.bind(null, o.id)} className="inline">
                      <button className="link">{o.active ? 'Deactivate' : 'Reactivate'}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
