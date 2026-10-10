"""
Read every diagram cell out of the Rams 2022 section PDFs.

    python scripts/rams/extract_cells.py source/rams-2022/pdf source/rams-2022/cells [section-number ...]

The section PDFs are real vector drawings with a text layer: each cell has a header (the formation line and
the call line), rings for the offense, letters for the defense, labels (blocking calls, route words, depths,
progression numbers) and the routes / blocks / motions as line work. This script turns that into positions:
per cell, every offensive ring with its letter, every defender with his letter, every label, and every
polyline (dashed or solid, arrow / block end) in yards relative to the center of the line. Nothing is
interpreted here (scripts/rams/build_plays.py does that) and no book sentences are kept beyond the page's
own labels and the concept / footwork lines, which stay in the private source repo.

Frame: x = 0 at the center square, + to the right, one unit = the distance between two neighbouring
linemen (one yard in PlayForge). y = 0 on the line of scrimmage, + downfield. The pages are not drawn to
scale vertically, so the vertical unit is read from the page's own depth labels ("5 Yds") when it has them,
else a fixed share of the horizontal unit.
"""
import collections
import json
import math
import os
import re
import sys

import pymupdf

SECTIONS = {
    "05": ("05 Pass Pro - 2022 Final.pdf", "pass-pro"),
    "06": ("06. Wide Zone Runs PB 2022.pdf", "wide-zone"),
    "07": ("07. Mid Zone Runs 2022.pdf", "mid-zone"),
    "08": ("08. Gun Only Mid Zone Runs 2022.pdf", "gun-mid-zone"),
    "09": ("09. Tight Zone Runs 2022.pdf", "tight-zone"),
    "10": ("10. Gun Only Dive Zone. Zone Read 2022.pdf", "dive-zone"),
    "11": ("11. Gap Runs 2022.pdf", "gap"),
    "12": ("12. Perimeter Runs 2022.pdf", "perimeter"),
    "13": ("13. Sweeps & Specials Runs 2022.pdf", "sweeps-specials"),
    "14": ("14. 3 STEP FINAL.pdf", "3-step"),
    "16": ("16. 7 Step - Final 2022.pdf", "7-step"),
    "17": ("17. Dropback Man-Zone Cans - 2022 Final.pdf", "dropback-cans"),
    "18": ("18. Play Pass 2022 Final.pdf", "play-pass"),
    "19": ("19. Play Pass man-zone Cans Final 2022.pdf", "play-pass-cans"),
    "20": ("20. Movement 2022 Final.pdf", "movement"),
    "21": ("21. Screens 2022 Final.pdf", "screens"),
    "22": ("22. Run Alerts 2022 - Final.pdf", "run-alerts"),
    "23": ("23. Redzone - 2022 Final.pdf", "red-zone"),
    "24": ("24. 2 MIN FINAL.pdf", "two-minute"),
}

OFF_LETTERS = {"X", "Y", "Z", "F", "H", "Q", "QB", "HB", "T", "U"}
DL = {"E", "N", "T", "DE", "DT", "NT"}
LB = {"S", "M", "W", "J", "B", "MLB", "SLB", "WLB", "L", "R"}
DB = {"C", "FS", "SS", "$", "NW", "NS", "Nw", "Ns", "N$", "NB", "D", "CB", "SAF", "S$"}
DEF_LETTERS = DL | LB | DB
# colours in the text layer, as pymupdf reports them (0xRRGGBB)
SYMBOLS = str.maketrans({"\x10": "-", "\x11": ".", "\x12": "/", "\x13": "0", "\x14": "1", "\x15": "2", "\x16": "3", "\x17": "4", "\x18": "5", "\x19": "6", "\x1a": "7", "\x1b": "8", "\x1c": "9", ">": "[", "@": "]"})
RED = 16711680
BLUE = 255
WHITE = 16777215


def rgb(c):
    return None if c is None else tuple(round(v, 2) for v in c)


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def bez(p0, p1, p2, p3, t):
    s = 1 - t
    return (s * s * s * p0[0] + 3 * s * s * t * p1[0] + 3 * s * t * t * p2[0] + t * t * t * p3[0], s * s * s * p0[1] + 3 * s * s * t * p1[1] + 3 * s * t * t * p2[1] + t * t * t * p3[1])


def page_spans(page):
    out = []
    seen = set()
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            for s in ln["spans"]:
                text = s["text"]
                if "\x14" in text or "\x13" in text or "\x18" in text or ">" in text or "@" in text:
                    text = text.translate(SYMBOLS)
                text = text.replace("\x03", " ").replace("\x0f", "").replace("Ȃ", "-").replace("\u2013", "-").replace("\u2014", "-").strip()
                text = re.sub(r"[¶·³´µ²“”‘’]", "", text).strip()
                if not text:
                    continue
                x0, y0, x1, y1 = s["bbox"]
                if any(abs(o["x0"] - x0) < 2.5 and abs(o["y0"] - y0) < 2.5 and o["text"] == text for o in out[-40:]):
                    continue
                out.append({"x": (x0 + x1) / 2, "y": (y0 + y1) / 2, "x0": x0, "x1": x1, "y0": y0, "y1": y1, "size": round(s["size"], 1), "font": s["font"], "color": s["color"], "text": text})
    return out


def page_shapes(page):
    """Rings (offense), squares (center), discs (filled back), dashed rings (motion ghosts), polylines, arrowheads."""
    rings, squares, discs, ghosts, polys, heads = [], [], [], [], [], []
    for d in page.get_drawings():
        r = d["rect"]
        kinds = collections.Counter(it[0] for it in d["items"])
        dashes = d.get("dashes")
        dashed = bool(dashes) and dashes != "[] 0"
        fill = d.get("fill")
        color = d.get("color")
        square_like = 8 < r.width < 30 and 8 < r.height < 30 and abs(r.width - r.height) < 3.5
        if square_like and kinds.get("c") == 4 and not dashed:
            c = ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
            if fill is not None and sum(fill) < 1.5:
                discs.append(c)
            elif fill is None and color is not None:
                rings.append(c)  # the stroke; the white fill of the same ring is skipped
            continue
        if square_like and kinds.get("c") == 1 and dashed:
            ghosts.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))
            continue
        if square_like and kinds.get("re") == 1 and color is not None and fill is None and 0.5 <= (d.get("width") or 0) <= 3.5:
            squares.append(((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))
            continue
        # filled little triangle = arrowhead
        if fill is not None and color is None and r.width < 14 and r.height < 14 and kinds.get("l", 0) >= 2:
            pts = []
            for it in d["items"]:
                if it[0] == "l":
                    pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
                elif it[0] == "c":
                    pts += [(it[1].x, it[1].y), (it[4].x, it[4].y)]
            uniq = []
            for p in pts:
                if not any(dist(p, q) < 0.8 for q in uniq):
                    uniq.append(p)
            if len(uniq) >= 3:
                # apex = the vertex farthest from the midpoint of the other two
                best = None
                for i, p in enumerate(uniq[:3]):
                    o = [q for j, q in enumerate(uniq[:3]) if j != i]
                    m = ((o[0][0] + o[1][0]) / 2, (o[0][1] + o[1][1]) / 2)
                    dd = dist(p, m)
                    if best is None or dd > best[0]:
                        best = (dd, p, m)
                heads.append({"tip": best[1], "base": best[2]})
            continue
        if color is None or fill is not None:
            continue
        # a stroked path: flatten into a point list
        pts = []
        for it in d["items"]:
            if it[0] == "l":
                a, b = (it[1].x, it[1].y), (it[2].x, it[2].y)
                if not pts or dist(pts[-1], a) > 0.6:
                    pts.append(a)
                pts.append(b)
            elif it[0] == "c":
                p0, p1, p2, p3 = [(q.x, q.y) for q in it[1:5]]
                if not pts or dist(pts[-1], p0) > 0.6:
                    pts.append(p0)
                for t in (0.25, 0.5, 0.75, 1.0):
                    pts.append(bez(p0, p1, p2, p3, t))
            elif it[0] == "re":
                rr = it[1]
                if rr.width > 30 or rr.height > 30:
                    continue  # a frame, not line work
                pts += [(rr.x0, rr.y0), (rr.x1, rr.y0), (rr.x1, rr.y1), (rr.x0, rr.y1), (rr.x0, rr.y0)]
        if len(pts) < 2:
            continue
        length = sum(dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        if length < 0.5:
            continue
        polys.append({"pts": pts, "dashed": dashed, "width": d.get("width") or 1, "color": rgb(color), "len": length})
    # drawings come doubled (the page is drawn twice): drop exact repeats
    def dedupe(items, key):
        out, seen = [], set()
        for it in items:
            k = key(it)
            if k in seen:
                continue
            seen.add(k)
            out.append(it)
        return out
    rk = lambda c: (round(c[0]), round(c[1]))
    rings, squares, discs, ghosts = dedupe(rings, rk), dedupe(squares, rk), dedupe(discs, rk), dedupe(ghosts, rk)
    polys = dedupe(polys, lambda p: (p["dashed"], tuple((round(x), round(y)) for x, y in p["pts"])))
    heads = dedupe(heads, lambda h: rk(h["tip"]))
    # rings drawn on top of a disc (both exist for a filled back) count once
    rings = [c for c in rings if not any(dist(c, d) < 3 for d in discs)]
    return rings, squares, discs, ghosts, polys, heads


def chain(polys):
    """Join polylines whose ends meet (same dash style) into longer ones."""
    polys = [dict(p, pts=list(p["pts"])) for p in polys]
    changed = True
    while changed:
        changed = False
        for i in range(len(polys)):
            a = polys[i]
            if a is None:
                continue
            for j in range(len(polys)):
                b = polys[j]
                if i == j or b is None or a["dashed"] != b["dashed"]:
                    continue
                if dist(a["pts"][-1], b["pts"][0]) < 1.6:
                    a["pts"] += b["pts"][1:]
                elif dist(a["pts"][-1], b["pts"][-1]) < 1.6:
                    a["pts"] += list(reversed(b["pts"]))[1:]
                elif dist(a["pts"][0], b["pts"][-1]) < 1.6:
                    a["pts"] = b["pts"] + a["pts"][1:]
                elif dist(a["pts"][0], b["pts"][0]) < 1.6:
                    a["pts"] = list(reversed(b["pts"])) + a["pts"][1:]
                else:
                    continue
                a["len"] += b["len"]
                polys[j] = None
                changed = True
                break
    return [p for p in polys if p]


def simplify(pts, eps=0.9):
    """Drop points that sit on the line between their neighbours (Douglas-Peucker)."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    best, idx = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        ab = (b[0] - a[0], b[1] - a[1])
        n = math.hypot(*ab) or 1e-9
        d = abs(ab[0] * (a[1] - p[1]) - (a[0] - p[0]) * ab[1]) / n
        if d > best:
            best, idx = d, i
    if best > eps:
        return simplify(pts[: idx + 1], eps)[:-1] + simplify(pts[idx:], eps)
    return [a, b]


def is_tbar(seg, path):
    """A short solid segment whose middle sits on an end of `path`, roughly perpendicular to its last leg."""
    if seg["len"] > 34 or seg["len"] < 5 or len(seg["pts"]) > 3 or seg["dashed"] != path["dashed"]:
        return None
    a, b = seg["pts"][0], seg["pts"][-1]
    def seg_dist(p):
        ab = (b[0] - a[0], b[1] - a[1])
        n2 = ab[0] ** 2 + ab[1] ** 2 or 1e-9
        t = max(0.0, min(1.0, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / n2))
        return dist(p, (a[0] + t * ab[0], a[1] + t * ab[1]))
    for end, prev in ((path["pts"][-1], path["pts"][-2]), (path["pts"][0], path["pts"][1])):
        if seg_dist(end) < 2.2 and dist(end, prev) > 2.5:
            v = (end[0] - prev[0], end[1] - prev[1])
            w = (seg["pts"][-1][0] - seg["pts"][0][0], seg["pts"][-1][1] - seg["pts"][0][1])
            nv, nw = math.hypot(*v) or 1e-9, math.hypot(*w) or 1e-9
            cosang = abs(v[0] * w[0] + v[1] * w[1]) / (nv * nw)
            if cosang < 0.45:
                return "end" if end is path["pts"][-1] else "start"
    return None


def group_labels(spans, line_gap=2.5, x_gap=9, row_gap=9.5):
    """Words of the same size, colour and font that sit on one line, then lines stacked under each other."""
    spans = sorted(spans, key=lambda s: (round(s["y"]), s["x0"]))
    lines = []
    for s in spans:
        for ln in lines:
            if abs(ln["y"] - s["y"]) <= line_gap and ln["size"] == s["size"] and ln["color"] == s["color"] and s["x0"] - ln["x1"] < x_gap and s["x0"] >= ln["x0"] - 2:
                ln["text"] += " " + s["text"]
                ln["x1"] = max(ln["x1"], s["x1"])
                ln["x0"] = min(ln["x0"], s["x0"])
                break
        else:
            lines.append({"text": s["text"], "x0": s["x0"], "x1": s["x1"], "y": s["y"], "y0": s["y0"], "y1": s["y1"], "size": s["size"], "color": s["color"], "font": s["font"]})
    lines.sort(key=lambda l: (l["y"], l["x0"]))
    out = []
    for ln in lines:
        cx = (ln["x0"] + ln["x1"]) / 2
        for g in out:
            gcx = (g["x0"] + g["x1"]) / 2
            if ln["size"] == g["size"] and ln["color"] == g["color"] and 0 < ln["y"] - g["ylast"] <= row_gap and abs(cx - gcx) < max(9, 0.6 * (g["x1"] - g["x0"] + 1)):
                g["text"] += " " + ln["text"]
                g["ylast"] = ln["y"]
                g["x0"], g["x1"] = min(g["x0"], ln["x0"]), max(g["x1"], ln["x1"])
                g["y1"] = ln["y1"]
                break
        else:
            out.append({**ln, "ylast": ln["y"]})
    for g in out:
        g["x"] = (g["x0"] + g["x1"]) / 2
        g["y"] = (g["y0"] + g["y1"]) / 2
        g["text"] = re.sub(r"\s+", " ", g["text"]).strip()
    return out


def classify_span(s):
    t, size, font, color = s["text"], s["size"], s["font"], s["color"]
    if s.get("forced"):
        return s["forced"]
    bold_ital = "BoldItal" in font or "Garamond" in font or ("BookmanOldStyle" in font and size >= 11.5 and color == 0)
    if size >= 16:
        return "title"
    if 11.5 <= size <= 12.5 and bold_ital and color in (0, RED):
        return "header"
    if 11.5 <= size <= 12.5 and ("Eras" in font or "Bookman" in font) and color == 0:
        return "front"
    if size >= 13.5 and "Times" in font and t in DEF_LETTERS:
        return "defender"
    if size >= 13.5 and color == BLUE and "Bookman" in font:
        return "frontnote"  # "JAM" stamped over the box
    if 7.5 <= size <= 8.5 and ("Courier" in font or "Times" in font) and (t in OFF_LETTERS or t in {"-5-", "-3-", "-1-", "-2-", "#"}):
        return "offletter" if t in OFF_LETTERS else "mark"
    if size <= 6.5 and "Bookman" in font and t in {"-5-", "-3-", "#"}:
        return "mark"
    if color == RED and size <= 8.5:
        return "redlabel"
    if 9.5 <= size <= 10.5 and ("Courier" in font and color == BLUE):
        return "progression"
    if 9.5 <= size <= 10.5 and "Bookman" in font and color not in (0,):
        return "cellno"
    if size >= 13.5 and "Bookman" in font and color not in (0,) and re.fullmatch(r"\d", t):
        return "cellno"
    if 9.5 <= size <= 10.5 and "Bookman" in font and color == 0 and re.fullmatch(r"\d", t):
        return "progression"
    if "Courier" in font and re.search(r"\bY(ar)?ds?\b|^\d+(-\d+)?$|^\+?\d", t) and size <= 8.5:
        return "depth"
    if "Courier" in font and size <= 8.5:
        return "routelabel"
    if color == BLUE:
        return "bluenote"
    if color == WHITE:
        return "whitenote"
    if 9.5 <= size <= 10.5 and "Eras" in font:
        return "concept"
    if size <= 8.5 and "Bookman" in font and color == 0:
        return "concept"
    return "note"


def find_headers(spans, rows=None):
    """Pair the formation line with the call line printed just under it. `rows` (y of each line of rings, by
    column) tells a 12pt line above a row (a header) from one below it (a front name) on the protection pages."""
    hs = [s for s in spans if classify_span(s) == "header"]
    # a red word inside a header line (an alert printed in the call) joins the line; a red line alone is a label
    black = [s for s in hs if s["color"] == 0]
    hs = [dict(s, color=0) for s in hs if s["color"] == 0 or any(abs(b["y"] - s["y"]) < 3 and abs(b["x"] - s["x"]) < 120 for b in black)]
    if rows:
        def is_front(s):
            same_col = [ry for rx, ry in rows if abs(rx - s["x"]) < 170]
            above = [s["y"] - ry for ry in same_col if ry < s["y"]]
            return bool(above) and min(above) < 80
        for s in spans:
            if classify_span(s) == "header" and is_front(s):
                s["forced"] = "front"
        hs = [s for s in hs if s.get("forced") != "front"]
    # join header words broken into several spans on one line
    lines = group_labels(hs, line_gap=2.5, x_gap=14, row_gap=0)
    lines.sort(key=lambda l: (l["y"], l["x"]))
    used = set()
    pairs = []
    for i, a in enumerate(lines):
        if i in used:
            continue
        mate = None
        for j, b in enumerate(lines):
            if j in used or j == i:
                continue
            if 8 < b["y"] - a["y"] < 20 and abs(b["x"] - a["x"]) < 60:
                mate = j
                break
        if mate is not None:
            used.update({i, mate})
            call = lines[mate]["text"]
            # a third line of the same header (a long call that wrapped)
            for k, c in enumerate(lines):
                if k not in used and 8 < c["y"] - lines[mate]["y"] < 20 and abs(c["x"] - a["x"]) < 60:
                    call += " " + c["text"]
                    used.add(k)
                    break
            pairs.append({"x": (a["x"] + lines[mate]["x"]) / 2, "y": a["y"], "formation": a["text"], "call": call})
        else:
            used.add(i)
            pairs.append({"x": a["x"], "y": a["y"], "formation": a["text"], "call": ""})
    return pairs


def assign_cells(headers, items, key=lambda it: (it["x"], it["y"])):
    """Every item goes to the header above it in its column."""
    cols = sorted({round(h["x"] / 40) for h in headers})
    out = {i: [] for i in range(len(headers))}
    for it in items:
        x, y = key(it)
        best, bd = None, None
        for i, h in enumerate(headers):
            if h["y"] - 6 > y:
                continue
            d = abs(h["x"] - x) * 0.6 + (y - h["y"]) * 0.15
            if abs(h["x"] - x) > 230:
                continue
            if bd is None or d < bd:
                best, bd = i, d
        if best is not None:
            out[best].append(it)
    return out


def extract_page(page, section, pageno, kind):
    spans = page_spans(page)
    rings, squares, discs, ghosts, polys, heads = page_shapes(page)
    rows = None
    if section == "pass-pro":
        rowmap = collections.defaultdict(list)
        for r in rings:
            rowmap[(round(r[0] / 150), round(r[1] / 6))].append(r)
        rows = [(sum(r[0] for r in v) / len(v), sum(r[1] for r in v) / len(v)) for v in rowmap.values() if len(v) >= 3] + list(squares)
    headers = find_headers(spans, rows)
    title = " ".join(s["text"] for s in spans if classify_span(s) == "title" and s["y"] < 60)
    if not headers:
        return None
    # a diagram printed without its own header (the book repeats the call above it): give it a copy of the
    # nearest header above in its column, so it becomes its own cell
    for sq in squares:
        own = [h for h in headers if abs(h["x"] - sq[0]) < 150 and 20 < sq[1] - h["y"] < 230]
        if own:
            continue
        above = sorted([h for h in headers if abs(h["x"] - sq[0]) < 150 and h["y"] < sq[1]], key=lambda h: sq[1] - h["y"])
        same_row = sorted([h for h in headers if abs(h["y"] - sq[1]) < 230 and h["y"] < sq[1]], key=lambda h: abs(h["x"] - sq[0]))
        src = above[0] if above else same_row[0] if same_row else None
        if src:
            headers.append({"x": sq[0], "y": (same_row[0]["y"] if same_row and abs(same_row[0]["y"] - (sq[1] - 140)) < 60 else sq[1] - 140), "formation": src["formation"], "call": src["call"], "inherited": True})
    headers.sort(key=lambda h: (round(h["y"] / 30), h["x"]))
    for i, h in enumerate(headers):
        h["i"] = i
    # page-level text: the concept / footwork lines above the first header
    top = min(h["y"] for h in headers)
    text_lines = group_labels([s for s in spans if classify_span(s) in ("concept", "note") and s["y"] < top - 8], line_gap=3, x_gap=30, row_gap=0)
    page_text = [l["text"] for l in sorted(text_lines, key=lambda l: (l["y"], l["x0"]))]

    polys = chain(polys)
    # block ends: a short bar across a line end
    tbars = set()
    for i, seg in enumerate(polys):
        for j, path in enumerate(polys):
            if i == j or len(path["pts"]) < 2 or (len(seg["pts"]) <= 2 and len(path["pts"]) <= 2 and path["len"] < seg["len"]):
                continue
            where = is_tbar(seg, path)
            if where:
                path.setdefault("tbar", []).append(where)
                tbars.add(i)
    polys = [p for i, p in enumerate(polys) if i not in tbars]
    # arrowheads: attach to the nearest line end
    for h in heads:
        best, bd = None, None
        for p in polys:
            for where, end in (("end", p["pts"][-1]), ("start", p["pts"][0])):
                d = dist(h["base"], end)
                if bd is None or d < bd:
                    best, bd = (p, where), d
        if best and bd < 4.5:
            best[0].setdefault("arrow", []).append(best[1])

    by_cell_spans = assign_cells(headers, spans)
    by_cell_rings = assign_cells(headers, [{"x": c[0], "y": c[1]} for c in rings])
    by_cell_sq = assign_cells(headers, [{"x": c[0], "y": c[1]} for c in squares])
    by_cell_discs = assign_cells(headers, [{"x": c[0], "y": c[1]} for c in discs])
    by_cell_ghosts = assign_cells(headers, [{"x": c[0], "y": c[1]} for c in ghosts])
    by_cell_polys = assign_cells(headers, polys, key=lambda p: ((p["pts"][0][0] + p["pts"][-1][0]) / 2, max(q[1] for q in p["pts"])))

    cells = []
    for h in headers:
        i = h["i"]
        cs = by_cell_spans[i]
        sq = by_cell_sq[i]
        rs = by_cell_rings[i]
        if not sq:
            # no center square drawn (some pages draw every lineman as a ring): take the middle ring of the longest row
            rows = collections.defaultdict(list)
            for r in rs:
                rows[round(r["y"] / 4)].append(r)
            if not rows:
                continue
            row = max(rows.values(), key=len)
            row.sort(key=lambda r: r["x"])
            mid = row[len(row) // 2]
            cx, cy = mid["x"], mid["y"]
            square_is_ring = True
        else:
            cx, cy = sq[0]["x"], sq[0]["y"]
            square_is_ring = False
        line_row = sorted([r for r in rs if abs(r["y"] - cy) < 4.5] + ([] if square_is_ring else [{"x": cx, "y": cy}]), key=lambda r: r["x"])
        gaps = sorted(abs(line_row[k + 1]["x"] - line_row[k]["x"]) for k in range(len(line_row) - 1))
        gaps = [g for g in gaps if g > 6]
        # the line split: the most common gap (an attached tight end or a wing sits at the same spacing)
        unit = 20.0
        if gaps:
            buckets = collections.Counter(round(g) for g in gaps)
            common = max(buckets.items(), key=lambda kv: (kv[1], -kv[0]))[0]
            unit = sum(g for g in gaps if abs(g - common) <= 1) / max(1, sum(1 for g in gaps if abs(g - common) <= 1))
        # vertical unit from the depth labels; else a fixed share of the horizontal one
        sy = None
        depths = []
        for s in cs:
            if classify_span(s) != "depth":
                continue
            m = re.match(r"^(\d+)(?:\s*-\s*(\d+))?\s*Y", s["text"], re.I)
            if m and s["y"] < cy - 6:
                yd = (int(m.group(1)) + int(m.group(2) or m.group(1))) / 2
                if yd >= 4:
                    depths.append((cy - s["y"]) / yd)
        if len(depths) >= 1:
            depths.sort()
            sy = depths[len(depths) // 2]
        if not sy:
            sy = unit * (0.58 if kind == "pass" else 0.7)
        to_yd = lambda x, y: (round((x - cx) / unit, 2), round((cy - y) / sy, 2))

        letters = [s for s in cs if classify_span(s) == "offletter"]
        letters = [s for s in letters if not (s["color"] != WHITE and any(w["color"] == WHITE and abs(w["x"] - s["x"]) < 3 and abs(w["y"] - s["y"]) < 3 for w in letters))]
        used_letters = set()
        offense = []
        all_rings = [("ring", r) for r in rs] + [("disc", d) for d in by_cell_discs[i]]
        if not square_is_ring:
            all_rings.append(("square", {"x": cx, "y": cy}))
        for shape, r in all_rings:
            best, bd = None, None
            for k, s in enumerate(letters):
                if k in used_letters:
                    continue
                d = dist((s["x"], s["y"]), (r["x"], r["y"]))
                if bd is None or d < bd:
                    best, bd = k, d
            label = None
            if best is not None and bd < (unit * 0.95):
                label = letters[best]["text"]
                used_letters.add(best)
            x, y = to_yd(r["x"], r["y"])
            offense.append({"shape": shape, "label": label, "x": x, "y": y})
        # letters that found no ring are drawn as bare letters (a receiver off the picture's edge): keep them
        for k, s in enumerate(letters):
            if k not in used_letters:
                x, y = to_yd(s["x"], s["y"])
                offense.append({"shape": "letter", "label": s["text"], "x": x, "y": y})
        defenders = []
        for s in cs:
            if classify_span(s) != "defender":
                continue
            t = s["text"]
            role = "DL" if t in DL else "LB" if t in LB else "DB"
            x, y = to_yd(s["x"], s["y"])
            defenders.append({"label": t, "role": role, "x": x, "y": y})
        marks = []
        for s in cs:
            if classify_span(s) == "mark":
                x, y = to_yd(s["x"], s["y"])
                marks.append({"mark": s["text"], "x": x, "y": y})
        front = " ".join(s["text"] for s in sorted((s for s in cs if classify_span(s) == "front"), key=lambda s: s["x"]))
        frontnote = " ".join(s["text"] for s in cs if classify_span(s) == "frontnote")
        cellno = next((s["text"] for s in cs if classify_span(s) == "cellno"), None)
        labels = []
        for cls, kindname in (("redlabel", "block"), ("routelabel", "route"), ("depth", "depth"), ("progression", "progression"), ("bluenote", "note"), ("whitenote", "note"), ("note", "note")):
            groups = group_labels([s for s in cs if classify_span(s) == cls and s["y"] > h["y"] + 10])
            for g in groups:
                x, y = to_yd(g["x"], g["y"])
                labels.append({"kind": kindname, "text": g["text"], "x": x, "y": y, "color": g["color"]})
        paths = []
        for p in by_cell_polys[i]:
            pts = simplify(p["pts"])
            if len(pts) < 2:
                continue
            ypts = [to_yd(x, y) for x, y in pts]
            length_yd = sum(math.hypot(ypts[k + 1][0] - ypts[k][0], ypts[k + 1][1] - ypts[k][1]) for k in range(len(ypts) - 1))
            if length_yd < 0.25:
                continue
            straight = len(pts) == 2
            if straight and length_yd > 14 and abs(ypts[0][1] - ypts[1][1]) < 0.2:
                continue  # the cell's frame
            if straight and length_yd > 10 and abs(ypts[0][0] - ypts[1][0]) < 0.2:
                continue
            arrow = p.get("arrow", [])
            tbar = p.get("tbar", [])
            # start the path at the end that sits on a player (ring, disc or ghost); the other end is the business end
            start_end = None
            best = None
            for where, end in (("start", pts[0]), ("end", pts[-1])):
                for shape, r in all_rings + [("ghost", g) for g in by_cell_ghosts[i]]:
                    d = dist(end, (r["x"], r["y"]))
                    if d < unit * 0.75 and (best is None or d < best[0]):
                        best = (d, where, shape, r)
            if best:
                start_end = best[1]
                if start_end == "end":
                    ypts.reverse()
                    arrow = ["end" if a == "start" else "start" for a in arrow]
                    tbar = ["end" if a == "start" else "start" for a in tbar]
                sx, sy_ = to_yd(best[3]["x"], best[3]["y"])
                anchor = {"shape": best[2], "x": sx, "y": sy_, "dist": round(best[0] / unit, 2)}
            else:
                anchor = None
            end = "arrow" if "end" in arrow else "tbar" if "end" in tbar else "none"
            paths.append({"pts": ypts, "dashed": p["dashed"], "end": end, "startMark": "arrow" if "start" in arrow else "tbar" if "start" in tbar else "none", "anchor": anchor, "width": round(p["width"], 2), "color": p["color"]})
        ghosts_yd = [dict(zip(("x", "y"), to_yd(g["x"], g["y"]))) for g in by_cell_ghosts[i]]
        cells.append({
            "section": section, "page": pageno, "cell": i + 1, "cellNumber": cellno, "title": title,
            "formationLine": h["formation"], "callLine": h["call"], "front": front, "frontNote": frontnote, "inheritedHeader": bool(h.get("inherited")),
            "unit": round(unit, 2), "unitY": round(sy, 2), "centerIsRing": square_is_ring,
            "offense": offense, "ghosts": ghosts_yd, "defenders": defenders, "marks": marks, "labels": labels, "paths": paths,
        })
    return {"section": section, "page": pageno, "title": title, "text": page_text, "cells": cells}


def main():
    pdf_dir, out_dir = sys.argv[1], sys.argv[2]
    only = set(sys.argv[3:])
    os.makedirs(out_dir, exist_ok=True)
    for num, (fname, slug) in SECTIONS.items():
        if only and num not in only:
            continue
        doc = pymupdf.open(os.path.join(pdf_dir, fname))
        kind = "pass" if doc[0].rect.width > doc[0].rect.height else "run"
        pages = []
        for i, page in enumerate(doc):
            res = extract_page(page, slug, i + 1, kind)
            if res and res["cells"]:
                pages.append(res)
        ncells = sum(len(p["cells"]) for p in pages)
        json.dump({"section": slug, "file": fname, "orientation": kind, "pages": pages}, open(os.path.join(out_dir, f"{slug}.json"), "w", encoding="utf-8"), indent=1)
        print(f"{slug}: {len(pages)} diagram pages, {ncells} cells")


if __name__ == "__main__":
    main()
