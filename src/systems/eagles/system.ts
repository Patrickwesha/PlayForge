/**
 * The Eagles 2026 system as data: the formation language (core.json, hand-written), the run catalog
 * (runs.json) and the pass catalog (pass.json), all in data/systems/eagles-2026/. Every definition is a
 * paraphrase with the page it came from; nothing is copied from the books.
 */
import core from '../../../data/systems/eagles-2026/core.json';
import runs from '../../../data/systems/eagles-2026/runs.json';
import pass from '../../../data/systems/eagles-2026/pass.json';

export type BookId = 'gb-2019' | 'rams-2022';
export type SourceRef = { book: string; page: number; section?: string };
export type Alias = { term: string; book: string };

/** One glossary line, whatever section it came from. */
export type Term = {
  term: string;
  means: string;
  onFilm?: string;
  /** Small grey label: who it talks to, the personnel, the family. */
  meta?: string;
  aliases?: Alias[];
  sources?: SourceRef[];
  /** Which book(s) have it: both, or one. */
  basis?: string;
  low?: boolean;
  /** Green Bay pack formation to draw. */
  packKey?: string;
  sameAs?: string;
};

export const EAGLES_SYSTEM_ID = 'eagles-2026';
export const eaglesCore = core;
export const eaglesRuns = runs;
export const eaglesPass = pass;

type Loose = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const arr = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);

/** Catalog entries (runs.json / pass.json) to glossary lines. */
export function toTerm(e: Loose, meta?: string): Term {
  const personnel = arr<string>(e.personnel).join(', ');
  const modifiers = arr<string>(e.modifiers).join(', ');
  const routes = arr<string>(e.routes).join(', ');
  const bits = [meta, personnel && `[${personnel}]`, modifiers && `tags: ${modifiers}`, routes && `routes: ${routes}`, str(e.type), str(e.numbers)].filter(Boolean);
  return {
    term: str(e.term) ?? str(e.name) ?? '',
    means: str(e.means) ?? '',
    onFilm: str(e.onFilm),
    meta: bits.join(' · ') || undefined,
    aliases: arr<Alias>(e.aliases),
    sources: arr<SourceRef>(e.sources),
    basis: str(e.basis),
    low: e.confidence === 'low',
  };
}

export const sourceLabel = (s: SourceRef) => (s.book === 'gb-2019' ? `GB p.${s.page}` : `Rams ${s.section ?? ''} p.${s.page}`.replace(/\s+/g, ' '));
export const sourceHref = (s: SourceRef) => (s.book === 'gb-2019' ? `/playbooks/gb-2019/read#page-${s.page}` : undefined);
