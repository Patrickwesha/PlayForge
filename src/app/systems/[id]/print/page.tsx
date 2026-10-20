import { notFound } from 'next/navigation';
import { youthSystem } from '@/systems/youth/registry';
import { YouthPrint, type YouthSheet } from './YouthPrint';

const SHEETS: YouthSheet[] = ['callsheet', 'wristband', 'jobs', 'install', 'teach'];

export async function generateMetadata(props: { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> }) {
  const { id } = await props.params;
  const { sheet } = await props.searchParams;
  return { title: `${youthSystem(id)?.short ?? 'System'} ${sheet ?? 'print'} - PlayForge` };
}

export default async function SystemPrintPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> }) {
  const { id } = await props.params;
  const { sheet } = await props.searchParams;
  if (!youthSystem(id)) notFound();
  const s = (SHEETS.includes(sheet as YouthSheet) ? sheet : 'callsheet') as YouthSheet;
  return <YouthPrint id={id} sheet={s} />;
}
