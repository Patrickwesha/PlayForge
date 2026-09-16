/** Types copied from PlayForge-Lite (lib/player.ts, lib/play.ts, lib/formation.ts, lib/playbook.ts). */

export type LegacyRouteSegment = {
  id: string;
  type: 'straight' | 'curve';
  start: { x: number; y: number };
  end: { x: number; y: number };
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
  endpointStyle: 'none' | 'arrow' | 'T' | 'circle';
  stroke?: string;
  strokeWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted' | 'wavy';
};

export type LegacyPlayer = {
  id: string;
  x: number;
  y: number;
  label: string;
  shape: 'circle' | 'square' | 'diamond' | 'E' | 'oval';
  size?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  shaded?: boolean;
  routes?: LegacyRouteSegment[];
};

export type LegacyFieldConfig = { zoom?: number; losEnabled?: boolean; losY?: number };

export type LegacyFormation = {
  id: string;
  name: string;
  field?: LegacyFieldConfig;
  layers?: { players?: Record<string, LegacyPlayer> };
  createdAt?: string;
  updatedAt?: string;
};

export type LegacyPlay = {
  id: string;
  name: string;
  tags?: string[];
  formationId?: string;
  fieldConfig?: LegacyFieldConfig;
  layers?: { players?: Record<string, LegacyPlayer> };
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LegacyPlaybook = {
  id: string;
  name: string;
  color?: string;
  playIds?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type LegacyExport = {
  version?: string | number;
  exportedAt?: string;
  formations?: LegacyFormation[];
  plays?: LegacyPlay[];
  playbooks?: LegacyPlaybook[];
};
