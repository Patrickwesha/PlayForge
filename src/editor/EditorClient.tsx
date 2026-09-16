'use client';

import dynamic from 'next/dynamic';

const EditorShell = dynamic(() => import('./EditorShell').then((m) => m.EditorShell), {
  ssr: false,
  loading: () => <div className="p-8 text-neutral-500">Loading editor…</div>,
});

export function EditorClient({ kind, id }: { kind: 'play' | 'formation'; id: string }) {
  return <EditorShell kind={kind} id={id} />;
}
