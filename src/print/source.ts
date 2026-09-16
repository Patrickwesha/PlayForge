import type { LayoutId, Paper, Theme } from '@/model/types';
import { DEFENSE_FORMATIONS, DEMO_PLAYS, OFFENSE_FORMATIONS } from '@/seeds';
import { buildDoc, type PrintDoc, type Section } from './pages';

export type PrintRequest = {
  demo: boolean;
  play?: string;
  plays?: string;
  playbook?: string;
  formations?: string;
  layout: LayoutId;
  paper: Paper;
  cover: boolean;
  callsheet: boolean;
  title?: string;
  theme?: Theme;
};

/**
 * Resolve a print request into a document. Phase 1 serves the seed data;
 * the repo-backed loader is added with persistence.
 */
export async function loadPrintDoc(req: PrintRequest): Promise<PrintDoc> {
  const sections: Section[] = [];
  let title = req.title ?? 'PLAYFORGE';

  if (req.demo || (!req.play && !req.plays && !req.playbook && !req.formations)) {
    title = req.title ?? 'BEAST COUNTER';
    sections.push({ title: 'Run game', items: DEMO_PLAYS.filter((p) => p.category === 'Run').map((play) => ({ kind: 'play', play })) });
    sections.push({ title: 'Pass game', items: DEMO_PLAYS.filter((p) => p.category !== 'Run').map((play) => ({ kind: 'play', play })) });
    sections.push({ title: 'Formations', items: [...OFFENSE_FORMATIONS.slice(0, 9)].map((formation) => ({ kind: 'formation', formation })) });
  } else if (req.formations) {
    title = req.title ?? 'FORMATIONS';
    const all = [...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS];
    const list = req.formations === 'all' ? all : all.filter((f) => req.formations!.split(',').includes(f.id));
    sections.push({ items: list.map((formation) => ({ kind: 'formation', formation })) });
  } else {
    const repo = await import('@/store/printSource');
    return repo.loadFromRepo(req);
  }

  return buildDoc(sections, {
    title,
    paper: req.paper,
    layout: req.layout,
    cover: req.cover ? { title, subtitle: 'Offensive playbook', season: '2026' } : undefined,
    callsheet: req.callsheet,
  });
}
