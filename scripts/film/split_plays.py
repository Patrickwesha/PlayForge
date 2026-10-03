"""
Split an NFL Pro "Game Center" All-22 download into plays.

Each play in the download is a sideline clip followed by an end zone clip of the same length, joined
with hard cuts. Step 1 finds the cuts with ffmpeg (full frame rate: sampling misses cuts):

    ffmpeg -nostdin -i GAME.mp4 -an -vf "scale=320:180,select='gt(scene,0.06)',metadata=print:file=cuts.txt" -f null -

Step 2 (this script) drops weak cuts, pairs the segments, and writes plays.json:

    python scripts/film/split_plays.py cuts.txt DURATION_SECONDS plays.json

A play = {n, sl: [start, end], ez: [start, end] | null}. A segment whose neighbour is not the same
length (within TOL) is kept as a sideline-only play and listed in the report, so nothing is dropped.
"""
import json
import re
import sys

MIN_SCORE = 0.1  # cuts scoring below this are camera moves, not edits
TOL = 0.35  # seconds: a pair's two clips match to within this
LOOSE = 1.1  # seconds: the looser match tried last
MIN_LEN = 1.0  # shorter than this is a leftover sliver; merged into the previous segment


def read_cuts(path):
    cuts = []
    t = None
    for line in open(path, encoding="utf-8", errors="ignore"):
        m = re.search(r"pts_time:([0-9.]+)", line)
        if m:
            t = float(m.group(1))
            continue
        m = re.search(r"scene_score=([0-9.]+)", line)
        if m and t is not None:
            if float(m.group(1)) >= MIN_SCORE:
                cuts.append(t)
            t = None
    return cuts


def main():
    cuts_path, duration, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    edges = [0.0] + read_cuts(cuts_path) + [duration]
    segs = []
    for a, b in zip(edges, edges[1:]):
        if b - a < MIN_LEN and segs:
            segs[-1][1] = b
        else:
            segs.append([a, b])
    plays, lone = [], []
    length = lambda s: s[1] - s[0]
    i = 0
    while i < len(segs):
        a = segs[i]
        b = segs[i + 1] if i + 1 < len(segs) else None
        c = segs[i + 2] if i + 2 < len(segs) else None
        pair = None
        if b and abs(length(a) - length(b)) <= TOL:
            pair, used = (a, b), 2
        elif b and c and abs(length(a) - (length(b) + length(c))) <= TOL:  # false cut inside the end zone clip
            pair, used = (a, [b[0], c[1]]), 3
        elif b and c and abs(length(a) + length(b) - length(c)) <= TOL:  # false cut inside the sideline clip
            pair, used = ([a[0], b[1]], c), 3
        elif b and abs(length(a) - length(b)) <= LOOSE:  # the two angles are sometimes cut up to a second apart
            pair, used = (a, b), 2
        if pair:
            plays.append({"n": len(plays) + 1, "sl": pair[0], "ez": pair[1]})
            i += used
        else:
            plays.append({"n": len(plays) + 1, "sl": a, "ez": None})
            lone.append(len(plays))
            i += 1
    json.dump({"duration": duration, "plays": plays}, open(out, "w"), indent=1)
    print(f"{len(segs)} segments -> {len(plays)} plays ({len(plays) - len(lone)} with both angles, {len(lone)} single: {lone})")


if __name__ == "__main__":
    main()
