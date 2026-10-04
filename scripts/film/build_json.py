"""
Collect the per-snap charting files into one PlayForge alignment file.

    python scripts/film/build_json.py source/film/w1 import-data/W1_WAS-PHI_playforge.json 1 WAS home

Reads <week dir>/out/W<week>-NNN.json (written while charting from frames, see source/film/CHARTING.md),
checks each one (player counts against the personnel, known labels, receiver order), and writes the
`playforge-formations/v1` file that `npm run import:snaps` and Formations > Import read. Problems are
printed, and a snap with a problem is still written so nothing silently disappears.
"""
import glob
import json
import os
import sys

ALIGN_QB = {"under_center", "pistol", "gun"}
ALIGN_BACK = {"deep", "offset", "gun_offset", "pistol_back", "fb", "wing_back"}
ALIGN_RCV = {"inline", "wing", "tight", "slot", "numbers", "wide"}
KEEP = ["id", "quarter", "clock", "down", "distance", "yardline", "play_text", "personnel", "form_family", "formation", "backfield", "strength", "hash", "motion", "confidence", "angles", "notes", "players"]


def check(s):
    out = []
    pers = s.get("personnel", "")
    ps = s.get("players", [])
    if len(pers) == 2 and pers.isdigit():
        rb, te = int(pers[0]), int(pers[1])
        want = {"RB": rb, "TE": te, "WR": 5 - rb - te, "QB": 1}
        have = {k: sum(1 for p in ps if (p["pos"] if p["pos"] != "FB" else "RB") == k) for k in want}
        if have != want:
            out.append(f"players {have} do not match {pers} personnel {want}")
    for p in ps:
        a = p.get("align")
        ok = a in ALIGN_QB if p["pos"] == "QB" else a in ALIGN_BACK | ALIGN_RCV
        if not ok:
            out.append(f"{p['pos']} align '{a}' not a known label")
    for p in ps:
        sb = p.get("stack_behind")
        if sb is not None and not isinstance(sb, (bool, int)):
            out.append(f"{p['pos']} stack_behind '{sb}' must be the order number of the man in front (or true)")
    for side in "LR":
        orders = sorted(p.get("order") or 0 for p in ps if p.get("side") == side and p.get("align") in ALIGN_RCV)
        if orders and orders != list(range(1, len(orders) + 1)):
            out.append(f"side {side} receiver order {orders} is not 1..n")
    return out


def main():
    week_dir, out_path, week, opponent = sys.argv[1:5]
    home = len(sys.argv) > 5 and sys.argv[5] == "home"
    snaps, problems = [], 0
    for f in sorted(glob.glob(os.path.join(week_dir, "out", "W*.json"))):
        s = json.load(open(f, encoding="utf-8"))
        for msg in check(s):
            problems += 1
            print(f"{s['id']}: {msg}")
        snaps.append({k: s.get(k) for k in KEEP if k in s})
    doc = {"schema": "playforge-formations/v1", "game": {"season": 2026, "week": int(week), "team": "PHI", "opponent": opponent, "home": home}, "snaps": snaps}
    json.dump(doc, open(out_path, "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)
    print(f"{len(snaps)} snaps -> {out_path} ({problems} problem(s))")


if __name__ == "__main__":
    main()
