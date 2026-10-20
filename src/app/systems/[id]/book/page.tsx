import { notFound } from 'next/navigation';
import { youthSystem } from '@/systems/youth/registry';
import { YouthBook } from './YouthBook';

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return { title: `${youthSystem(id)?.title ?? 'System'} playbook - PlayForge` };
}

export default async function YouthBookPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!youthSystem(id)) notFound();
  return <YouthBook id={id} />;
}
