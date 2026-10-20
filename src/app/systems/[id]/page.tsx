import Link from 'next/link';
import { EAGLES_SYSTEM_ID } from '@/systems/eagles/system';
import { BEAST_SYSTEM_ID } from '@/systems/beast/content';
import { SystemClient } from './SystemClient';
import { BeastClient } from './BeastClient';

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (id === BEAST_SYSTEM_ID) return { title: 'Beast Offense 2026 - PlayForge' };
  return { title: id === EAGLES_SYSTEM_ID ? 'Eagles 2026 system - PlayForge' : 'System - PlayForge' };
}

export default async function SystemPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (id === BEAST_SYSTEM_ID) return <BeastClient />;
  if (id !== EAGLES_SYSTEM_ID)
    return (
      <main className="max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-xl font-bold">No system with that name</h1>
        <Link className="underline block" href={`/systems/${EAGLES_SYSTEM_ID}`}>
          Open the Eagles 2026 system
        </Link>
        <Link className="underline block" href={`/systems/${BEAST_SYSTEM_ID}`}>
          Open the Beast Offense 2026
        </Link>
      </main>
    );
  return <SystemClient />;
}
