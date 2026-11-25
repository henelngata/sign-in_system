import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import '@fontsource-variable/manrope';
import { getAdmin } from '@/lib/session';
import NavLinks from '@/components/NavLinks';
import { Mark } from '@/components/icons';
import { logoutAction } from './admin/actions';
import './globals.css';

const orgName = process.env.ORG_NAME || 'Parliament';

export const metadata: Metadata = {
  title: `${orgName} Daily Register`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0b1f3a' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  const links = admin
    ? [
        { href: '/admin', label: 'Register' },
        { href: '/whos-in', label: 'Who’s in' },
        { href: '/admin/officers', label: 'Officers' },
        { href: '/admin/security', label: 'Security' },
      ]
    : [
        { href: '/', label: 'Sign in' },
        { href: '/whos-in', label: 'Who’s in' },
        { href: '/admin/login', label: 'Admin' },
      ];

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link className="brand" href="/">
            <Mark className="brand-mark" />
            <span>
              <strong>{orgName}</strong>
              <small>Daily Register</small>
            </span>
          </Link>
          <nav className="nav">
            <NavLinks links={links} />
            {admin && (
              <form action={logoutAction}>
                <button className="nav-logout" title={`Logged in as ${admin.username}`}>Log out</button>
              </form>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
