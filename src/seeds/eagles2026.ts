import type { Formation, Snap } from '@/model/types';
import pack from './data/eagles2026.json';

/**
 * Eagles 2026 All-22 chart: unique formations deduped from the charted snaps, plus every snap linked
 * to its formation. Written by `npm run import:snaps` (scripts/import-snaps.ts) from import-data/ with
 * the same engine the Formations > Import page uses, so an import of the same files in the browser
 * merges into these rows instead of duplicating them.
 */
export const EAGLES_2026_PACK = 'eagles-2026';
/** Formation ids are `${FORMATION_ID_PREFIX}${hash}`; the prefix lets stale pack rows be found. */
export const EAGLES_2026_FORMATION_ID_PREFIX = 'snapform-';
/** Snap ids are `${team}-${season}-${playId}`. */
export const EAGLES_2026_SNAP_ID_PREFIX = `${pack.team}-${pack.season}-`;
/** Content hash of the data file; part of the seed stamp so a re-import reaches open databases. */
export const EAGLES_2026_REVISION: string = pack.revision;

export const EAGLES_2026_FORMATIONS: Formation[] = pack.formations as unknown as Formation[];
export const EAGLES_2026_SNAPS: Snap[] = pack.snaps as unknown as Snap[];
