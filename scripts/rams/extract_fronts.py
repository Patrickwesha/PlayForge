"""
Read the defensive fronts out of the Rams 2022 Defensive Identification section (pages 13-23: base, nickel,
goal line and short yardage fronts), as positions relative to the offensive line.

    python scripts/rams/extract_fronts.py "source/rams-2022/pdf/02. Defensive Identification 2022.pdf" data/rams-2022/fronts.json

Every diagram has a name printed above it ("34", "35 FUP", "42 Over", ...), five rings for the line with a
square for the center, a "Y" letter for the tight end, and the defenders as letters. x is in line splits
(one yard), y is a share of the split (the pages are not to scale vertically). Positions and names only.
"""
import collections
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from extract_cells import DB, DL, LB, dist, page_shapes, page_spans  # noqa: E402

PAGES = {13: "base", 14: "base", 15: "base", 16: "base", 17: "base", 18: "nickel", 19: "nickel", 20: "nickel", 21: "nickel", 22: "goal-line", 23: "short-yardage"}
Y_SCALE = 0.7


def main():
    pdf, out = sys.argv[1], sys.argv[2]
    doc = __import__("pymupdf").open(pdf)
    fronts = []
    for pageno, group in PAGES.items():
        page = doc[pageno - 1]
        spans = page_spans(page)
        rings, squares, discs, ghosts, polys, heads = page_shapes(page)
        title = " ".join(s["text"] for s in spans if s["size"] >= 16)
        names = [s for s in spans if 11.5 <= s["size"] <= 13 and s["color"] == 0 and s["y"] < 760 and s["text"] not in ("Y", "F", "X", "Z")]
        # join name words on one line
        lines = []
        for s in sorted(names, key=lambda s: (round(s["y"]), s["x0"])):
            if lines and abs(lines[-1]["y"] - s["y"]) < 3 and s["x0"] - lines[-1]["x1"] < 9:
                lines[-1]["text"] += " " + s["text"]
                lines[-1]["x1"] = s["x1"]
            else:
                lines.append(dict(s))
        # every diagram: a square (or the middle ring of a five-ring row)
        centers = list(squares)
        if not centers:
            rows = collections.defaultdict(list)
            for r in rings:
                rows[round(r[1] / 4)].append(r)
            for row in rows.values():
                if len(row) >= 5:
                    row.sort()
                    centers.append(row[len(row) // 2])
        for cx, cy in centers:
            row = sorted([r for r in rings if abs(r[1] - cy) < 4.5] + [(cx, cy)])
            gaps = [row[k + 1][0] - row[k][0] for k in range(len(row) - 1)]
            gaps = [g for g in gaps if g > 6]
            if not gaps:
                continue
            buckets = collections.Counter(round(g) for g in gaps)
            common = max(buckets.items(), key=lambda kv: (kv[1], -kv[0]))[0]
            unit = sum(g for g in gaps if abs(g - common) <= 1) / max(1, sum(1 for g in gaps if abs(g - common) <= 1))
            # the name: nearest name line above the diagram, within the column
            above = [l for l in lines if l["y"] < cy - 10 and abs((l["x0"] + l["x1"]) / 2 - cx) < 110]
            if not above:
                continue
            name = max(above, key=lambda l: l["y"])
            defenders = []
            for s in spans:
                t = s["text"]
                if s["size"] < 13.5 or t not in (DL | LB | DB):
                    continue
                if abs(s["x"] - cx) > 150 or not (-12 < cy - s["y"] < 110):
                    continue
                # belongs to the diagram whose center is nearest
                if any(dist((s["x"], s["y"]), o) < dist((s["x"], s["y"]), (cx, cy)) for o in centers if o != (cx, cy)):
                    continue
                role = "DL" if t in DL else "LB" if t in LB else "DB"
                defenders.append({"label": t, "role": role, "x": round((s["x"] - cx) / unit, 2), "y": round((cy - s["y"]) / (unit * Y_SCALE), 2)})
            tes = [s for s in spans if s["text"] in ("Y", "F", "X", "Z") and s["size"] < 10 and abs(s["x"] - cx) < 150 and -8 < s["y"] - cy < 30]
            te = [{"label": s["text"], "x": round((s["x"] - cx) / unit, 2)} for s in tes if not any(dist((s["x"], s["y"]), o) < dist((s["x"], s["y"]), (cx, cy)) for o in centers if o != (cx, cy))]
            if not defenders:
                continue
            fronts.append({"name": re.sub(r"\s+", " ", name["text"]).strip(), "group": group, "page": pageno, "pageTitle": title, "unit": round(unit, 2), "defenders": sorted(defenders, key=lambda d: d["x"]), "offense": te})
    json.dump({"_generated": "Written by scripts/rams/extract_fronts.py from the Rams 2022 Defensive Identification diagrams. Positions and names only.", "fronts": fronts}, open(out, "w", encoding="utf-8"), indent=1)
    for f in fronts:
        print(f"p{f['page']} {f['name'].ljust(20)} {f['group'].ljust(13)} {' '.join(d['label'] + '(' + str(d['x']) + ',' + str(d['y']) + ')' for d in f['defenders'])}")
    print(len(fronts), "fronts")


if __name__ == "__main__":
    main()
