import { requireAdmin } from '@/lib/session';
import OfficerForm from '@/components/OfficerForm';

export default async function NewOfficerPage() {
  await requireAdmin();
  return (
    <section className="card narrow">
      <h1>Add officer</h1>
      <OfficerForm officer={null} />
    </section>
  );
}
