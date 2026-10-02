import type { NextConfig } from "next";

/**
 * PLAYFORGE_LOW_MEMORY_BUILD=1: for local builds on a machine short of memory. One build worker, and
 * the TypeScript check is left to `npx tsc --noEmit` (run it separately). Unset on Vercel.
 */
const lowMemory = process.env.PLAYFORGE_LOW_MEMORY_BUILD === "1";

const nextConfig: NextConfig = {
  ...(lowMemory ? { experimental: { cpus: 1, workerThreads: true }, typescript: { ignoreBuildErrors: true } } : {}),
};

export default nextConfig;
