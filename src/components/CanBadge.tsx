import type { Play } from '@/model/types';

/** A Can call holds two plays. The primary is what is drawn; this line shows the alternate riding along and what flips to it. */
export function CanBadge({ play, className = '' }: { play: Pick<Play, 'alternate'>; className?: string }) {
  const alt = play.alternate;
  if (!alt) return null;
  return (
    <div className={`flex items-baseline gap-1.5 px-2 py-1 text-[11px] leading-tight bg-amber-50 border-t border-amber-200 ${className}`} data-can-alternate>
      <span className="font-bold text-amber-800 shrink-0">CAN TO</span>
      <span className="font-bold uppercase truncate">{alt.name}</span>
      {alt.trigger && <span className="text-neutral-600 truncate">vs. {alt.trigger}</span>}
    </div>
  );
}
