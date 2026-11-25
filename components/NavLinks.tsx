'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const isActive = (href: string) =>
    href === '/' || href === '/admin' ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={isActive(l.href) ? 'active' : undefined}>
          {l.label}
        </Link>
      ))}
    </>
  );
}
