'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Playbook } from '@/model/types';
import { repo } from '@/store/repo';
import { newPlaybook } from '@/model/factories';

const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black';

export function PlaybooksClient() {
  const router = useRouter();
  const playbooks = useLiveQuery(() => repo.listPlaybooks(), []);

  const create = async () => {
    const pb = newPlaybook('NEW PLAYBOOK');
    await repo.savePlaybook(pb);
    router.push(`/playbooks/${pb.id}`);
  };
  const del = async (pb: Playbook) => {
    if (!confirm(`Delete playbook "${pb.name}"? Plays are kept.`)) return;
    await repo.deletePlaybook(pb.id);
  };

  return (
    <main className="max-w-4xl mx-auto w-full p-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">Playbooks</h1>
        <button className="ml-auto text-sm px-3 py-1 rounded bg-black text-white" onClick={() => void create()}>
          + New playbook
        </button>
      </div>
      {!playbooks && <div className="text-neutral-500">Loading…</div>}
      <div className="flex flex-col gap-2">
        {playbooks?.map((pb) => {
          const count = pb.sections.reduce((n, s) => n + s.itemIds.length, 0);
          return (
            <div key={pb.id} className="flex items-center gap-3 border border-neutral-300 bg-white rounded px-3 py-2 hover:border-black">
              <Link href={`/playbooks/${pb.id}`} className="flex-1">
                <div className="font-bold uppercase">{pb.name}</div>
                <div className="text-xs text-neutral-500">
                  {pb.sections.length} section{pb.sections.length === 1 ? '' : 's'} · {count} item{count === 1 ? '' : 's'} · {pb.defaultLayout} · {pb.paper}
                </div>
              </Link>
              <Link href={`/print?playbook=${pb.id}&layout=${pb.defaultLayout}&paper=${pb.paper}&cover=${pb.cover.showCover ? 1 : 0}`} className={btn}>
                Print
              </Link>
              <button className={`${btn} text-red-700`} onClick={() => void del(pb)}>Delete</button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
