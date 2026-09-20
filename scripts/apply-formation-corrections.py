"""Fold hand corrections into data/formations/packers-2019.source.json, then run `npm run import:formations`.

  python scripts/apply-formation-corrections.py data/formations/corrections-2026-09-20.json

The source file is rewritten in PlayForge's own constants (guard 1, tackle 2, TE 3), which the importer
passes through unchanged. Formations without a correction keep the positions the importer last produced.
"""
import json
import sys

SRC = "data/formations/packers-2019.source.json"
PACK = "src/seeds/data/packers2019.json"
fix = json.load(open(sys.argv[1], encoding="utf-8"))["formations"]
src = json.load(open(SRC, encoding="utf-8"))
pack = {f["key"]: f for f in json.load(open(PACK, encoding="utf-8"))["formations"]}
slug = lambda s: "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-").replace("--", "-")  # noqa: E731

applied, still = [], []
for f in src["formations"]:
    key = f"{slug(f['name'])}-{slug(f['personnel'])}"
    if key in fix:
        ol = iter(["LT", "LG", "RG", "RT"])
        players = []
        for tok in sorted(fix[key].split(), key=lambda t: float(t.split(":")[1].split(",")[0])):
            label, xy = tok.split(":")
            x, y = (float(v) for v in xy.split(","))
            spot = {"OL": None, "C": "C", "Q": "QB"}.get(label, label)
            players.append({"spot": spot or next(ol), "x": x, "y": y})
        f["players"] = players
        qb = next(p for p in players if p["spot"] == "QB")
        f["qb_alignment"] = "under" if qb["y"] > -2 else "pistol" if qb["y"] > -4.5 else "gun"
        f["confidence"] = "derived"
        f["note"] = f"Positions corrected by hand from page {f['source_page']} on 2026-09-20."
        applied.append(key)
    else:
        f["players"] = [{"spot": p["spot"], "x": p["x"], "y": p["y"]} for p in pack[key]["players"]]
        if f["confidence"] != "derived":
            still.append(key)
src["constants_used"].update({"OL_guard_split": 1.0, "OL_tackle_split": 2.0, "TE_attached": 3.0, "comment": "PlayForge's own constants since 2026-09-20; the importer passes these through unchanged."})
json.dump(src, open(SRC, "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)
print(f"{len(applied)} corrected, {len(set(fix) - set(applied))} corrections without a match: {sorted(set(fix) - set(applied))}")
print(f"still needs-review: {still}")
