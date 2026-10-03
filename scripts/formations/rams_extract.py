"""
Read the formation diagrams out of the Rams 2022 general section (a vector PDF: real circles, real letters).

    python scripts/formations/rams_extract.py "<01. General Section 2022 Final.pdf>" source/rams-2022/formations.raw.json [first last]

For every diagram on pages first..last (default 14..32): the center square, the title printed above it,
and every lettered player (X Y Z F H Q) with his offset from the center in LINE SPLITS (one unit = the
distance between two neighbouring linemen), dx + to the right, dy + behind the line. Also the split
marks near it (-5-, -3-, #). Nothing is interpreted here; scripts/formations/rams_build.py does that.
The output holds positions and formation names only, no book text.
"""
import json
import re
import sys

import pymupdf

LETTERS = {"X", "Y", "Z", "F", "H", "Q", "D", "HR"}
MARKS = {"-5-", "-3-", "#", "-1-", "-2-"}


def squares_and_circles(page):
    sq, circ = [], []
    for d in page.get_drawings():
        r = d["rect"]
        w, h = r.width, r.height
        if not (8 < w < 30 and 8 < h < 30 and abs(w - h) < 3):
            continue
        kinds = {it[0] for it in d["items"]}
        fill = d.get("fill")
        if "c" in kinds and fill is not None and sum(fill) < 0.3:  # the filled circle some pages use for the center
            sq.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, w))
        elif "c" in kinds:
            circ.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, w))
        elif kinds <= {"re", "l", "qu"}:
            sq.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, w))
    return sq, circ


def main():
    pdf, out = sys.argv[1], sys.argv[2]
    first, last = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (14, 32)
    doc = pymupdf.open(pdf)
    cells = []
    for n in range(first, last + 1):
        page = doc[n - 1]
        sq, circ = squares_and_circles(page)
        # dedupe squares drawn twice (fill + stroke)
        centers = []
        for s in sorted(sq):
            if not any(abs(s[0] - c[0]) < 4 and abs(s[1] - c[1]) < 4 for c in centers):
                centers.append(s)
        words = [(round((w[0] + w[2]) / 2, 1), round((w[1] + w[3]) / 2, 1), w[4]) for w in page.get_text("words")]
        lines = {}
        for b in page.get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                text = " ".join(s["text"] for s in ln["spans"]).strip()
                if text:
                    x0, y0, x1, y1 = ln["bbox"]
                    lines[((x0 + x1) / 2, (y0 + y1) / 2)] = text
        for cx, cy, size in centers:
            # line split = distance to the nearest unlettered circle on the same row
            row = sorted(abs(c[0] - cx) for c in circ if abs(c[1] - cy) < 4 and abs(c[0] - cx) > 4)
            if not row:
                continue
            u = row[0]
            line_x = [c[0] for c in circ if abs(c[1] - cy) < 4 and abs(c[0] - cx) < 2.6 * u]
            players, marks = [], []
            for x, y, t in words:
                if abs(x - cx) > 290 or not (-40 < y - cy < 110):
                    continue
                # belongs to this diagram only if no other center is closer
                if any(abs(x - o[0]) + abs(y - o[1]) < abs(x - cx) + abs(y - cy) for o in centers if o is not (cx, cy, size) and (o[0], o[1]) != (cx, cy)):
                    continue
                if t in LETTERS:
                    players.append({"spot": t, "dx": round((x - cx) / u, 2), "dy": round((y - cy) / u, 2)})
                elif t in MARKS or re.fullmatch(r"-\d-", t):
                    marks.append({"mark": t, "dx": round((x - cx) / u, 2), "dy": round((y - cy) / u, 2)})
            # title: the nearest text line above the center that names a formation (has RT / LT in it)
            title = None
            best = 1e9
            for (lx, ly), text in lines.items():
                if 15 < cy - ly < 110 and abs(lx - cx) < 150 and re.search(r"\b(RT|LT|RIGHT|LEFT)\b", text):
                    d = (cy - ly) + abs(lx - cx) * 0.3
                    if d < best:
                        best, title = d, re.sub(r"\s+", " ", text)
            cells.append({"page": n, "title": title, "unit": round(u, 1), "line": sorted(round((x - cx) / u, 2) for x in line_x), "players": sorted(players, key=lambda p: p["dx"]), "marks": marks})
    json.dump(cells, open(out, "w", encoding="utf-8"), indent=1)
    print(len(cells), "diagrams")
    for c in cells:
        print(c["page"], (c["title"] or "?").ljust(34), " ".join(f"{p['spot']}({p['dx']},{p['dy']})" for p in c["players"]), " ".join(m["mark"] + f"@{m['dx']}" for m in c["marks"]))


if __name__ == "__main__":
    main()
