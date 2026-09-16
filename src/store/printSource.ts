import type { PrintRequest } from '@/print/source';
import { buildDoc, sectionsFromPlaybook, type PrintDoc, type Section } from '@/print/pages';
import { repo } from './repo';

/** Repo-backed loader for /print. */
export async function loadFromRepo(req: PrintRequest): Promise<PrintDoc> {
  const settings = await repo.getSettings();
  const paper = req.paper ?? settings.paper;

  if (req.playbook) {
    const pb = await repo.getPlaybook(req.playbook);
    if (!pb) throw new Error('Playbook not found');
    const [plays, formations] = await Promise.all([repo.listPlays(), repo.listFormations()]);
    const sections = sectionsFromPlaybook(pb, new Map(plays.map((p) => [p.id, p])), new Map(formations.map((f) => [f.id, f])));
    return buildDoc(sections, {
      title: req.title ?? pb.name,
      subtitle: pb.subtitle,
      paper,
      layout: req.layout,
      cover: req.cover ? { title: pb.cover.title || pb.name, subtitle: pb.cover.subtitle, team: pb.cover.team, season: pb.cover.season } : undefined,
      callsheet: req.callsheet,
    });
  }

  const sections: Section[] = [];
  let title = req.title ?? 'PLAYFORGE';
  if (req.play) {
    const p = await repo.getPlay(req.play);
    if (!p) throw new Error('Play not found');
    title = req.title ?? p.name;
    sections.push({ items: [{ kind: 'play', play: p }] });
  } else if (req.plays) {
    const plays = await repo.getPlays(req.plays.split(','));
    sections.push({ items: plays.map((play) => ({ kind: 'play', play })) });
  } else if (req.formations) {
    const all = await repo.listFormations();
    const list = req.formations === 'all' ? all : all.filter((f) => req.formations!.split(',').includes(f.id));
    title = req.title ?? 'FORMATIONS';
    sections.push({ items: list.map((formation) => ({ kind: 'formation', formation })) });
  }
  return buildDoc(sections, { title, paper, layout: req.layout, callsheet: req.callsheet, cover: req.cover ? { title } : undefined });
}
