import Link from 'next/link';

const CARDS = [
  { href: '/plays', title: 'Plays', body: 'Draw plays on a formation, add routes, blocks, and notes.' },
  { href: '/formations', title: 'Formations', body: 'Offensive sets and defensive fronts. Flip, duplicate, edit.' },
  { href: '/playbooks', title: 'Playbooks', body: 'Order plays into sections and print 1-up to 8-up sheets.' },
  { href: '/dev/gallery', title: 'Gallery', body: 'Every seed formation and demo play rendered in the Visio look.' },
];

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto w-full p-6">
      <h1 className="text-2xl font-bold mb-1">PlayForge</h1>
      <p className="text-neutral-600 mb-6">NFL-style play sheets, drawn in the browser, printed like Visio.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="block rounded-lg border border-neutral-300 bg-white p-4 hover:border-black">
            <div className="font-semibold">{c.title}</div>
            <div className="text-sm text-neutral-600">{c.body}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
