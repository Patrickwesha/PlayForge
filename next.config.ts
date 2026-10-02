import type { NextConfig } from "next";

/**
 * PLAYFORGE_LOW_MEMORY_BUILD=1: for local builds on a machine short of memory. One build worker, and
 * the TypeScript check is left to `npx tsc --noEmit` (run it separately). Unset on Vercel.
 */
const lowMemory = process.env.PLAYFORGE_LOW_MEMORY_BUILD === "1";

const nextConfig: NextConfig = {
  // the Green Bay 2019 book (public/book, source/book) is read from disk at request time on this machine only:
  // keep its thousands of files out of the deployment trace
  outputFileTracingExcludes: { "/playbooks/[id]/read": ["./public/book/**"], "/playbooks/[id]/review": ["./public/book/**"], "/api/book/[id]/edits": ["./source/**", "./public/book/**"] },
  ...(lowMemory ? { experimental: { cpus: 1, workerThreads: true }, typescript: { ignoreBuildErrors: true } } : {}),
};

export default nextConfig;
