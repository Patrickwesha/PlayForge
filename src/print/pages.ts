import type { Formation, LayoutId, Paper, Play, Playbook } from '@/model/types';
import { LAYOUTS, paginate, perPage } from '@/geometry/layout';

export type CellItem = { kind: 'play'; play: Play } | { kind: 'formation'; formation: Formation };

export type PrintPageModel =
  | { kind: 'cover'; title: string; subtitle?: string; team?: string; season?: string }
  | { kind: 'grid'; layout: LayoutId; cells: CellItem[]; sectionTitle?: string }
  | { kind: 'callsheet'; rows: Play[]; title: string };

export type PrintDoc = {
  title: string;
  subtitle?: string;
  paper: Paper;
  /** Orientation of the whole job (one @page size per document). */
  orientation: 'portrait' | 'landscape';
  pages: PrintPageModel[];
};

export type BuildOptions = {
  title: string;
  subtitle?: string;
  paper: Paper;
  layout: LayoutId;
  /** Layout used for formation sections (must share the play layout's orientation). */
  formationLayout?: LayoutId;
  cover?: { title: string; subtitle?: string; team?: string; season?: string };
  callsheet?: boolean;
};

export type Section = { title?: string; items: CellItem[] };

/** Pick a formation layout that matches the play layout orientation. */
export function formationLayoutFor(layout: LayoutId, preferred?: LayoutId): LayoutId {
  const o = LAYOUTS[layout].orientation;
  if (preferred && LAYOUTS[preferred].orientation === o) return preferred;
  return o === 'landscape' ? '4up' : '9up';
}

export function buildDoc(sections: Section[], o: BuildOptions): PrintDoc {
  const pages: PrintPageModel[] = [];
  if (o.cover) pages.push({ kind: 'cover', ...o.cover });
  const fLayout = formationLayoutFor(o.layout, o.formationLayout);
  for (const s of sections) {
    const plays = s.items.filter((i) => i.kind === 'play');
    const formations = s.items.filter((i) => i.kind === 'formation');
    for (const chunk of paginate(plays, perPage(o.layout))) pages.push({ kind: 'grid', layout: o.layout, cells: chunk, sectionTitle: s.title });
    for (const chunk of paginate(formations, perPage(fLayout))) pages.push({ kind: 'grid', layout: fLayout, cells: chunk, sectionTitle: s.title });
  }
  if (o.callsheet) {
    const rows = sections.flatMap((s) => s.items.filter((i): i is Extract<CellItem, { kind: 'play' }> => i.kind === 'play').map((i) => i.play));
    for (const chunk of paginate(rows, 28)) pages.push({ kind: 'callsheet', rows: chunk, title: o.title });
  }
  return { title: o.title, subtitle: o.subtitle, paper: o.paper, orientation: LAYOUTS[o.layout].orientation, pages };
}

export function sectionsFromPlaybook(pb: Playbook, plays: Map<string, Play>, formations: Map<string, Formation>): Section[] {
  return pb.sections.map((s) => ({
    title: s.title,
    items: s.itemIds
      .map((id): CellItem | null => {
        if (s.kind === 'plays') {
          const p = plays.get(id);
          return p ? { kind: 'play', play: p } : null;
        }
        const f = formations.get(id);
        return f ? { kind: 'formation', formation: f } : null;
      })
      .filter((x): x is CellItem => x !== null),
  }));
}
