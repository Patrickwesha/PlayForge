import { notFound } from 'next/navigation';
import { BEAST_SYSTEM_ID } from '@/systems/beast/content';
import { BeastPrint, type BeastSheet } from './BeastPrint';

const SHEETS: BeastSheet[] = ['callsheet', 'wristband', 'jobs', 'install', 'teach'];

export async function generateMetadata(props: { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> }) {
  const { sheet } = await props.searchParams;
  return { title: `Beast ${sheet ?? 'print'} - PlayForge` };
}

export default async function SystemPrintPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ sheet?: string }> }) {
  const { id } = await props.params;
  const { sheet } = await props.searchParams;
  if (id !== BEAST_SYSTEM_ID) notFound();
  const s = (SHEETS.includes(sheet as BeastSheet) ? sheet : 'callsheet') as BeastSheet;
  return <BeastPrint sheet={s} />;
}
