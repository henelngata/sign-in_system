import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/session';
import { getOfficer } from '@/lib/register';
import OfficerForm from '@/components/OfficerForm';

export default async function EditOfficerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const officer = /^\d+$/.test(id) ? getOfficer(Number(id)) : undefined;
  if (!officer) notFound();
  const { pin_hash: _omit, ...safe } = officer; // never send the hash to the browser
  return (
    <section className="card narrow">
      <h1>Edit officer</h1>
      <OfficerForm officer={safe} />
    </section>
  );
}
