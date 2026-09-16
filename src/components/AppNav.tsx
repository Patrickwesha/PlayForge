'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS: { href: string; label: string }[] = [
  { href: '/plays', label: 'Plays' },
  { href: '/formations', label: 'Formations' },
  { href: '/playbooks', label: 'Playbooks' },
  { href: '/settings', label: 'Settings' },
];

export function AppNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/print')) return null;
  return (
    <header className="no-print h-11 shrink-0 flex items-center gap-1 px-3 bg-black text-white border-b border-black">
      <Link href="/" className="font-bold tracking-wide text-sm mr-3">
        PLAY<span className="text-accent-red">FORGE</span>
      </Link>
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + '/');
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-2.5 py-1 rounded text-sm ${active ? 'bg-white text-black font-semibold' : 'text-neutral-300 hover:text-white hover:bg-neutral-800'}`}
          >
            {l.label}
          </Link>
        );
      })}
    </header>
  );
}
