import { redirect } from 'next/navigation';
import { getAdmin, getViewer } from '@/lib/session';
import ViewerLoginForm from '@/components/ViewerLoginForm';

export default async function ViewerLoginPage() {
  if ((await getViewer()) || (await getAdmin())) redirect('/whos-in');
  return (
    <main>
      <section className="card narrow">
        <h1>Who’s in: directors</h1>
        <p className="muted">Log in with your staff number and PIN to see who is signed in today.</p>
        <ViewerLoginForm />
      </section>
    </main>
  );
}
