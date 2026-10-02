"""Rebuild a playbook diagram cell as PlayForge vector data, and score the rebuild against the scan.

  python scripts/playbook/vectorize.py <page> [cellId] [--debug]
  python scripts/playbook/vectorize.py --all [first last]

Reads source/pages/p-NNN.png, source/cells/p-NNN.json, source/ocr/p-NNN.json and (when present) the
corrected transcription source/book/pages/p-NNN.json. Writes source/vector/p-NNN.json:
  {cellId: {"diagram": {players, paths, annotations} in yards, "frame": {...}, "score": {...},
            "confidence": "high"|"medium"|"low", "issues": [...]}}

Method (drawing-faithful, nothing inferred from football knowledge):
  players   closed rings / squares in the black ink (holes of the ink mask), filled navy discs (HB);
            the letter inside a ring is read with the OCR recogniser after the ring is blanked out.
  defenders coloured letters (blue / green / brown) read by OCR, placed where they are printed.
  lines     ink minus players and text, thinned to a skeleton, traced into polylines; short collinear
            pieces are chained into dashed / dotted lines; thick blobs at an end are arrowheads or dots;
            a short crossbar at an end is a block T.
  frame     yards = pixels / (OL centre spacing in px); x = 0 at the centre square, y = 0 at its row.
  score     the vector is drawn back onto a blank mask; recall = scan ink that the vector covers,
            precision = vector ink that lands on scan ink. Both feed the confidence flag.
"""
import json
import math
import os
import re
import sys
from collections import Counter

import cv2
import numpy as np
from skimage.morphology import skeletonize

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glyphs  # noqa: E402
import cellgeom  # noqa: E402

ROOT = os.path.join("source")
OUT = os.path.join(ROOT, "vector")
os.makedirs(os.path.join(OUT, "debug"), exist_ok=True)
SYMBOL_R = 0.42  # PlayForge circle radius in yards (OL centres are 1 yd apart)

_ocr = None


def ocr():
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr = RapidOCR()
    return _ocr


def rec(img):
    """Recognise one short word in a small crop (no detection stage)."""
    if img.size == 0:
        return "", 0.0
    h, w = img.shape[:2]
    scale = max(1.0, 64.0 / max(h, 1))
    big = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    big = cv2.copyMakeBorder(big, 16, 16, 24, 24, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    res, _ = ocr()(big, use_det=False, use_cls=False, use_rec=True)
    if not res:
        return "", 0.0
    t, c = res[0]
    return (t or "").strip(), float(c or 0)


def rec_tight(paper):
    """OCR recogniser on the ink's tight box, scaled to ~40 px tall on white (dark ink on paper)."""
    ys, xs = np.nonzero(paper < 160)
    if len(xs) < 10:
        return "", 0.0
    crop = paper[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    sc = 40.0 / max(crop.shape[0], 1)
    big = cv2.resize(crop, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
    big = cv2.copyMakeBorder(big, 12, 12, 30, 30, cv2.BORDER_CONSTANT, value=255)
    res, _ = ocr()(cv2.cvtColor(big, cv2.COLOR_GRAY2BGR), use_det=False, use_cls=False, use_rec=True)
    if not res:
        return "", 0.0
    return (res[0][0] or "").strip(), float(res[0][1] or 0)


# ---------------------------------------------------------------- colour classes
def colour_masks(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    chroma = S > 90
    m = {}
    m["black"] = ((V < 120) & (S < 110)) | (V < 70)
    m["red"] = chroma & (V >= 150) & ((H <= 8) | (H >= 168))
    m["brown"] = chroma & (V >= 60) & (V < 150) & ((H <= 14) | (H >= 168))
    m["orange"] = chroma & (V >= 120) & (H > 8) & (H <= 20)
    m["yellow"] = chroma & (V >= 150) & (H > 20) & (H <= 34)
    m["green"] = (S > 70) & (V >= 50) & (H > 34) & (H <= 88)
    m["blue"] = (S > 70) & (V >= 60) & (H > 88) & (H <= 135) & ~m["black"]
    m["navy"] = (S > 70) & (V < 120) & (H > 95) & (H <= 135)
    m["bluefill"] = (S > 60) & (V < 235) & (H > 95) & (H <= 135)  # the HB disc: navy to mid blue
    m["purple"] = chroma & (V >= 60) & (H > 135) & (H < 168)
    return {k: v.astype(np.uint8) * 255 for k, v in m.items()}


def dominant_colour(masks, box):
    x0, y0, x1, y1 = [int(v) for v in box]
    best, bestn = "black", 0
    counts = {}
    for k in ("black", "red", "brown", "blue", "green", "orange", "purple"):
        n = int((masks[k][y0:y1, x0:x1] > 0).sum())
        counts[k] = n
    # black outlines around coloured letters are rare; prefer a colour with real coverage
    colourful = {k: v for k, v in counts.items() if k != "black"}
    k2 = max(colourful, key=colourful.get)
    if colourful[k2] > max(12, counts["black"] * 0.35):
        return k2
    return "black" if counts["black"] > 0 else k2


# ---------------------------------------------------------------- players
def find_players(bgr, masks, text_boxes):
    black = masks["black"].copy()
    # thin bridging of ring gaps
    black = cv2.morphologyEx(black, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    contours, hier = cv2.findContours(black, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    cands = []
    if hier is not None:
        for i, cnt in enumerate(contours):
            if hier[0][i][3] < 0:
                continue  # outer boundary; holes have a parent
            area = cv2.contourArea(cnt)
            if area < 150:
                continue
            x, y, w, h = cv2.boundingRect(cnt)
            if not (0.75 < w / max(h, 1) < 1.33):
                continue
            per = cv2.arcLength(cnt, True)
            circ = 4 * math.pi * area / max(per * per, 1)
            fill = area / float(w * h)
            r_in = (w + h) / 4.0
            if r_in < 9 or r_in > 60:
                continue
            kind = None
            if fill > 0.86 and circ < 0.86:
                kind = "square"
            elif circ > 0.72 and 0.68 < fill < 0.86:
                kind = "circle"
            if kind:
                cands.append({"kind": kind, "cx": x + w / 2.0, "cy": y + h / 2.0, "r_in": r_in, "box": [x, y, x + w, y + h]})
    # navy filled discs (HB)
    navy = cv2.morphologyEx(cv2.bitwise_or(masks["navy"], masks["bluefill"]), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    n, lab, stats, cents = cv2.connectedComponentsWithStats(navy)
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < 300 or not (0.75 < w / max(h, 1) < 1.33):
            continue
        if a / float(w * h) < 0.55:
            continue
        # a disc is solid fill: the raw (unclosed) blue covers most of its inscribed circle; a closed-up
        # letter (S, E) does not
        raw = cv2.bitwise_or(masks["navy"], masks["bluefill"])[y:y + h, x:x + w] > 0
        yy, xx = np.ogrid[:h, :w]
        circle = (xx - w / 2) ** 2 + (yy - h / 2) ** 2 <= (min(w, h) / 2 * 0.9) ** 2
        if raw[circle].mean() < 0.4:
            continue
        cnts, _ = cv2.findContours((lab[y:y + h, x:x + w] == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        per = cv2.arcLength(cnts[0], True)
        if 4 * math.pi * a / max(per * per, 1) < 0.75:
            continue
        cands.append({"kind": "disc", "cx": x + w / 2.0, "cy": y + h / 2.0, "r_in": (w + h) / 4.0, "box": [x, y, x + w, y + h]})
    if not cands:
        return [], None
    # the dominant ring size is the player size; drop rings far off it (letters like O, the G logo)
    radii = sorted(c["r_in"] for c in cands if c["kind"] in ("circle", "square"))
    if not radii:
        radii = sorted(c["r_in"] for c in cands)
    r0 = radii[len(radii) // 2]
    players = [c for c in cands if 0.65 * r0 < c["r_in"] < 1.5 * r0]
    # rings inside text boxes are letters (O, D, Q) unless clearly player-sized
    keep = []
    for c in players:
        # an O / D / Q inside a printed word: the word is wider than a player and about letter height
        # (the OCR also boxes the letter inside a real ring, e.g. "HB" on the disc: that box is no wider than the ring)
        inside_text = c["kind"] != "disc" and any(
            b[0] <= c["cx"] <= b[2] and b[1] <= c["cy"] <= b[3] and (b[3] - b[1]) < c["r_in"] * 1.6 and (b[2] - b[0]) > c["r_in"] * 2.6
            for b in text_boxes)
        if not inside_text:
            keep.append(c)
    return keep, r0


OFF_VOCAB = {"X", "Y", "Z", "F", "H", "HB", "T", "Q", "QB", "R", "1", "3", "4", "5", "6", "9"}
OFF_CHARS = "XYZFHBTQR134569"
CELL_VOCAB = None  # ring letters the checked transcription lists for the cell being traced


def read_player_label(bgr, p):
    """Letter(s) inside a ring, or '' for an empty ring (offensive lineman). '?' when unreadable.
    Only glyph-shaped ink counts: lines that cross the ring touch its edge or are long and thin."""
    if p["kind"] == "square":
        return ""
    cx, cy, r = p["cx"], p["cy"], p["r_in"]
    rr = int(r)
    x0, y0 = max(int(cx - rr), 0), max(int(cy - rr), 0)
    crop = bgr[y0:int(cy + rr), x0:int(cx + rr)]
    if crop.size == 0:
        return ""
    g = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    if p["kind"] == "disc":
        g = 255 - g  # white letters on the navy fill
    hh, ww = g.shape
    yy, xx = np.mgrid[0:hh, 0:ww]
    d2 = (xx - (cx - x0)) ** 2 + (yy - (cy - y0)) ** 2
    inside = d2 <= (r * 0.8) ** 2
    ink = ((g < 150) & inside).astype(np.uint8) * 255
    n, lab, stats, _ = cv2.connectedComponentsWithStats(ink)
    keep = np.zeros_like(ink)
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < 8:
            continue
        comp = lab == i
        touches_edge = (d2[comp] > (r * 0.74) ** 2).any()
        long_thin = max(w, h) > r * 1.25 or (max(w, h) > r * 0.7 and min(w, h) < r * 0.18)
        if touches_edge and long_thin:
            continue
        if max(w, h) > r * (1.7 if p["kind"] == "disc" else 1.35):
            continue
        keep[comp] = 255
    ys, xs = np.nonzero(keep)
    if p["kind"] == "disc" and (CELL_VOCAB is None or "HB" in CELL_VOCAB):
        return "HB"  # the book fills only the halfback's circle
    if len(xs) < 25 or (ys.max() - ys.min()) < r * 0.45:
        return ""  # specks or a line stub: an empty ring (lineman / QB)
    paper = np.where(keep > 0, g, 255).astype(np.uint8)
    t, c = rec_tight(paper)
    t = re.sub(r"[^A-Z0-9]", "", t.upper())
    t = {"2": "Z", "7": "Z", "8": "B", "0": "Q"}.get(t, t)  # the book's rings hold Z, not 2 / 7
    vocab = CELL_VOCAB or OFF_VOCAB
    if t in vocab and c >= 0.35:
        return t
    soft = np.where(keep > 0, 255 - g, 0).astype(np.uint8)
    allowed = "".join(sorted(set("".join(vocab)))) if CELL_VOCAB else OFF_CHARS
    txt, sc = glyphs.read_word(keep, allowed=allowed, max_chars=2, soft=soft)
    if txt in vocab and sc >= 0.45:
        return txt
    return "?"


# ---------------------------------------------------------------- skeleton tracing
NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def trace_skeleton(sk):
    """Split a 1-px skeleton into edges between endpoints / junctions. Returns lists of (x, y) points."""
    ys, xs = np.nonzero(sk)
    pts = set(zip(ys.tolist(), xs.tolist()))
    deg = {}
    for (y, x) in pts:
        deg[(y, x)] = sum((y + dy, x + dx) in pts for dy, dx in NB)
    nodes = {p for p, d in deg.items() if d != 2}
    visited = set()
    edges = []

    def walk(start, nxt):
        path = [start, nxt]
        prev, cur = start, nxt
        while cur not in nodes:
            nbrs = [(cur[0] + dy, cur[1] + dx) for dy, dx in NB if (cur[0] + dy, cur[1] + dx) in pts]
            nbrs = [q for q in nbrs if q != prev and q not in path[-3:]]
            if not nbrs:
                break
            prev, cur = cur, nbrs[0]
            path.append(cur)
        return path

    for n in nodes:
        for dy, dx in NB:
            q = (n[0] + dy, n[1] + dx)
            if q in pts:
                key = frozenset((n, q))
                if key in visited:
                    continue
                path = walk(n, q)
                for a, b in zip(path, path[1:]):
                    visited.add(frozenset((a, b)))
                edges.append([(p[1], p[0]) for p in path])
    # pure loops (no nodes)
    rest = [p for p in pts if not any(frozenset((p, (p[0] + dy, p[1] + dx))) in visited for dy, dx in NB)]
    return edges


def plen(pl):
    return sum(math.dist(a, b) for a, b in zip(pl, pl[1:]))


def rdp(points, eps):
    if len(points) < 3:
        return points
    a, b = np.array(points[0], float), np.array(points[-1], float)
    ab = b - a
    L = np.hypot(*ab)
    best, idx = -1, 0
    for i in range(1, len(points) - 1):
        p = np.array(points[i], float)
        d = abs(np.cross(ab, p - a)) / L if L > 0 else np.hypot(*(p - a))
        if d > best:
            best, idx = d, i
    if best > eps:
        return rdp(points[: idx + 1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]


def direction(pl, at_end, span):
    """Unit vector pointing out of the polyline at one end, measured over `span` px."""
    pts = pl if at_end else pl[::-1]
    tip = np.array(pts[-1], float)
    acc = 0.0
    base = tip
    for p in reversed(pts[:-1]):
        acc += math.dist(p, base if acc == 0 else p)
        base = np.array(p, float)
        if math.dist(p, tip) >= span:
            break
    v = tip - base
    n = np.hypot(*v)
    return v / n if n > 0 else np.array([0.0, 0.0])


def erase_glyphs(mask_dst, ink, box, value=255, pad=3):
    """Mark only the ink components that sit wholly inside a text box (the letters), not lines crossing it."""
    H, W = ink.shape
    x0, y0, x1, y1 = [int(v) for v in box]
    X0, Y0, X1, Y1 = max(x0 - 40, 0), max(y0 - 40, 0), min(x1 + 40, W), min(y1 + 40, H)
    sub = ink[Y0:Y1, X0:X1]
    n, lab, stats, _ = cv2.connectedComponentsWithStats(sub)
    region = mask_dst[Y0:Y1, X0:X1]
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        gx0, gy0, gx1, gy1 = x + X0, y + Y0, x + X0 + w, y + Y0 + h
        if gx0 >= x0 - pad and gy0 >= y0 - pad and gx1 <= x1 + pad and gy1 <= y1 + pad:
            region[lab == i] = value


def ring_fallback(bgr, masks, players, r0):
    """Rings the hole test missed (a letter touching the ring splits the hole, a dashed ghost ring has no
    closed hole): Hough circles of the player size whose circumference is mostly ink."""
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    g = cv2.GaussianBlur(g, (5, 5), 1.2)
    found = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1, minDist=r0 * 1.6, param1=110, param2=14,
                             minRadius=int(r0 * 0.85), maxRadius=int(r0 * 1.35))
    out = []
    if found is None:
        return out
    ink = (masks["black"] > 0) | (masks["navy"] > 0)
    H, W = ink.shape
    for cx, cy, r in found[0]:
        if any(math.dist((cx, cy), (p["cx"], p["cy"])) < r0 * 1.5 for p in players + out):
            continue
        hits, total, runs = 0, 0, 0
        prev = None
        for k in range(72):
            a = 2 * math.pi * k / 72
            on = False
            for dr in (-2, -1, 0, 1, 2, 3):
                x, y = int(cx + (r + dr) * math.cos(a)), int(cy + (r + dr) * math.sin(a))
                if 0 <= x < W and 0 <= y < H and ink[y, x]:
                    on = True
                    break
            hits += on
            total += 1
            if prev is not None and on != prev:
                runs += 1
            prev = on
        frac = hits / total
        # the inside must be mostly paper (a ring, not a letter or a blob)
        yy, xx = np.ogrid[:H, :W]
        inner = (xx - cx) ** 2 + (yy - cy) ** 2 <= (r * 0.55) ** 2
        fill = ink[inner].mean() if inner.any() else 1
        if fill > 0.62:
            continue
        if frac >= 0.8:
            out.append({"kind": "circle", "cx": float(cx), "cy": float(cy), "r_in": float(r) - 2, "box": None})
        elif frac >= 0.45 and runs >= 10:
            out.append({"kind": "circle", "cx": float(cx), "cy": float(cy), "r_in": float(r) - 2, "box": None, "dashed": True})
    out += cut_rings(g, ink, players + out, r0)
    return out


def cut_rings(g, ink, players, r0):
    """Players the scan's left / right edge cuts in half: pad the cell with paper, find circles whose centre
    sits near or past the edge, and keep those whose VISIBLE arc is almost all ink."""
    H, W = ink.shape
    P = int(r0 * 1.6)
    gp = cv2.copyMakeBorder(g, 0, 0, P, P, cv2.BORDER_CONSTANT, value=255)
    found = cv2.HoughCircles(gp, cv2.HOUGH_GRADIENT, dp=1, minDist=r0 * 1.6, param1=110, param2=10,
                             minRadius=int(r0 * 0.85), maxRadius=int(r0 * 1.3))
    out = []
    if found is None:
        return out
    for cxp, cy, r in found[0]:
        cx = cxp - P
        if not (cx < r * 0.9 or cx > W - r * 0.9):
            continue  # whole circles are the other tests' job
        if any(math.dist((cx, cy), (p["cx"], p["cy"])) < r0 * 1.5 for p in players + out):
            continue
        vis = hits = 0
        for k in range(72):
            a = 2 * math.pi * k / 72
            x0_ = cx + r * math.cos(a)
            if not (2 <= x0_ < W - 2):
                continue
            vis += 1
            for dr in (-2, -1, 0, 1, 2, 3):
                x, y = int(cx + (r + dr) * math.cos(a)), int(cy + (r + dr) * math.sin(a))
                if 0 <= x < W and 0 <= y < H and ink[y, x]:
                    hits += 1
                    break
        if vis >= 20 and hits / vis >= 0.88:
            out.append({"kind": "circle", "cx": float(cx), "cy": float(cy), "r_in": float(r) - 2, "box": None, "cut": True})
    return out


def find_squares(masks, players, r0):
    """Centre squares the hole test misses (half-shaded squares on the front pages): outer contours of the
    ink that are squares of player size."""
    if any(p["kind"] == "square" for p in players):
        return []
    black = masks["black"]
    cnts, _ = cv2.findContours(black, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if not (r0 * 1.5 <= w <= r0 * 2.8 and r0 * 1.5 <= h <= r0 * 2.8 and 0.8 < w / h < 1.25):
            continue
        approx = cv2.approxPolyDP(c, 0.04 * cv2.arcLength(c, True), True)
        if len(approx) != 4 or cv2.contourArea(c) / float(w * h) < 0.9:
            continue  # a circle fills ~0.79 of its box, a square ~1
        cy = y + h / 2.0
        if sum(1 for p in players if abs(p["cy"] - cy) < r0 * 0.6 and p["kind"] == "circle") < 2:
            continue  # the centre stands in the line with the other linemen
        out.append({"kind": "square", "cx": x + w / 2.0, "cy": y + h / 2.0, "r_in": (w + h) / 4.0 - 3, "box": [x, y, x + w, y + h]})
    return out[:1]


def ring_score(ink, cx, cy, r):
    H, W = ink.shape
    hits = 0
    for k in range(72):
        a = 2 * math.pi * k / 72
        for dr in (-2, -1, 0, 1, 2):
            x, y = int(cx + (r + dr) * math.cos(a)), int(cy + (r + dr) * math.sin(a))
            if 0 <= x < W and 0 <= y < H and ink[y, x]:
                hits += 1
                break
    return hits / 72.0


def probe_line_slots(masks, players, r0):
    """Linemen sit at even spacing either side of the centre: look for a ring at each empty slot
    (a half-shaded ring has no closed hole, so the hole test cannot see it)."""
    sq = [p for p in players if p["kind"] == "square"]
    if not sq:
        return []
    c = sq[0]
    row = sorted([p for p in players if abs(p["cy"] - c["cy"]) < r0 * 0.6], key=lambda p: p["cx"])
    gaps = [b["cx"] - a["cx"] for a, b in zip(row, row[1:]) if b["cx"] - a["cx"] < r0 * 3.2]
    step = float(np.median(gaps)) if gaps else r0 * 2.4
    ink = masks["black"] > 0
    out = []
    for k in (-2, -1, 1, 2):
        x = c["cx"] + k * step
        if any(abs(p["cx"] - x) < r0 * 0.8 and abs(p["cy"] - c["cy"]) < r0 * 0.8 for p in players + out):
            continue
        r_try = max((p["r_in"] for p in row if p["kind"] == "circle"), default=r0)
        if ring_score(ink, x, c["cy"], r_try + 1) >= 0.75:
            out.append({"kind": "circle", "cx": float(x), "cy": float(c["cy"]), "r_in": float(r_try), "box": None})
    return out


def shade_of(masks, p):
    """Visio-style technique shading: the left or right half (or all) of a lineman's symbol filled black."""
    if p["kind"] == "disc":
        return "full"
    ink = masks["black"] > 0
    H, W = ink.shape
    r = p["r_in"] * 0.75
    yy, xx = np.ogrid[:H, :W]
    inside = (xx - p["cx"]) ** 2 + (yy - p["cy"]) ** 2 <= r * r if p["kind"] != "square" else (abs(xx - p["cx"]) <= r) & (abs(yy - p["cy"]) <= r)
    left = inside & (xx < p["cx"] - 2)
    right = inside & (xx > p["cx"] + 2)
    fl = ink[left].mean() if left.any() else 0
    fr = ink[right].mean() if right.any() else 0
    if fl > 0.7 and fr > 0.7:
        return "full"
    if fl > 0.7 and fr < 0.3:
        return "left"
    if fr > 0.7 and fl < 0.3:
        return "right"
    return "none"


def merge_straight(edges, r0):
    """Join skeleton edges that meet end to end and continue in the same direction (crossings split them)."""
    edges = [list(e) for e in edges]
    changed = True
    while changed:
        changed = False
        best = None
        for i in range(len(edges)):
            for j in range(i + 1, len(edges)):
                for ai, at_end_i in ((0, False), (-1, True)):
                    for aj, at_end_j in ((0, False), (-1, True)):
                        if math.dist(edges[i][ai], edges[j][aj]) > 6:
                            continue
                        di = direction(edges[i], at_end_i, r0)
                        dj = direction(edges[j], at_end_j, r0)
                        dot = float(np.dot(di, dj))
                        if dot < -0.88 and (best is None or dot < best[0]):
                            best = (dot, i, j, at_end_i, at_end_j)
        if best:
            _, i, j, ei, ej = best
            a = edges[i] if ei else edges[i][::-1]
            b = edges[j][::-1] if ej else edges[j]
            edges[i] = a + b
            del edges[j]
            changed = True
    return edges


def merge_through_players(edges, players, r0):
    """A line drawn straight through a player symbol is one line: join the two pieces the symbol cut."""
    edges = [list(e) for e in edges]
    for pl in players:
        c = (pl["cx"], pl["cy"])
        lim = pl["r_in"] * (1.45 if pl["kind"] == "square" else 1.0) + 10
        joined = True
        while joined:
            joined = False
            ends = []
            for i, e in enumerate(edges):
                for at_end in (False, True):
                    pt = e[-1] if at_end else e[0]
                    if math.dist(pt, c) < lim:
                        ends.append((i, at_end))
            best = None
            for a in range(len(ends)):
                for b in range(a + 1, len(ends)):
                    (i, ei), (j, ej) = ends[a], ends[b]
                    if i == j:
                        continue
                    di = direction(edges[i], ei, r0 * 1.5)
                    dj = direction(edges[j], ej, r0 * 1.5)
                    # the gap between the two ends must run along both pieces (straight through)
                    pa = np.array(edges[i][-1] if ei else edges[i][0], float)
                    pb = np.array(edges[j][-1] if ej else edges[j][0], float)
                    gap = pb - pa
                    gl = np.hypot(*gap)
                    if gl < 1:
                        continue
                    g = gap / gl
                    score = float(np.dot(di, g)) + float(np.dot(dj, -g))
                    if np.dot(di, dj) < -0.9 and score > 1.8 and (best is None or score > best[0]):
                        best = (score, i, ei, j, ej)
            if best:
                _, i, ei, j, ej = best
                a = edges[i] if ei else edges[i][::-1]
                b = edges[j][::-1] if ej else edges[j]
                edges[i] = a + b
                del edges[j]
                joined = True
    return edges


# ---------------------------------------------------------------- main per cell
DEF_CHARS = "ABCDEFJKLMNPRSTW$"
DEF_TOKENS = re.compile(r"^(E|T|N|S|W|M|P|B|C|R|F|DT|DE|NT|FS|SS|NW|NS|WS|SC|\$|E\$|NB|CB|LB|SAM|MIKE|WILL)$", re.I)


def vectorize_cell(page, cell, bgr_page, ocr_rows, transcription=None, debug=False):
    x0, y0, x1, y1 = cell["body"] if cell.get("body") else cell["bbox"]
    pad = 2
    x0, y0, x1, y1 = x0 + pad, y0 + pad, x1 - pad, y1 - pad
    bgr = bgr_page[y0:y1, x0:x1].copy()
    H, W = bgr.shape[:2]
    masks = colour_masks(bgr)
    # solid coloured callout boxes ("4 CALL", red / yellow notes) are captions, not players or lines:
    # paint them out before anything else looks at the drawing
    callouts = []
    solid = cv2.bitwise_or(cv2.bitwise_or(masks["bluefill"], masks["red"]), cv2.bitwise_or(masks["yellow"], masks["green"]))
    solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(solid)
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < W * H * 0.002 or w < 30 or h < 14:
            continue
        if a / float(w * h) < 0.85:
            continue  # a box fills its bounding rectangle; a ring with a line through it does not
        if 0.75 < w / max(h, 1) < 1.33:
            continue  # round-ish: an HB disc, not a box
        callouts.append([int(x), int(y), int(x + w), int(y + h)])
        cv2.rectangle(bgr, (x - 3, y - 3), (x + w + 3, y + h + 3), (255, 255, 255), -1)
    if callouts:
        masks = colour_masks(bgr)
    issues = []

    # text boxes from the OCR (cell-relative), minus the header lines at the top
    texts = []
    for row in ocr_rows:
        bx = [min(p[0] for p in row["box"]) - x0, min(p[1] for p in row["box"]) - y0,
              max(p[0] for p in row["box"]) - x0, max(p[1] for p in row["box"]) - y0]
        cxr, cyr = (bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2
        if not (0 <= cxr <= W and 0 <= cyr <= H):
            continue
        texts.append({"box": bx, "text": row["text"].strip(), "conf": row["conf"]})
    tlines = [re.sub(r"[^A-Z0-9]", "", l.upper()) for l in (transcription or {}).get("lines", [])]
    tlabels = [l for l in (transcription or {}).get("labels", []) if l.get("at")]

    players, r0 = find_players(bgr, masks, [t["box"] for t in texts])
    if r0 is None:
        return None  # not a diagram this method can read (text table, photo, empty cell)
    if len(players) < 2:
        # a blocking-term drawing has two or three linemen, some half-shaded (no closed hole): look harder
        players += ring_fallback(bgr, masks, players, r0)
        players += find_squares(masks, players, r0)
        if not players:
            return None
    for q in ring_fallback(bgr, masks, players, r0):
        if any(t["box"][0] <= q["cx"] <= t["box"][2] and t["box"][1] <= q["cy"] <= t["box"][3]
               and re.search(r"[A-NP-Z1-9+]", t["text"].upper()) for t in texts):
            continue  # a round letter (C, G, S) of a printed word, not a player
        players.append(q)
    players += find_squares(masks, players, r0)
    players += probe_line_slots(masks, players, r0)
    for p in players:
        p["shade"] = shade_of(masks, p)
    for p in players:  # a ring found by its holes but filled navy is the HB disc
        if p["kind"] == "circle":
            yy, xx = np.ogrid[:H, :W]
            inner = (xx - p["cx"]) ** 2 + (yy - p["cy"]) ** 2 <= (p["r_in"] * 0.8) ** 2
            if (cv2.bitwise_or(masks["navy"], masks["bluefill"])[inner] > 0).mean() > 0.35:
                p["kind"] = "disc"
    for p in players:
        p["label"] = "" if p.get("shade") in ("left", "right") or (p.get("shade") == "full" and p["kind"] != "disc") else read_player_label(bgr, p)
        if p.get("cut") and not p["label"]:
            p["label"] = "?"  # half a ring at the scan edge: its letter is off the page, the page's list may name it

    # title lines printed inside the cell (cells without a ruled header strip) are not diagram labels
    header_boxes = []
    if tlines:
        for t in texts:
            k = re.sub(r"[^A-Z0-9]", "", t["text"].upper().replace("0", "O"))
            if t["box"][1] < H * 0.3 and k and any(k in l.replace("0", "O") or l.replace("0", "O") in k for l in tlines if len(l) >= 3):
                header_boxes.append(t["box"])
    elif not cell.get("header"):
        for t in texts:
            bx = t["box"]
            if bx[1] < H * 0.22 and len(t["text"]) >= 5 and abs((bx[0] + bx[2]) / 2 - W / 2) < W * 0.22 and bx[3] < min(p["cy"] for p in players):
                header_boxes.append(bx)
    texts = [t for t in texts if t["box"] not in header_boxes]

    # frame from the OL row: the square (centre) and the empty rings beside it
    squares = [p for p in players if p["kind"] == "square"]
    if squares:
        ctr = max(squares, key=lambda q: sum(1 for o in players if abs(o["cy"] - q["cy"]) < q["r_in"] * 0.5))
        row = sorted([q for q in players if abs(q["cy"] - ctr["cy"]) < ctr["r_in"] * 0.6], key=lambda q: q["cx"])
        gaps = [b["cx"] - a["cx"] for a, b in zip(row, row[1:]) if b["cx"] - a["cx"] < ctr["r_in"] * 3.2]
        spacing = float(np.median(gaps)) if gaps else (r0 + 2) / SYMBOL_R
        ox, oy = ctr["cx"], ctr["cy"]
    else:
        spacing = (r0 + 2) / SYMBOL_R  # ring outer radius = SYMBOL_R yards
        ox, oy = W / 2.0, max(p["cy"] for p in players)
        issues.append("no centre square: frame centred on the cell")
    s = spacing  # px per yard

    def to_yd(px, py):
        return round((px - ox) / s, 3), round((oy - py) / s, 3)

    # rings on the line inside the tackles are linemen: a line crossing one is not a letter
    if squares:
        for p in players:
            if p["label"] == "?" and abs(p["cy"] - oy) < s * 0.3 and abs(p["cx"] - ox) < s * 2.5:
                p["label"] = ""

    # ---- boxed captions ("MAN TO MAN", "4 MAN RUSH", "25 FRONT"): black-ruled rectangles wider than a
    # player, mostly empty inside. They are captions (the page transcription carries their words), not lines.
    frames = []
    cnts, _ = cv2.findContours(masks["black"], cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if w < r0 * 3 or h < r0 * 1.0 or w > W * 0.8:
            continue
        approx = cv2.approxPolyDP(c, 0.03 * cv2.arcLength(c, True), True)
        if len(approx) != 4 or cv2.contourArea(c) < w * h * 0.85:
            continue
        inner = masks["black"][y + 4:y + h - 4, x + 4:x + w - 4]
        if inner.size and (inner > 0).mean() < 0.3:
            frames.append([x, y, x + w, y + h])

    def in_frame_or_header(bx):
        cx, cy = (bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2
        return any(f[0] <= cx <= f[2] and f[1] <= cy <= f[3] for f in frames + header_boxes)

    # ---- defenders: coloured letter words, read glyph by glyph
    defenders = []
    word_cands = []
    tdef = [re.sub(r"[^A-Za-z$]", "", d) for d in (transcription or {}).get("defenders", [])]
    tdef = [d[0].upper() + d[1:].lower() if d.lower() == "nw" else d.upper() for d in tdef if d]
    use_t = transcription is not None and transcription.get("kind") == "diagram"
    for col in ("blue", "green", "brown", "red", "purple") + (("black",) if tdef else ()):
        # a black line drawn through a coloured letter splits it: close small gaps first
        m = cv2.morphologyEx(masks[col], cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 7)))
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
        comps = [stats[i] for i in range(1, n) if r0 * 0.7 <= stats[i][3] <= r0 * 2.6 and stats[i][2] <= r0 * 2.4 and stats[i][4] >= 30]
        comps = sorted(comps, key=lambda q: q[0])
        words = []
        for x, y, w, h, a in comps:
            for wd in words:
                X0, Y0, X1, Y1 = wd
                hh = Y1 - Y0
                if abs((y + h / 2) - (Y0 + Y1) / 2) < hh * 0.35 and -2 <= x - X1 < hh * 0.4 and abs(h - hh) < hh * 0.4:
                    wd[:] = [X0, min(Y0, y), x + w, max(Y1, y + h)]
                    break
            else:
                words.append([x, y, x + w, y + h])
        for X0, Y0, X1, Y1 in words:
            if in_frame_or_header([X0, Y0, X1, Y1]):
                continue
            if col == "black" and any(X0 - p["r_in"] * 0.6 <= p["cx"] <= X1 + p["r_in"] * 0.6 and Y0 - p["r_in"] * 0.6 <= p["cy"] <= Y1 + p["r_in"] * 0.6 for p in players):
                continue  # a player symbol or the letter inside it
            if any(t["box"][0] - 2 <= (X0 + X1) / 2 <= t["box"][2] + 2 and t["box"][1] - 2 <= (Y0 + Y1) / 2 <= t["box"][3] + 2
                   and len(re.sub(r"\W", "", t["text"])) > 3 for t in texts):
                continue  # part of a longer coloured note
            binm = (m[Y0:Y1, X0:X1] > 0).astype(np.uint8) * 255
            paper = np.where(binm > 0, 0, 255).astype(np.uint8)
            cands = []
            for img_try in (cv2.copyMakeBorder(paper, 3, 3, 3, 3, cv2.BORDER_CONSTANT, value=255),
                            cv2.cvtColor(bgr[max(Y0 - 3, 0):Y1 + 3, max(X0 - 3, 0):X1 + 3], cv2.COLOR_BGR2GRAY)):
                t, c = rec_tight(img_try)
                t = re.sub(r"[^A-Za-z$]", "", t)
                if t:
                    t = t[0].upper() + t[1:].lower() if t[:1] == "N" and t[1:].lower() == "w" else t.upper()
                    cands.append((DEF_TOKENS.match(t) is not None, c, t))
            cands.sort(reverse=True)
            word = {"color": col, "cx": (X0 + X1) / 2, "cy": (Y0 + Y1) / 2, "h": Y1 - Y0, "box": [X0, Y0, X1, Y1],
                    "rec": cands, "bin": binm}
            if use_t:
                word_cands.append(word)
                continue
            txt, sc = (cands[0][2], cands[0][1]) if cands else ("", 0.0)
            if not (DEF_TOKENS.match(txt) and sc >= 0.4):
                txt, sc = glyphs.read_word(binm, allowed=DEF_CHARS, max_chars=3)
            if sc >= 0.4 and DEF_TOKENS.match(txt):
                defenders.append({"label": txt, **{k: word[k] for k in ("color", "cx", "cy", "h", "box")}})
    if use_t:
        # the page's own defender list decides the letters (an empty list means: no defenders drawn): best (word, letter) pairs first, counts respected
        pairs = []
        for wi, wd in enumerate(word_cands):
            for tok in set(tdef):
                sc = 0.0
                for ok, c, t in wd["rec"]:
                    if t.upper() == tok.upper():
                        sc = max(sc, 1.0 + c)
                if sc == 0.0:
                    txt, s2 = glyphs.read_word(wd["bin"], allowed="".join(sorted(set(tok.upper()))) or None, max_chars=3)
                    sc = s2 if txt == tok.upper() else s2 * 0.4
                pairs.append((sc, wi, tok))
        left = Counter(tdef)
        taken = set()
        for sc, wi, tok in sorted(pairs, key=lambda q: -q[0]):
            if sc < 0.45 or wi in taken or left[tok] <= 0:
                continue
            taken.add(wi)
            left[tok] -= 1
            wd = word_cands[wi]
            defenders.append({"label": tok, **{k: wd[k] for k in ("color", "cx", "cy", "h", "box")}})

    if tdef:
        # defender letters the OCR read as plain words ("E", "T", "ET", "FS"): place the ones the page lists
        left2 = Counter(tdef) - Counter(d["label"] for d in defenders)
        for t in texts:
            if t.get("virtual") or in_frame_or_header(t["box"]):
                continue
            toks = re.sub(r"[^A-Za-z$ ]", " ", t["text"]).split()
            if not toks:
                continue
            if len(toks) == 1 and len(toks[0]) > 1 and toks[0].upper() not in {k.upper() for k in left2}:
                toks = list(toks[0])  # "ET" printed close together
            norm_t = [x[0].upper() + x[1:].lower() if x.lower() == "nw" else x.upper() for x in toks]
            if not all(left2[x] > 0 for x in norm_t) or Counter(norm_t) - left2:
                continue
            bx = t["box"]
            for j, tok in enumerate(norm_t):
                w = (bx[2] - bx[0]) / len(norm_t)
                cx = bx[0] + w * (j + 0.5)
                defenders.append({"label": tok, "color": dominant_colour(masks, bx), "cx": cx, "cy": (bx[1] + bx[3]) / 2,
                                  "h": bx[3] - bx[1], "box": [bx[0] + w * j, bx[1], bx[0] + w * (j + 1), bx[3]]})
                left2[tok] -= 1

    def overlaps(a, b, pad=2):
        return not (a[2] + pad < b[0] or b[2] + pad < a[0] or a[3] + pad < b[1] or b[3] + pad < a[1])

    for tl in tlabels:
        ax, ay = tl["at"][0] - x0, tl["at"][1] - y0
        if not (0 <= ax <= W and 0 <= ay <= H):
            continue
        if any(t["box"][0] - 6 <= ax <= t["box"][2] + 6 and t["box"][1] - 6 <= ay <= t["box"][3] + 6 for t in texts):
            continue
        n_lines = max(1, min(3, len(tl["text"]) // 12 + 1)) if len(tl["text"]) > 10 else 1
        hh = r0 * 0.75 * n_lines
        ww = min(W * 0.5, max(r0 * 0.9, len(tl["text"]) / n_lines * r0 * 0.5))
        texts.append({"box": [ax - ww / 2 - r0 * 0.3, ay - hh / 2 - r0 * 0.3, ax + ww / 2 + r0 * 0.3, ay + hh / 2 + r0 * 0.3],
                      "text": tl["text"], "conf": 1.0, "virtual": True})
    labels = []
    for t in texts:
        bx = t["box"]
        if any(overlaps(bx, d["box"]) for d in defenders) and len(re.sub(r"\W", "", t["text"])) <= 3:
            continue
        if any(math.dist(((bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2), (p["cx"], p["cy"])) < p["r_in"] for p in players):
            continue  # the letter inside a ring
        if sum(1 for p in players if bx[0] - 2 <= p["cx"] <= bx[2] + 2 and bx[1] - 2 <= p["cy"] <= bx[3] + 2) >= 1 and re.fullmatch(r"[0OQD()\s]+", t["text"]):
            continue  # the OCR reading the rings themselves as O / 0
        if not re.search(r"[A-Za-z0-9]", t["text"]):
            continue
        labels.append({"text": t["text"], "color": dominant_colour(masks, bx), "box": bx})

    # ---- line ink: everything that is not a player, a defender, a label or a callout box
    ink = masks["black"].copy()
    for col in ("red", "brown", "blue", "green", "orange", "purple"):
        ink = cv2.bitwise_or(ink, masks[col])
    erase = np.zeros_like(ink)
    for p in players:
        if p["kind"] == "square":
            q = int(p["r_in"] + 7)
            cv2.rectangle(erase, (int(p["cx"]) - q, int(p["cy"]) - q), (int(p["cx"]) + q, int(p["cy"]) + q), 255, -1)
        else:
            cv2.circle(erase, (int(p["cx"]), int(p["cy"])), int(p["r_in"] + 6), 255, -1)
    text_ink = np.zeros_like(ink)
    for bx in [l["box"] for l in labels] + [d["box"] for d in defenders] + header_boxes:
        erase_glyphs(text_ink, ink, bx)
    erase = cv2.bitwise_or(erase, text_ink)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(masks["yellow"])
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a > 200:
            cv2.rectangle(erase, (x - 4, y - 4), (x + w + 4, y + h + 4), 255, -1)
    for f in frames:
        cv2.rectangle(erase, (f[0] - 4, f[1] - 4), (f[2] + 4, f[3] + 4), 255, -1)
    lines = cv2.bitwise_and(ink, cv2.bitwise_not(erase))

    # heads: thick blobs (arrowheads, ball dots) survive an opening that removes 3-4 px strokes
    k = max(5, int(r0 * 0.38)) | 1
    thick = cv2.morphologyEx(lines, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    heads = []
    n, lab, stats, cents = cv2.connectedComponentsWithStats(thick)
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < 25 or max(w, h) > r0 * 2.2:
            continue
        cnt, _ = cv2.findContours((lab[y:y + h, x:x + w] == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        (_, _), rad = cv2.minEnclosingCircle(cnt[0])
        circ_fit = a / max(math.pi * rad * rad, 1)          # disc ~0.9, triangle ~0.4
        tri_area, _ = cv2.minEnclosingTriangle(cnt[0].astype(np.float32))
        tri_fit = a / max(float(tri_area), 1)               # triangle ~0.9, disc ~0.6
        heads.append({"kind": "dot" if circ_fit > tri_fit + 0.05 else "arrow", "cx": float(cents[i][0]), "cy": float(cents[i][1]), "r": max(w, h) / 2.0})
    no_heads = lines.copy()
    for hd in heads:
        cv2.circle(no_heads, (int(hd["cx"]), int(hd["cy"])), int(hd["r"] + 2), 0, -1)

    # small components are dashes / dots / crossbars; big ones are traced as solid strokes
    n, lab, stats, cents = cv2.connectedComponentsWithStats(no_heads)
    pieces = []
    big = np.zeros_like(no_heads)
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < 4:
            continue
        if max(w, h) <= r0 * 1.05:
            ys, xs = np.nonzero(lab[y:y + h, x:x + w] == i)
            pts = np.stack([xs + x, ys + y], 1).astype(float)
            c = pts.mean(0)
            if len(pts) > 3:
                ev, evec = np.linalg.eigh(np.cov(pts.T))
                d = evec[:, 1]
                proj = (pts - c) @ d
                ext = float(proj.max() - proj.min())
            else:
                d, ext = np.array([1.0, 0.0]), 1.0
            pieces.append({"c": c, "d": d, "len": max(ext, 1.0), "used": False, "box": [x, y, x + w, y + h]})
        else:
            big[lab == i] = 255

    edges = [e for e in trace_skeleton(skeletonize(big > 0)) if plen(e) >= 3]
    edges = merge_straight(edges, r0)
    edges = merge_through_players(edges, players, r0)
    spurs = [e for e in edges if plen(e) <= r0 * 1.1]
    solids = [e for e in edges if plen(e) > r0 * 1.1]

    # chain dashes / dots: walk centroid to centroid, keeping the heading
    gmax = r0 * 1.7
    cs = np.array([p["c"] for p in pieces]) if pieces else np.zeros((0, 2))
    chains = []
    order = sorted(range(len(pieces)), key=lambda i: sum(1 for j in range(len(pieces)) if j != i and np.hypot(*(cs[j] - cs[i])) < gmax))
    for i0 in order:
        if pieces[i0]["used"]:
            continue
        pieces[i0]["used"] = True
        seq = [i0]
        for side in (1, -1):
            cur = i0
            head = None
            while True:
                best, bscore = None, 1e9
                for j, q in enumerate(pieces):
                    if q["used"]:
                        continue
                    v = cs[j] - cs[cur]
                    dist = float(np.hypot(*v))
                    if dist > gmax or dist < 1:
                        continue
                    u = v / dist
                    ref = head if head is not None else pieces[cur]["d"] * (1 if np.dot(v, pieces[cur]["d"]) >= 0 else -1)
                    cosang = float(np.dot(u, ref))
                    if head is None and len(seq) > 1:
                        pass
                    if cosang < (0.55 if head is not None else 0.2):
                        continue
                    score = dist * (2 - cosang)
                    if score < bscore:
                        best, bscore = j, score
                if best is None:
                    break
                pieces[best]["used"] = True
                v = cs[best] - cs[cur]
                head = v / max(np.hypot(*v), 1e-6) if head is None else 0.5 * head + 0.5 * v / max(np.hypot(*v), 1e-6)
                head = head / max(np.hypot(*head), 1e-6)
                cur = best
                if side == 1:
                    seq.append(best)
                else:
                    seq.insert(0, best)
            if side == 1 and len(seq) == 1:
                continue
        if len(seq) >= 3:
            lens = sorted(pieces[i]["len"] for i in seq)
            style = "dotted" if lens[len(lens) // 2] < r0 * 0.5 else "dashed"
            pts = [tuple(cs[i]) for i in seq]
            # extend to the outer edge of the end pieces
            for at in (0, -1):
                i = seq[at]
                other = cs[seq[1]] if at == 0 else cs[seq[-2]]
                v = cs[i] - other
                v = v / max(np.hypot(*v), 1e-6)
                ext = tuple(cs[i] + v * pieces[i]["len"] / 2)
                if at == 0:
                    pts.insert(0, ext)
                else:
                    pts.append(ext)
            chains.append({"pts": pts, "style": style})
        else:
            for i in seq:
                pieces[i]["used"] = False if len(seq) == 1 else pieces[i]["used"]
    # crossbars: short straight solid bits not in any chain
    tbars = []
    for p in pieces:
        if not p["used"] and p["len"] >= r0 * 0.55:
            tbars.append({"mid": p["c"], "dir": p["d"]})
    for e in spurs:
        a, b = np.array(e[0], float), np.array(e[-1], float)
        if math.dist(e[0], e[-1]) > 0.8 * plen(e):
            tbars.append({"mid": (a + b) / 2, "dir": (b - a) / max(np.hypot(*(b - a)), 1)})

    def edge_colour(pts):
        """The line's own colour: a majority of the pixels under the traced path (a black line passing a coloured
        label must stay black)."""
        votes = {}
        for (x, y) in pts[:: max(1, len(pts) // 40)]:
            x, y = int(x), int(y)
            for col in ("black", "red", "brown", "blue", "green", "orange", "purple"):
                n = int((masks[col][max(y - 1, 0):y + 2, max(x - 1, 0):x + 2] > 0).sum())
                if n:
                    votes[col] = votes.get(col, 0) + n
        if not votes:
            return "black"
        best = max(votes, key=votes.get)
        return best if votes[best] >= 0.6 * sum(votes.values()) or best == "black" else max(votes, key=votes.get)

    def nearest_player(pt, lim):
        best, bd = None, lim
        for i, pl in enumerate(players):
            d = math.dist(pt, (pl["cx"], pl["cy"])) - pl["r_in"]
            if d < bd:
                best, bd = i, d
        return best

    raw_paths = [{"pts": [tuple(map(float, q)) for q in e], "style": "solid"} for e in solids] + chains
    out_paths = []
    used_heads, used_tbars = set(), set()

    def take_head(pt, dvec, lim):
        for i, hd in enumerate(heads):
            if i in used_heads:
                continue
            if math.dist(pt, (hd["cx"], hd["cy"])) < hd["r"] + lim:
                used_heads.add(i)
                return i
        return None

    for p in raw_paths:
        pts = p["pts"]
        lim = r0 * (1.4 if p["style"] != "solid" else 0.9)
        a_pl = nearest_player(pts[0], lim)
        b_pl = nearest_player(pts[-1], lim)
        if a_pl is None and b_pl is not None:
            pts = pts[::-1]
            a_pl, b_pl = b_pl, a_pl
        end_kind = "none"
        hi = take_head(pts[-1], None, r0 * (0.9 if p["style"] != "solid" else 0.6))
        if hi is None and a_pl is None:
            hi = take_head(pts[0], None, r0 * (0.9 if p["style"] != "solid" else 0.6))
            if hi is not None:
                pts = pts[::-1]
        if hi is not None:
            hd = heads[hi]
            end_kind = hd["kind"]
            if hd["kind"] == "dot":
                pts = pts + [(hd["cx"], hd["cy"])]
            else:
                dv = direction(pts, True, 8)
                pts = pts + [(hd["cx"] + dv[0] * hd["r"] * 0.7, hd["cy"] + dv[1] * hd["r"] * 0.7)]
        else:
            dvec = direction(pts, True, 10)
            for i, tb in enumerate(tbars):
                if i in used_tbars:
                    continue
                if math.dist(pts[-1], tb["mid"]) < r0 * 0.75 and abs(float(np.dot(dvec, tb["dir"]))) < 0.5:
                    end_kind = "tbar"
                    used_tbars.add(i)
                    break
        if a_pl is not None and b_pl is not None and p["style"] == "solid" and end_kind == "none":
            pass  # a line between two players (e.g. a combo bracket): keep as drawn
        if end_kind == "none" and plen(pts) < r0 * 0.9:
            continue  # a stub of a thick ring or a letter, not a line the book drew
        simp = rdp(pts, max(1.5, r0 * 0.12))
        out_paths.append({"pts": simp, "style": p["style"], "end": end_kind, "anchor": a_pl, "color": edge_colour(p["pts"])})

    # arrowheads or dots with no line left (the stem was under a label) become free marks
    for i, hd in enumerate(heads):
        if i not in used_heads and hd["kind"] == "dot" and hd["r"] < r0 * 0.6:
            out_paths.append({"pts": [(hd["cx"], hd["cy"]), (hd["cx"] + 0.5, hd["cy"])], "style": "solid", "end": "dot", "anchor": None, "color": "black"})

    # ---- build the PlayForge diagram
    PLAYERS, PATHS, ANN = {}, {}, {}
    for i, p in enumerate(players):
        x, y = to_yd(p["cx"], p["cy"])
        lab = p["label"]
        pid = f"o{i + 1}"
        sym = "square" if p["kind"] == "square" else "circle"
        PLAYERS[pid] = {"id": pid, "side": "offense", "symbol": sym, "label": lab if lab != "?" else "", "x": x, "y": y}
        if p.get("shade") and p["shade"] != "none":
            PLAYERS[pid]["shade"] = p["shade"]
        if p.get("dashed"):
            PLAYERS[pid]["outline"] = "dashed"
        p["id"] = pid
        if lab == "?":
            issues.append(f"player at ({x}, {y}) has an unread label")
    colour_map = {"blue": "blue", "green": "green", "brown": "brown", "red": "red", "purple": "red", "black": "black", "orange": "orange"}
    for i, d in enumerate(defenders):
        x, y = to_yd(d["cx"], d["cy"])
        pid = f"d{i + 1}"
        PLAYERS[pid] = {"id": pid, "side": "defense", "symbol": "letter", "label": d["label"], "x": x, "y": y,
                        "labelColor": colour_map.get(d["color"], "black")}
    pcol = {"black": "black", "red": "red", "brown": "red", "blue": "blue", "green": "green", "orange": "orange", "purple": "purple"}
    for i, p in enumerate(out_paths):
        if len(p["pts"]) < 2:
            continue
        pid = f"l{i + 1}"
        if p["anchor"] is not None:
            ax, ay = players[p["anchor"]]["cx"], players[p["anchor"]]["cy"]
            pts = [{"x": round((q[0] - ax) / s, 3), "y": round((ay - q[1]) / s, 3)} for q in p["pts"]]
            pts[0] = {"x": 0, "y": 0}
            anchor = {"kind": "player", "playerId": players[p["anchor"]]["id"]}
        else:
            pts = [dict(zip(("x", "y"), to_yd(*q))) for q in p["pts"]]
            anchor = {"kind": "free"}
        # smooth interior points where the line bends gently (curves)
        raw = p["pts"]
        for j in range(1, len(raw) - 1):
            v1 = np.subtract(raw[j], raw[j - 1]); v2 = np.subtract(raw[j + 1], raw[j])
            ang = math.degrees(math.acos(max(-1, min(1, np.dot(v1, v2) / max(np.hypot(*v1) * np.hypot(*v2), 1e-6)))))
            if ang < 32 and len(raw) > 3:
                pts[j]["smooth"] = True
        role = "block" if p["end"] == "tbar" else ("motion" if p["style"] == "dotted" and p["end"] == "none" else "route")
        line = {"solid": "solid", "dashed": "dashed", "dotted": "dotted"}[p["style"]]
        PATHS[pid] = {"id": pid, "anchor": anchor, "points": pts, "end": p["end"], "line": line, "role": role,
                      "color": pcol.get(p["color"], "black")}
    for i, l in enumerate(labels):
        bx = l["box"]
        x, y = to_yd((bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2)
        h_yd = (bx[3] - bx[1]) / s
        size = "sm" if h_yd < 0.5 else ("md" if h_yd < 0.68 else "lg")
        aid = f"t{i + 1}"
        ANN[aid] = {"id": aid, "kind": "text", "x": x, "y": y, "text": l["text"], "style": "bold",
                    "size": size, "color": colour_map.get(l["color"], "black")}

    # ---- score: draw the vector back and compare with the scan ink (letters of labels excluded)
    target = ink.copy()
    target[text_ink > 0] = 0
    for f in frames:  # captions are carried as text by the page, not rebuilt as drawing
        target[max(f[1] - 4, 0):f[3] + 4, max(f[0] - 4, 0):f[2] + 4] = 0
    n, lab, stats, _ = cv2.connectedComponentsWithStats(masks["yellow"])
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a > 200:
            cv2.rectangle(target, (x - 4, y - 4), (x + w + 4, y + h + 4), 0, -1)
    drawn = np.zeros_like(ink)
    drawn_dashed = np.zeros_like(ink)
    for p in players:
        if p["kind"] == "square":
            r = int(p["r_in"] + 1)
            cv2.rectangle(drawn, (int(p["cx"] - r), int(p["cy"] - r)), (int(p["cx"] + r), int(p["cy"] + r)), 255, 3)
        elif p["kind"] == "disc":
            cv2.circle(drawn, (int(p["cx"]), int(p["cy"])), int(p["r_in"]), 255, -1)
        else:
            cv2.circle(drawn, (int(p["cx"]), int(p["cy"])), int(round(p["r_in"] + 1)), 255, 3)
            if p["label"] and p["label"] != "?":  # the letter inside is text: not scored as drawing
                cv2.circle(target, (int(p["cx"]), int(p["cy"])), int(p["r_in"] * 0.82), 0, -1)
    for p in out_paths:
        pts = np.array(p["pts"], np.int32)
        if p["style"] == "solid":
            cv2.polylines(drawn, [pts], False, 255, 5)
        else:
            cv2.polylines(drawn, [pts], False, 255, 3)
            cv2.polylines(drawn_dashed, [pts], False, 255, 7)
        if p["end"] == "dot":
            cv2.circle(drawn, tuple(map(int, p["pts"][-1])), int(r0 * 0.3), 255, -1)
        if p["end"] == "arrow":
            dv = direction(p["pts"], True, 10)
            nv = np.array([-dv[1], dv[0]])
            tip = np.array(p["pts"][-1], float)
            tri = np.array([tip, tip - dv * r0 * 0.9 + nv * r0 * 0.45, tip - dv * r0 * 0.9 - nv * r0 * 0.45], np.int32)
            cv2.fillPoly(drawn, [tri], 255)
        if p["end"] == "tbar":
            dv = direction(p["pts"], True, 10)
            nv = np.array([-dv[1], dv[0]])
            tip = np.array(p["pts"][-1], float)
            cv2.line(drawn, tuple((tip + nv * r0 * 0.8).astype(int)), tuple((tip - nv * r0 * 0.8).astype(int)), 255, 5)
    tol = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    tgt = target > 0
    covered = cv2.dilate(drawn, tol) > 0
    recall = float((tgt & covered).sum()) / max(int(tgt.sum()), 1)
    # solids must sit on ink; dashed runs may cross the gaps between dashes
    # light anti-aliased strokes (thin rings print grey) still count as drawing for precision
    loose = ((cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY) < 175).astype(np.uint8) * 255) | ink
    grown_s = cv2.dilate(loose, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
    grown_d = cv2.dilate(loose, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(r0 * 0.9) | 1, int(r0 * 0.9) | 1))) > 0
    dr = drawn > 0
    ok = np.where(drawn_dashed > 0, grown_d, grown_s)
    precision = float((dr & ok).sum()) / max(int(dr.sum()), 1)
    # a whole piece of the drawing left out is worse than scattered edge misses
    miss = (tgt & ~covered).astype(np.uint8)
    miss = cv2.morphologyEx(miss, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    nm, _, mstats, _ = cv2.connectedComponentsWithStats(miss)
    big_miss = sum(1 for i in range(1, nm) if mstats[i][4] > r0 * r0 * 0.6)
    unread = sum(1 for p in players if p["label"] == "?")
    loose = sum(1 for p in out_paths if p["anchor"] is None and p["style"] == "solid" and p["end"] != "dot")
    if recall >= 0.95 and precision >= 0.96 and unread == 0 and big_miss == 0:
        conf = "high"
    elif recall >= 0.88 and precision >= 0.92 and unread <= 1 and big_miss <= 2:
        conf = "medium"
    else:
        conf = "low"
    if recall < 0.95:
        issues.append(f"vector covers {recall:.0%} of the drawn ink")
    if precision < 0.96:
        issues.append(f"{1 - precision:.0%} of the vector strokes are not on the drawing")
    if big_miss:
        issues.append(f"{big_miss} drawn piece(s) not rebuilt")
    if loose:
        issues.append(f"{loose} solid line(s) not attached to a player")
    result = {
        "diagram": {"players": PLAYERS, "paths": PATHS, "annotations": ANN},
        "frame": {"crop": [x0, y0, x1, y1], "origin": [round(ox, 1), round(oy, 1)], "pxPerYard": round(s, 2), "r": round(r0, 1)},
        "score": {"recall": round(recall, 3), "precision": round(precision, 3), "players": len(players),
                  "defenders": len(defenders), "paths": len(PATHS), "labels": len(ANN), "unreadLabels": unread, "bigMiss": big_miss},
        "confidence": conf,
        "issues": issues,
        "unread": [p["id"] for p in players if p["label"] == "?"],
    }
    if debug:
        dbg = bgr.copy()
        over = np.zeros_like(bgr)
        over[drawn > 0] = (0, 0, 255)
        dbg = cv2.addWeighted(dbg, 0.55, over, 0.45, 0)
        miss = tgt & ~(cv2.dilate(drawn, tol) > 0)
        dbg[miss] = (255, 0, 255)
        dbg[dr & ~ok] = (0, 200, 255)  # vector strokes off the drawing
        for p in players:
            cv2.putText(dbg, p["label"] or "-", (int(p["cx"] + p["r_in"]), int(p["cy"] - p["r_in"])), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 128, 0), 2)
        for d in defenders:
            cv2.putText(dbg, d["label"], (int(d["cx"]), int(d["cy"] - d["h"])), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
        result["_debug"] = dbg
    return result


def load_json(path, default=None):
    if os.path.exists(path):
        with open(path, encoding="utf8") as f:
            return json.load(f)
    return default


def run_page(n, only=None, debug=False):
    cells = load_json(os.path.join(ROOT, "cells", f"p-{n:03d}.json"))
    rows = load_json(os.path.join(ROOT, "ocr", f"p-{n:03d}.json"), [])
    if not cells:
        return {}
    bgr = cv2.imread(os.path.join(ROOT, "pages", f"p-{n:03d}.png"))
    tpage = load_json(os.path.join(ROOT, "book", "pages", f"p-{n:03d}.json"), {}) or {}
    tcells = {c["id"]: c for c in tpage.get("cells", [])}
    # diagrams the detector missed but the transcription boxed (x1, x2 ...)
    cells = {"cells": cellgeom.page_cells(n, ROOT)}
    out = {}
    for c in cells["cells"]:
        if only and c["id"] != only:
            continue
        bx = c["body"] or c["bbox"]
        inside = [r for r in rows if bx[0] <= (r["box"][0][0] + r["box"][2][0]) / 2 <= bx[2] and bx[1] <= (r["box"][0][1] + r["box"][2][1]) / 2 <= bx[3]]
        tcell = tcells.get(c["id"])
        global CELL_VOCAB
        CELL_VOCAB = set(tcell["rings"]) | {"HB"} if tcell and tcell.get("rings") else None
        if tcell and tcell.get("kind") in ("text", "empty", "photo"):
            continue
        try:
            res = vectorize_cell(n, c, bgr, inside, transcription=tcell, debug=debug)
        except MemoryError:
            raise  # the machine, not the cell: retry the page later
        except cv2.error as e:
            if "Insufficient memory" in str(e):
                raise
            res = {"error": repr(e), "confidence": "low"}
        except Exception as e:  # a cell the method chokes on is a crop, not a crash
            res = {"error": repr(e), "confidence": "low"}
        if res is None:
            continue
        if debug and "_debug" in res:
            cv2.imwrite(os.path.join(OUT, "debug", f"p-{n:03d}-{c['id']}.png"), res.pop("_debug"))
        out[c["id"]] = res
    with open(os.path.join(OUT, f"p-{n:03d}.json"), "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False)
    return out


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    dbg = "--debug" in sys.argv
    if "--all" in sys.argv:
        first = int(a[0]) if a else 1
        last = int(a[1]) if len(a) > 1 else 477
        import time

        here = os.path.dirname(os.path.abspath(__file__))
        code_t = max(os.path.getmtime(os.path.join(here, f)) for f in ("vectorize.py", "glyphs.py", "cellgeom.py"))
        for n in range(first, last + 1):
            # resumable: a page traced after the code and its transcription last changed is up to date
            out_p = os.path.join(OUT, f"p-{n:03d}.json")
            tr_p = os.path.join(ROOT, "book", "pages", f"p-{n:03d}.json")
            if "--force" not in sys.argv and os.path.exists(out_p):
                newest_in = max(code_t, os.path.getmtime(tr_p) if os.path.exists(tr_p) else 0)
                if os.path.getmtime(out_p) > newest_in:
                    continue
            for attempt in range(8):
                try:
                    res = run_page(n, debug=dbg)
                    break
                except (MemoryError, cv2.error):
                    print(n, "out of memory, waiting", attempt + 1, flush=True)
                    time.sleep(60)
            else:
                print(n, "skipped: out of memory", flush=True)
                continue
            print(n, {k: v.get("confidence") for k, v in res.items()}, flush=True)
    else:
        n = int(a[0])
        res = run_page(n, a[1] if len(a) > 1 else None, debug=dbg)
        for k, v in res.items():
            print(k, v.get("confidence"), v.get("score"), v.get("issues"), v.get("error"))
