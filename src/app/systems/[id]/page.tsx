import Link from 'next/link';
import { EAGLES_SYSTEM_ID } from '@/systems/eagles/system';
import { YOUTH_SYSTEMS, youthSystem } from '@/systems/youth/registry';
import { SystemClient } from './SystemClient';
import { YouthClient } from './YouthClient';

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const youth = youthSystem(id);
  if (youth) return { title: `${youth.title} - PlayForge` };
  return { title: id === EAGLES_SYSTEM_ID ? 'Eagles 2026 system - PlayForge' : 'System - PlayForge' };
}

export default async function SystemPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (youthSystem(id)) return <YouthClient id={id} />;
  if (id !== EAGLES_SYSTEM_ID)
    return (
      <main className="max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-xl font-bold">No system with that name</h1>
        <Link className="underline block" href={`/systems/${EAGLES_SYSTEM_ID}`}>
          Open the Eagles 2026 system
        </Link>
        {Object.values(YOUTH_SYSTEMS).map((s) => (
          <Link key={s.id} className="underline block" href={`/systems/${s.id}`}>
            Open {s.title}
          </Link>
        ))}
      </main>
    );
  return <SystemClient />;
}
