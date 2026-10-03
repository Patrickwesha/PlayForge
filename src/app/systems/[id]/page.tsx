import Link from 'next/link';
import { EAGLES_SYSTEM_ID } from '@/systems/eagles/system';
import { SystemClient } from './SystemClient';

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return { title: id === EAGLES_SYSTEM_ID ? 'Eagles 2026 system - PlayForge' : 'System - PlayForge' };
}

export default async function SystemPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (id !== EAGLES_SYSTEM_ID)
    return (
      <main className="max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-xl font-bold">No system with that name</h1>
        <Link className="underline" href={`/systems/${EAGLES_SYSTEM_ID}`}>
          Open the Eagles 2026 system
        </Link>
      </main>
    );
  return <SystemClient />;
}
