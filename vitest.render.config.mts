import { defineConfig } from 'vitest/config';
import path from 'node:path';

/** Runs scripts/render-formations.render.tsx (`npm run render:formations`). Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/*.render.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
});
