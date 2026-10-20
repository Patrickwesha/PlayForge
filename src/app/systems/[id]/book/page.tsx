import { notFound } from 'next/navigation';
import { BEAST_SYSTEM_ID } from '@/systems/beast/content';
import { BeastBook } from './BeastBook';

export const metadata = { title: 'Beast Offense 2026 playbook - PlayForge' };

export default async function BeastBookPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (id !== BEAST_SYSTEM_ID) notFound();
  return <BeastBook />;
}
