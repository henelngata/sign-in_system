import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/session';
import LoginForm from '@/components/LoginForm';

export default async function LoginPage() {
  if (await getAdmin()) redirect('/admin');
  return (
    <main>
      <section className="card narrow">
        <h1>Administrator login</h1>
        <LoginForm />
      </section>
    </main>
  );
}
