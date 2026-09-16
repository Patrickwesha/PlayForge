import Link from 'next/link';
import { DEFENSE_FORMATIONS, DEMO_PLAYS, OFFENSE_FORMATIONS } from '@/seeds';
import { PlayThumb } from '@/render/PlayThumb';
import { themeFor } from '@/render/theme';
import { playDefenseLabel, playHeaderLine1 } from '@/model/factories';
import type { Formation, HashPreset, Theme } from '@/model/types';

function FormationCard({ f, theme }: { f: Formation; theme: ReturnType<typeof themeFor> }) {
  const diagram = { players: f.players, paths: {}, annotations: {} };
  return (
    <div className="border border-black bg-white">
      <div className="text-center font-bold text-xs py-1 border-b border-black uppercase">
        {f.personnel ? `[${f.personnel}] ` : ''}
        {f.name}
      </div>
      <div className="aspect-[3/2]">
        <PlayThumb diagram={diagram} aspect={1.5} theme={theme} fit={{ losBand: 2, maxBack: 8 }} />
      </div>
    </div>
  );
}

export default async function GalleryPage(props: PageProps<'/dev/gallery'>) {
  const sp = await props.searchParams;
  const themeName: Theme = sp.theme === 'yardlines' ? 'yardlines' : 'plain';
  const hash: HashPreset = sp.hash === 'nfl' || sp.hash === 'hs' ? sp.hash : 'ncaa';
  const theme = themeFor(themeName, hash);
  const other = themeName === 'plain' ? 'yardlines' : 'plain';

  return (
    <main className="max-w-6xl mx-auto w-full p-6">
      <div className="flex items-baseline gap-4 mb-4">
        <h1 className="text-xl font-bold">Gallery</h1>
        <span className="text-sm text-neutral-600">Seed formations and demo plays rendered by the shared SVG renderer.</span>
        <Link className="ml-auto text-sm underline" href={`/dev/gallery?theme=${other}&hash=${hash}`}>
          Switch to {other} theme
        </Link>
      </div>

      <h2 className="font-bold mt-2 mb-2">Demo plays</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {DEMO_PLAYS.map((p) => (
          <div key={p.id} className="border-2 border-black bg-white">
            <div className="text-center border-b-2 border-black py-1 leading-tight">
              <div className="font-bold text-sm uppercase">{playHeaderLine1(p)}</div>
              <div className="font-bold text-base uppercase">{p.name}</div>
            </div>
            <div className="aspect-[4/3]">
              <PlayThumb diagram={p.diagram} aspect={4 / 3} theme={theme} />
            </div>
            <div className="flex justify-between text-xs font-bold px-2 py-1 border-t border-black uppercase">
              <span>{playDefenseLabel(p)}</span>
              <span>{p.wristband}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-bold mt-8 mb-2">Offense ({OFFENSE_FORMATIONS.length})</h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        {OFFENSE_FORMATIONS.map((f) => (
          <FormationCard key={f.id} f={f} theme={theme} />
        ))}
      </div>

      <h2 className="font-bold mt-8 mb-2">Defense ({DEFENSE_FORMATIONS.length})</h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        {DEFENSE_FORMATIONS.map((f) => (
          <FormationCard key={f.id} f={f} theme={theme} />
        ))}
      </div>
    </main>
  );
}
