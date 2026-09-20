"""Pass 1, step 1: read the ROUTE TREE table pages (p-071..p-103) into raw records.

Each page is a 3-column table: ROUTE NAME | DESCRIPTION/ADJUSTMENTS | ROUTE (a small diagram).
Plain OCR text interleaves the columns, so this uses the word boxes from ocr.mjs plus the
table's horizontal rules (found in the page image) to cut the page into rows and columns.

  python scripts/playbook/parse_route_pages.py [first] [last]

Output (gitignored, verbatim book text): data/packers-2019/local/routes.raw.json
"""
import json
import os
import re
import sys

import numpy as np
import pymupdf

ROOT = os.path.join("data", "packers-2019")
first = int(sys.argv[1]) if len(sys.argv) > 1 else 71
last = int(sys.argv[2]) if len(sys.argv) > 2 else 103


def page_pixels(n):
    pix = pymupdf.Pixmap(os.path.join(ROOT, "ocr", "png", f"p-{n:03d}.png"))
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, 0]


def column_edges(img, words):
    """x of the two vertical rules on either side of the DESCRIPTION column (pages are scanned at different offsets)."""
    h, w = img.shape
    band = img[int(h * 0.15) : int(h * 0.9), :] < 110
    dark = band.mean(axis=0)
    xs = [x for x in range(w) if dark[x] > 0.6]
    groups = []
    for x in xs:
        if groups and x - groups[-1][-1] <= 3:
            groups[-1].append(x)
        else:
            groups.append([x])
    mids = [sum(g) / len(g) for g in groups]
    head = next((wd for wd in words if wd[0].upper().startswith("DESCRIPTION")), None)
    if head is None:
        return None
    left = [m for m in mids if m < head[1]]
    right = [m for m in mids if m > head[3]]
    if not left or not right:
        return None
    return (max(left), min(right))


def row_rules(img, x0, x1):
    """y of every horizontal table rule between the two column edges."""
    seg = img[:, int(x0) + 8 : int(x1) - 8] < 110
    dark = seg.mean(axis=1)
    ys = [y for y in range(img.shape[0]) if dark[y] > 0.85]
    groups = []
    for y in ys:
        if groups and y - groups[-1][-1] <= 4:
            groups[-1].append(y)
        else:
            groups.append([y])
    return [sum(g) / len(g) for g in groups]


def lines_of(words):
    """Group words into text lines (top to bottom, left to right)."""
    words = sorted(words, key=lambda w: ((w[2] + w[4]) / 2, w[1]))
    lines = []
    for w in words:
        cy = (w[2] + w[4]) / 2
        if lines and abs(lines[-1]["cy"] - cy) < max(8, (w[4] - w[2]) * 0.6):
            lines[-1]["words"].append(w)
        else:
            lines.append({"cy": cy, "words": [w]})
    out = []
    for ln in lines:
        ws = sorted(ln["words"], key=lambda w: w[1])
        out.append({"text": " ".join(w[0] for w in ws), "h": max(w[4] - w[2] for w in ws), "conf": min(w[5] for w in ws)})
    return out


records = []
for n in range(first, last + 1):
    wpath = os.path.join(ROOT, "ocr", "words", f"p-{n:03d}.json")
    if not os.path.exists(wpath):
        print(f"p-{n:03d}: no OCR yet")
        continue
    words = [w for w in json.load(open(wpath, encoding="utf-8")) if w[0].strip()]
    img = page_pixels(n)
    edges = column_edges(img, words)
    if edges is None:
        print(f"p-{n:03d}: no DESCRIPTION column found")
        continue
    cx0, cx1 = edges
    rules = row_rules(img, cx0, cx1)
    if len(rules) < 3:
        print(f"p-{n:03d}: no table found ({len(rules)} rules)")
        continue
    title = " ".join(w[0] for w in words if (w[2] + w[4]) / 2 < rules[0] and w[4] - w[2] > 25)
    # rules[0..1] bracket the header row; every later pair brackets one route
    for top, bottom in zip(rules[1:], rules[2:]):
        if bottom - top < 60:
            continue
        inside = [w for w in words if top < (w[2] + w[4]) / 2 < bottom]
        name_lines = lines_of([w for w in inside if (w[1] + w[3]) / 2 < cx0])
        desc_lines = lines_of([w for w in inside if cx0 <= (w[1] + w[3]) / 2 < cx1])
        diagram = lines_of([w for w in inside if (w[1] + w[3]) / 2 >= cx1])
        if not name_lines and not desc_lines:
            continue
        if any(l["text"].upper().startswith("DESCRIPTION") for l in desc_lines[:1]):
            continue  # the header row
        big = max((l["h"] for l in name_lines), default=0)
        name = " ".join(l["text"] for l in name_lines if l["h"] >= big * 0.8)
        qualifiers = [l["text"] for l in name_lines if l["h"] < big * 0.8]
        records.append(
            {
                "source_page": n,
                "page_title": title,
                "name": re.sub(r"\s+", " ", name).strip(),
                "name_qualifiers": qualifiers,
                "description_verbatim": "\n".join(l["text"] for l in desc_lines),
                "diagram_labels": [l["text"] for l in diagram],
                "min_word_confidence": min([l["conf"] for l in desc_lines] or [0]),
            }
        )

os.makedirs(os.path.join(ROOT, "local"), exist_ok=True)
out = os.path.join(ROOT, "local", "routes.raw.json")
json.dump(records, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"{len(records)} route rows from pages {first}-{last} -> {out}")
