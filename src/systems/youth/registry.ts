import { BEAST } from '@/systems/beast/plays';
import { WCO } from '@/systems/wco/plays';
import type { YouthSystem } from './build';

/** Every youth system, by its /systems/<id> slug. */
export const YOUTH_SYSTEMS: Record<string, YouthSystem> = {
  [BEAST.id]: BEAST,
  [WCO.id]: WCO,
};

export const youthSystem = (id: string): YouthSystem | undefined => YOUTH_SYSTEMS[id];
