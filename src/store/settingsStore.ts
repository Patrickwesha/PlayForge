'use client';

import { create } from 'zustand';
import type { Settings } from '@/model/types';
import { DEFAULT_SETTINGS } from '@/model/types';
import { repo } from './repo';

type SettingsState = {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
};

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  async load() {
    if (get().loaded) return;
    const s = await repo.getSettings();
    set({ settings: s, loaded: true });
  },
  async update(patch) {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await repo.saveSettings(next);
  },
}));
