"""Find the ruled grid cells on every page render (300 DPI).

  python scripts/playbook/detect_cells.py [first] [last] [--debug]

Cells are the white regions enclosed by the book's thick ruled lines. A narrow strip sitting directly on
top of a region with the same left/right edges is that cell's header (formation line + call line).
Writes source/cells/p-NNN.json:
  {"page": n, "size": [w, h], "cells": [{"id": "c1", "bbox": [x0,y0,x1,y1], "header": [..]|null,
   "body": [..], "cutLeft": bool, "cutRight": bool}]}
--debug also writes source/cells/debug/p-NNN.png with the boxes drawn.
"""
import json
import os
import sys

import cv2
import numpy as np

args = [a for a in sys.argv[1:] if not a.startswith("--")]
DEBUG = "--debug" in sys.argv
first = int(args[0]) if args else 1
last = int(args[1]) if len(args) > 1 else 477
OUT = os.path.join("source", "cells")
os.makedirs(os.path.join(OUT, "debug"), exist_ok=True)


def rule_mask(gray, thin=False):
    """Thick, long, straight dark strokes: the grid, not the diagrams.
    thin=True is the fallback for pages ruled with hairlines: no erosion, longer runs required."""
    h, w = gray.shape
    dark = (gray < (170 if thin else 120)).astype(np.uint8) * 255
    # grid rules are >= 3 px thick at 300 DPI; route lines are ~2-3 px. Erode a little first.
    thick = dark if thin else cv2.erode(dark, np.ones((3, 3), np.uint8))
    hk = cv2.getStructuringElement(cv2.MORPH_RECT, (int(w * (0.3 if thin else 0.22)), 1))
    vk = cv2.getStructuringElement(cv2.MORPH_RECT, (1, int(h * (0.2 if thin else 0.12))))
    hor = cv2.morphologyEx(thick, cv2.MORPH_OPEN, hk)
    ver = cv2.morphologyEx(thick, cv2.MORPH_OPEN, vk)
    lines = cv2.dilate(cv2.bitwise_or(hor, ver), np.ones((7, 7), np.uint8))
    return lines, hor, ver


def regions(lines):
    h, w = lines.shape
    # close the scan's cropped edges so cells cut by the crop still close
    framed = lines.copy()
    framed[:, :4] = 255
    framed[:, -4:] = 255
    free = cv2.bitwise_not(framed)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(free, connectivity=4)
    out = []
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if bw < w * 0.12 or bh < 40:
            continue
        if area < bw * bh * 0.92:  # margins wrap around the grid; cells are rectangles
            continue
        if bw > w * 0.97 and bh > h * 0.9:
            continue
        out.append([int(x), int(y), int(x + bw), int(y + bh)])
    return out


def segments(mask, axis):
    """Connected rule segments: (pos, start, end) with pos = centre y (horizontal) or x (vertical)."""
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    segs = []
    for i in range(1, n):
        x, y, bw, bh, _ = stats[i]
        if axis == "h":
            segs.append((y + bh // 2, x, x + bw))
        else:
            segs.append((x + bw // 2, y, y + bh))
    return segs


def cluster(vals, gap=30):
    vals = sorted(vals)
    out = []
    for v in vals:
        if out and v - out[-1][-1] < gap:
            out[-1].append(v)
        else:
            out.append([v])
    return [int(sum(c) / len(c)) for c in out]


def lattice(hor, ver, w, h):
    """Open grids (no outer border on the cropped side or the bottom): build cells from rule positions.
    Neighbouring lattice boxes are merged unless a rule runs along most of their shared edge."""
    hs, vs = segments(hor, "h"), segments(ver, "v")
    if len(hs) < 2 or not vs:
        return []
    gx0 = min([s[1] for s in hs] + [s[0] for s in vs])
    gx1 = max([s[2] for s in hs] + [s[0] for s in vs])
    gy0 = min([s[0] for s in hs] + [s[1] for s in vs])
    gy1 = max([s[0] for s in hs] + [s[2] for s in vs])
    xs = cluster([gx0, gx1] + [s[0] for s in vs])
    ys = cluster([gy0, gy1] + [s[0] for s in hs])
    lines = cv2.dilate(cv2.bitwise_or(hor, ver), np.ones((9, 9), np.uint8))

    def ruled(x0, y0, x1, y1):
        strip = lines[y0:y1 + 1, x0:x1 + 1]
        if strip.size == 0:
            return False
        along = strip.max(axis=0 if y0 == y1 else 1) if False else None
        if y1 - y0 <= 1:  # horizontal edge
            return (lines[max(y0 - 5, 0):y0 + 6, x0:x1].max(axis=0) > 0).mean() > 0.6
        return (lines[y0:y1, max(x0 - 5, 0):x0 + 6].max(axis=1) > 0).mean() > 0.6

    R, C = len(ys) - 1, len(xs) - 1
    parent = list(range(R * C))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for r in range(R):
        for c in range(C):
            if c + 1 < C and not ruled(xs[c + 1], ys[r], xs[c + 1], ys[r + 1]):
                parent[find(r * C + c)] = find(r * C + c + 1)
            if r + 1 < R and not ruled(xs[c], ys[r + 1], xs[c + 1], ys[r + 1]):
                parent[find(r * C + c)] = find((r + 1) * C + c)
    groups = {}
    for r in range(R):
        for c in range(C):
            groups.setdefault(find(r * C + c), []).append((r, c))
    out = []
    for g in groups.values():
        x0 = xs[min(c for _, c in g)]; x1 = xs[max(c for _, c in g) + 1]
        y0 = ys[min(r for r, _ in g)]; y1 = ys[max(r for r, _ in g) + 1]
        if len(g) != (max(r for r, _ in g) - min(r for r, _ in g) + 1) * (max(c for _, c in g) - min(c for _, c in g) + 1):
            continue  # not a rectangle
        if x1 - x0 < w * 0.12 or y1 - y0 < 40:
            continue
        out.append([int(x0) + 4, int(y0) + 4, int(x1) - 4, int(y1) - 4])
    return out


def merge_headers(rects, page_h):
    """A strip (< 160 px tall) whose bottom touches the top of a same-width region is that region's header."""
    rects = sorted(rects, key=lambda r: (r[1], r[0]))
    used = set()
    cells = []
    for i, r in enumerate(rects):
        if i in used:
            continue
        hgt = r[3] - r[1]
        if hgt < 170:
            for j, b in enumerate(rects):
                if j == i or j in used:
                    continue
                if abs(b[0] - r[0]) < 25 and abs(b[2] - r[2]) < 25 and 0 <= b[1] - r[3] < 30 and b[3] - b[1] > hgt:
                    used.add(i)
                    used.add(j)
                    cells.append({"bbox": [min(r[0], b[0]), r[1], max(r[2], b[2]), b[3]], "header": r, "body": b})
                    break
    for i, r in enumerate(rects):
        if i not in used:
            cells.append({"bbox": r, "header": None, "body": r})
    # reading order: rows (tops within 90 px), then left to right
    cells.sort(key=lambda c: c["bbox"][1])
    rows = []
    for c in cells:
        if rows and c["bbox"][1] - rows[-1][0]["bbox"][1] < 90:
            rows[-1].append(c)
        else:
            rows.append([c])
    return [c for row in rows for c in sorted(row, key=lambda c: c["bbox"][0])]


for n in range(first, last + 1):
    path = os.path.join("source", "pages", f"p-{n:03d}.png")
    img = cv2.imread(path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    lines, hor, ver = rule_mask(gray)
    cells = merge_headers(regions(lines), h)
    if len(cells) < 2:
        thin_cells = merge_headers(regions(rule_mask(gray, thin=True)[0]), h)
        if len(thin_cells) > len(cells):
            cells = thin_cells
    if len(cells) < 3:
        for thin in (False, True):
            _, hh, vv = rule_mask(gray, thin=thin)
            lat = merge_headers(lattice(hh, vv, w, h), h)
            if len(lat) > len(cells):
                cells = lat
    for k, c in enumerate(cells, start=1):
        c["id"] = f"c{k}"
        c["cutLeft"] = c["bbox"][0] <= 6
        c["cutRight"] = c["bbox"][2] >= w - 6
    with open(os.path.join(OUT, f"p-{n:03d}.json"), "w") as f:
        json.dump({"page": n, "size": [w, h], "cells": cells}, f)
    if DEBUG:
        dbg = img.copy()
        for c in cells:
            x0, y0, x1, y1 = c["bbox"]
            cv2.rectangle(dbg, (x0, y0), (x1, y1), (0, 0, 255), 6)
            if c["header"]:
                hx0, hy0, hx1, hy1 = c["header"]
                cv2.rectangle(dbg, (hx0, hy0), (hx1, hy1), (255, 0, 0), 4)
            cv2.putText(dbg, c["id"], (x0 + 10, y1 - 15), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 4)
        cv2.imwrite(os.path.join(OUT, "debug", f"p-{n:03d}.png"), cv2.resize(dbg, (w // 2, h // 2)))
    print(n, len(cells), flush=True)
