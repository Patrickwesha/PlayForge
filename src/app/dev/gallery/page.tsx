import Link from 'next/link';
import { DEFENSE_FORMATIONS, DEMO_PLAYS, OFFENSE_FORMATIONS, PACKERS_2019_FORMATIONS, PACKERS_2019_PLAYS, PACKERS_2019_ROUTES } from '@/seeds';
import { CanBadge } from '@/components/CanBadge';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';
import { themeFor } from '@/render/theme';
import { playDefenseLabel, playHeaderLine1 } from '@/model/factories';
import type { Formation, HashPreset, Theme } from '@/model/types';

function FormationCard({ f, theme }: { f: Formation; theme: ReturnType<typeof themeFor> }) {
  const diagram = { players: f.players, paths: {}, annotations: {} };
  return (
    <div className="border border-black bg-white">
      <div className="text-center font-bold text-xs py-1 border-b border-black uppercase" title={f.note}>
        {f.personnel ? `[${f.personnel}] ` : ''}
        {f.name}
        {f.confidence === 'needs-review' && <span className="ml-1.5 rounded bg-amber-100 text-amber-900 px-1 normal-case font-semibold">needs review</span>}
      </div>
      <div className="aspect-[3/2]">
        <PlayThumb diagram={diagram} aspect={1.5} theme={theme} fit={FORMATION_FIT} />
      </div>
    </div>
  );
}

/** Pack formations grouped by family, in playbook order. */
function byFamily(formations: Formation[]): [string, Formation[]][] {
  const groups = new Map<string, Formation[]>();
  for (const f of formations) groups.set(f.family ?? 'Other', [...(groups.get(f.family ?? 'Other') ?? []), f]);
  return [...groups];
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

      <h2 className="font-bold mt-8 mb-1">Packers 2019 ({PACKERS_2019_FORMATIONS.length})</h2>
      <p className="text-sm text-neutral-600 mb-2">
        {PACKERS_2019_FORMATIONS.filter((f) => f.confidence === 'needs-review').length} need review: the name and personnel are right, the positions are a starting shape.
      </p>
      {byFamily(PACKERS_2019_FORMATIONS).map(([family, list]) => (
        <section key={family}>
          <h3 className="font-semibold text-sm mt-4 mb-2">
            {family} ({list.length})
          </h3>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            {list.map((f) => (
              <FormationCard key={f.id} f={f} theme={theme} />
            ))}
          </div>
        </section>
      ))}

      <h2 className="font-bold mt-8 mb-1">Packers 2019 plays ({PACKERS_2019_PLAYS.length})</h2>
      <p className="text-sm text-neutral-600 mb-2">
        Composed from an imported formation, a protection, and a route word per receiver out of the {PACKERS_2019_ROUTES.length}-route library. Nothing is traced from the scans.{' '}
        {PACKERS_2019_PLAYS.filter((p) => p.confidence === 'needs-review').length} need review (the reasons are on each play).
      </p>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        {PACKERS_2019_PLAYS.map((p) => (
          <div key={p.id} className="border border-black bg-white">
            <div className="text-center border-b border-black py-1 leading-tight px-1">
              <div className="font-bold text-xs uppercase">{playHeaderLine1(p)}</div>
              <div className="font-bold text-sm uppercase">{p.name}</div>
            </div>
            <div className="aspect-[4/3]">
              <PlayThumb diagram={p.diagram} aspect={4 / 3} theme={theme} />
            </div>
            <CanBadge play={p} />
            <div className="flex justify-between text-[11px] px-2 py-1 border-t border-black">
              <span>
                {p.category} &middot; install {p.install} &middot; p.{p.sourcePage}
              </span>
              {p.confidence === 'needs-review' && <span className="bg-amber-200 font-bold px-1" title={p.reviewNotes?.join(' | ')}>needs review</span>}
            </div>
          </div>
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
