import { requireAdmin } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <main className="wide">{children}</main>;
}
