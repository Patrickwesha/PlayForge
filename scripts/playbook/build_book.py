"""Assemble the readable Green Bay 2019 book and its PlayForge library from the page-by-page work.

  python scripts/playbook/build_book.py

Inputs (all gitignored, copyrighted source material stays on this machine):
  source/book/pages/p-NNN.json   transcription, checked against the page image (falls back to raw OCR)
  source/cells/p-NNN.json        ruled cells (page pixels)
  source/vector/p-NNN.json       traced vector diagrams with their scores
Outputs (gitignored, served by the local app only):
  public/book/gb-2019/book.json      pages in original order, sections, TOC, diagrams
  public/book/gb-2019/library.json   PlayForge backup: formations, plays, the "Green Bay 2019" playbook
  source/book/review.json            every medium / low diagram, for the review page
  source/book/build-report.json      counts
"""
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cellgeom  # noqa: E402
import complete  # noqa: E402
import parse_calls  # noqa: E402

_COMP_PATH = os.path.join("source", "book", "compositions.json")
COMPOSITIONS = json.load(open(_COMP_PATH, encoding="utf8")) if os.path.exists(_COMP_PATH) else {"formations": {}, "routes": {}, "routeNames": []}


CUT = "…"


def comp_for(line):
    key = re.sub(r"\s+", " ", parse_calls.clean(line).upper())
    c = COMPOSITIONS["formations"].get(key)
    return c if c and "players" in c else None


def route_key_for(row_name):
    """The route library record for a route-tree row: name, then the variant in brackets."""
    txt = row_name.replace("\n", " ")
    m = re.match(r"^\s*([^(]+?)\s*(?:\(([^)]*)\))?\s*$", txt)
    if not m:
        return None
    name = re.sub(r"[^A-Z0-9]", "", m.group(1).upper())
    variant = re.sub(r"[^A-Z0-9]", "", (m.group(2) or "").upper())
    cands = [r for r in COMPOSITIONS["routeNames"] if re.sub(r"[^A-Z0-9]", "", r["name"].upper()) == name]
    if not cands:
        # the row name carries a note after the route ("BASIC Boundary = #'s +2 Field = Outside Edge"): try shorter prefixes
        words = m.group(1).upper().split()
        for k in range(len(words) - 1, 0, -1):
            nm = re.sub(r"[^A-Z0-9]", "", "".join(words[:k]))
            cands = [r for r in COMPOSITIONS["routeNames"] if re.sub(r"[^A-Z0-9]", "", r["name"].upper()) == nm]
            if cands:
                break
    if not cands:
        return None
    if variant:
        for r in cands:
            if re.sub(r"[^A-Z0-9]", "", (r["variant"] or "").upper()) == variant:
                return r["key"]
    plain = [r for r in cands if not r["variant"]]
    return (plain or cands)[0]["key"]


def route_diagram(rkey, tcell):
    """One receiver (or back) and his library route, with the page's depth labels beside it."""
    rec = COMPOSITIONS["routes"].get(rkey) or {}
    path = rec.get("wr") or rec.get("hb")
    if not path:
        return None
    back = "wr" not in rec
    rings = tcell.get("rings") or []
    label = rings[0] if rings else ("H" if back else "")
    d = {"players": {"p1": {"id": "p1", "side": "offense", "symbol": "circle", "label": label, "x": 0, "y": 0}},
         "paths": {"r1": {**path, "id": "r1", "anchor": {"kind": "player", "playerId": "p1"}}}, "annotations": {}}
    pts = path["points"]
    ex, ey = pts[-1]["x"], pts[-1]["y"]
    for i, l in enumerate(tcell.get("labels") or []):
        aid = f"t{i + 1}"
        d["annotations"][aid] = {"id": aid, "kind": "text", "x": round(ex + 2.2, 2), "y": round(ey - 0.9 * i, 2), "text": l["text"], "style": "plain", "size": "sm",
                                 "color": l.get("color") if l.get("color") in ("black", "red", "green", "blue", "brown", "orange") else "black"}
    return d

ROOT = "source"
OUT = os.path.join("public", "book", "gb-2019")
BOOK_ID = "gb-2019"
SOURCE_NAME = "2019 Green Bay Packers Training Camp Offensive Playbook"
STAMP = "2026-10-01T00:00:00.000Z"
os.makedirs(OUT, exist_ok=True)

# Section starts: the book's own divider and index pages, titled as printed there (the transcribed title
# of the start page wins when present; these are the fallbacks).
SECTIONS = [
    (1, "Cover"), (2, "Huddle & Cadences"), (8, "Personnel Groupings"), (12, "Formations"),
    (30, "Motions & Shifts"), (38, "Defensive Front Techniques"), (50, "Coverages"), (60, "Blitzes"),
    (70, "Route Tree"), (100, "RB Route Tree"),
    (104, "Install #1 - Runs"), (132, "Install #1 Pass Game"), (148, "Red Zone #1"),
    (158, "Install #2 - Runs"), (184, "Install #2 Pass Game"), (198, "Red Zone #2"),
    (210, "Install #3 - Runs"), (236, "Install #3 - Pass Game"),
    (256, "Install #4 - Runs"), (276, "Install #4 - Pass Game"),
    (298, "Install #5 - Runs"), (312, "Install #5 - Pass Game"),
    (328, "Install #6 - Runs"), (336, "Install #6 - 2 Minute"), (342, "Goal Line Runs"),
    (350, "Install #7 - Pass Game - Extra"), (362, "Short Yardage - 13/22 Personnel"), (370, "Goal Line Passes"),
    (374, "Zone Combination Summary"), (386, "Pass Blocking Terms / Combinations"),
    (396, "Dropback Protections"), (416, "Play Action Protections"), (420, "Play Pass Protections"),
    (446, "Movement Protections"), (454, "Screen Protections"),
]
PLAY_TYPES = {"run-play": "Run", "pass-play": "Pass", "play-action": "PA", "screen": "Screen",
              "situational": "Special", "protection": "Pass", "defense": "Special", "route-tree": "Special",
              "formation": "Special", "concept": "Special"}


def load(path, default=None):
    if os.path.exists(path):
        with open(path, encoding="utf8") as f:
            return json.load(f)
    return default


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:80] or "x"


def norm_words(s):
    return re.sub(r"[^A-Z0-9#$]+", " ", s.upper()).split()


# ------------------------------------------------------------------ text fallback
def ocr_fallback(n):
    rows = load(os.path.join(ROOT, "ocr", f"p-{n:03d}.json"), [])
    rows = sorted(rows, key=lambda r: (round(r["box"][0][1] / 25), r["box"][0][0]))
    text = [r["text"] for r in rows if r["conf"] > 0.6]
    return {"page": n, "type": "other", "title": "", "titleRestored": False, "printedPage": "",
            "blocks": [{"kind": "para", "text": " ".join(text)}] if text else [], "cells": [],
            "uncertain": ["not yet checked against the page image: machine OCR only"], "_unverified": True}


# ------------------------------------------------------------------ vector reconciliation
def label_matches(vec_text, t_text):
    a, b = set(norm_words(vec_text)), set(norm_words(t_text))
    if not a or not b:
        return False
    return len(a & b) / len(a) >= 0.5


LOOK_ALIKE = ["Z2S57", "XK", "HNM", "FEP", "YVT", "QOD", "B83", "W", "C6G", "$S5"]


def look_alike(a, b):
    """Letters a scan misreads for each other (only these are corrected from the page's list)."""
    if len(a) != len(b):
        return False
    return all(x == y or any(x in g and y in g for g in LOOK_ALIKE) for x, y in zip(a.upper(), b.upper()))


def reconcile(vec, tcell, cell_bbox):
    """Fix the traced diagram with the checked transcription: labels take the transcribed spelling and
    colour, missing labels are added at their printed spot, unread ring letters are filled by elimination,
    and ring / defender counts that still disagree lower the confidence."""
    d = json.loads(json.dumps(vec["diagram"]))
    fr = vec["frame"]
    x0, y0 = fr["crop"][0], fr["crop"][1]
    ox, oy = fr["origin"]
    s = fr["pxPerYard"]
    issues = list(vec.get("issues", []))
    conf = vec["confidence"]

    def to_yd(px, py):
        return round((px - x0 - ox) / s, 3), round((oy - (py - y0)) / s, 3)

    # ---- labels
    vlabels = list(d["annotations"].values())
    tlabels = (tcell or {}).get("labels") or []
    new_ann = {}
    used = set()
    for i, tl in enumerate(tlabels):
        if not tl.get("at"):
            continue
        tx, ty = to_yd(*tl["at"])
        near = []
        for v in vlabels:
            dist = math.hypot(v["x"] - tx, v["y"] - ty)
            if dist < 2.2 and (label_matches(v["text"], tl["text"]) or dist < 0.6):
                near.append((dist, v))
        near.sort(key=lambda q: q[0])
        group = [v for _, v in near if id(v) not in used]
        # stacked lines of one printed label: keep the printed line breaks
        group = sorted(group, key=lambda v: -v["y"])
        text = tl["text"]
        if len(group) > 1:
            words = text.split()
            lens = [max(len(v["text"].split()), 1) for v in group]
            lines, k = [], 0
            for j, ln in enumerate(lens):
                take = ln if j < len(lens) - 1 else len(words) - k
                lines.append(" ".join(words[k:k + take]))
                k += take
            if all(lines) and k == len(words):
                text = "\n".join(lines)
        for v in group:
            used.add(id(v))
        if group:
            gx = sum(v["x"] for v in group) / len(group)
            gy = sum(v["y"] for v in group) / len(group)
            fs = max(v.get("fontSize", 0.4) for v in group)
        else:
            gx, gy, fs = tx, ty, 0.42
        aid = f"t{i + 1}"
        col = tl.get("color", "black")
        col = {"yellow": "black", "white": "black", "gray": "black"}.get(col, col)
        new_ann[aid] = {"id": aid, "kind": "text", "x": round(gx, 3), "y": round(gy, 3), "text": text,
                        "style": "bold", "fontSize": round(fs, 3), "color": col if col in ("black", "red", "green", "blue", "brown", "orange") else "black"}
    if tcell is not None:
        d["annotations"] = new_ann
    # ---- ring letters: the page's list is the truth; fix what the trace read wrong when the fix is certain
    rings = Counter((tcell or {}).get("rings") or [])
    offense = [p for p in d["players"].values() if p["side"] == "offense" and p["symbol"] != "square"]
    if tcell is not None:
        # the halfback is printed H on some pages and HB on others: use the page's spelling
        for a, b in (("H", "HB"), ("HB", "H")):
            if rings[b] and not rings[a]:
                for p in offense:
                    if p["label"] == a:
                        p["label"] = b
        unread_ids = set(vec.get("unread", []))
        unread = [p for p in offense if p["id"] in unread_ids and not p["label"]]
        have = Counter(p["label"] for p in offense if p["label"])
        missing = rings - have
        # unread rings take the missing letters when there is only one way to do it
        if unread and sum(missing.values()) == len(unread) and (len(unread) == 1 or len(missing) == 1):
            for p, letter in zip(unread, sorted(missing.elements())):
                p["label"] = letter
            issues = [i for i in issues if "unread label" not in i]
        have = Counter(p["label"] for p in offense if p["label"])
        missing, extra = rings - have, have - rings
        # one letter read as another (Z for S, X for K): a single kind of swap is unambiguous
        if missing and extra and len(missing) == 1 and len(extra) == 1 and sum(missing.values()) == sum(extra.values())                 and look_alike(next(iter(extra)), next(iter(missing))):
            wrong, right = next(iter(extra)), next(iter(missing))
            for p in offense:
                if p["label"] == wrong:
                    p["label"] = right
            issues.append(f"ring letter {wrong} corrected to {right} from the page")
            have = Counter(p["label"] for p in offense if p["label"])
            missing, extra = rings - have, have - rings
        if extra:
            issues.append("ring letters not in the drawing: " + " ".join(sorted(extra.elements())))
        if missing:
            issues.append("ring letters not rebuilt: " + " ".join(sorted(missing.elements())))
        bad = sum(extra.values()) + sum(missing.values())
        if bad:
            conf = "low" if bad > 1 else ("medium" if conf == "high" else conf)
        # ---- defenders, the same way
        norm = lambda x: re.sub(r"\W", "", x).upper()
        defs = Counter(norm(x) for x in (tcell.get("defenders") or []))
        dplayers = [p for p in d["players"].values() if p["side"] == "defense"]
        hd = Counter(norm(p["label"]) for p in dplayers)
        dmiss, dextra = defs - hd, hd - defs
        if dmiss and dextra and len(dmiss) == 1 and len(dextra) == 1 and sum(dmiss.values()) == sum(dextra.values())                 and look_alike(next(iter(dextra)), next(iter(dmiss))):
            wrong, right = next(iter(dextra)), next(iter(dmiss))
            for p in dplayers:
                if norm(p["label"]) == wrong:
                    p["label"] = right if right != "NW" else "Nw"
            issues.append(f"defender {wrong} corrected to {right} from the page")
            hd = Counter(norm(p["label"]) for p in dplayers)
            dmiss, dextra = defs - hd, hd - defs
        dbad = sum(dmiss.values()) + sum(dextra.values())
        if dbad:
            issues.append(f"{dbad} defender letter(s) differ from the page")
            if dbad > 2:
                conf = "low"
            elif conf == "high":
                conf = "medium"
    return d, conf, issues


def view_of(vec):
    fr = vec["frame"]
    x0, y0, x1, y1 = fr["crop"]
    ox, oy = fr["origin"]
    s = fr["pxPerYard"]
    W, H = x1 - x0, y1 - y0
    return {"minX": round(-ox / s, 3), "maxX": round((W - ox) / s, 3), "minY": round((oy - H) / s, 3), "maxY": round(oy / s, 3)}


# ------------------------------------------------------------------ assemble
def section_of(n):
    cur = 0
    for i, (start, _) in enumerate(SECTIONS):
        if n >= start:
            cur = i
    return cur


pages, toc, review = [], [], []
formations, plays = {}, []
form_best = {}
counts = Counter()
anchors_used = Counter()


def anchor(base):
    anchors_used[base] += 1
    return base if anchors_used[base] == 1 else f"{base}-{anchors_used[base]}"


section_titles = {}
for n in range(1, 478):
    t = load(os.path.join(ROOT, "book", "pages", f"p-{n:03d}.json")) or ocr_fallback(n)
    cells_det = {c["id"]: c for c in cellgeom.page_cells(n, ROOT)}
    vecs = load(os.path.join(ROOT, "vector", f"p-{n:03d}.json"), {})
    crop_boxes = load(os.path.join(ROOT, "book", "crops", f"p-{n:03d}.json"), {})
    si = section_of(n)
    if SECTIONS[si][0] == n and t.get("title"):
        section_titles[si] = t["title"]
    page = {"n": n, "type": t.get("type", "other"), "title": t.get("title", ""), "titleRestored": bool(t.get("titleRestored")),
            "printedPage": t.get("printedPage", ""), "section": si, "blocks": t.get("blocks", []), "cells": [],
            "uncertain": t.get("uncertain", []), "unverified": bool(t.get("_unverified")),
            "anchor": f"page-{n}", "titleAnchor": anchor(f"p{n}-" + slug(t.get("title") or "page"))}
    counts["pages"] += 1
    counts["unverified" if page["unverified"] else "verified"] += 1
    tcells = t.get("cells", [])
    route_cells = {}
    if t.get("type") == "route-tree":
        for b in t.get("blocks", []):
            if b.get("kind") == "table":
                for r in b.get("rows", []):
                    for vcell in r:
                        m = re.fullmatch(r"@(\w+)", vcell.strip())
                        if m and r and r[0].strip():
                            if r[0].startswith(CUT):  # the scan cut the route's name: the library knows the rest of it
                                first, _, rest = r[0].partition(chr(10))
                                tail = re.sub(r"[^A-Z0-9]", "", first[1:].upper())
                                full = [x["name"] for x in COMPOSITIONS["routeNames"] if re.sub(r"[^A-Z0-9]", "", x["name"].upper()).endswith(tail) and len(tail) >= 4]
                                if full:
                                    r[0] = full[0] + (chr(10) + rest if rest else "")
                                    b.setdefault("restored", []).append(b["rows"].index(r))
                                    counts["restored-route-names"] += 1
                            rk = route_key_for(r[0])
                            if rk:
                                route_cells[m.group(1)] = rk
    order = [c["id"] for c in tcells] or list(cells_det)
    tc_map = {c["id"]: c for c in tcells}
    for cid in order:
        det = cells_det.get(cid)
        tc = tc_map.get(cid, {})
        bbox = (det or {}).get("bbox") or tc.get("bbox")
        if not bbox:
            continue
        kind = tc.get("kind") or ("diagram" if cid in vecs else "text")
        if kind == "text" and cid not in vecs:
            continue  # its words are in the page blocks
        cell = {"id": cid, "kind": kind, "bbox": bbox, "lines": tc.get("lines", []), "footer": tc.get("footer", ""),
                "badges": tc.get("badges", []), "notes": tc.get("notes", ""), "labels": tc.get("labels", []),
                "rings": tc.get("rings", []), "defenders": tc.get("defenders", []),
                "crop": f"crops/p-{n:03d}-{cid}.webp", "cropBox": crop_boxes.get(cid, bbox), "cutLeft": bool((det or {}).get("cutLeft")), "cutRight": bool((det or {}).get("cutRight"))}
        name = " / ".join(cell["lines"]) if cell["lines"] else ""
        cell["anchor"] = anchor(f"p{n}-" + slug(name or cid))
        v = vecs.get(cid)
        vector = None
        guesses = []
        if kind == "diagram":
            line1 = cell["lines"][0] if cell["lines"] else ""
            comp = comp_for(line1) if line1 else None
            gun = bool(re.search(r"\((G)\)|\bGUN\b", line1, re.I))
            diag, conf, issues, base_view, recall, precision = None, "low", [], None, 0.0, 0.0
            if v and "diagram" in v:
                diag, conf, issues = reconcile(v, tc if tc else None, bbox)
                base_view, recall, precision = view_of(v), v["score"]["recall"], v["score"]["precision"]
            else:
                issues = ["the drawing could not be traced"]
                rk = route_cells.get(cid)
                if page["type"] == "route-tree" and rk:
                    diag = route_diagram(rk, tc)
                    if diag:
                        issues = ["drawn from the route library (the book's own route description), not traced"]
                        conf = "medium"
                if diag is None and comp:
                    diag, guesses = complete.from_composition(comp, tc, gun)
            if diag is not None:
                diag, more = complete.Completion(diag, tc, page["type"], comp, cell["cutLeft"], cell["cutRight"], gun).run()
                guesses += more
                if guesses:
                    issues = issues + [f"{len(guesses)} guessed placement(s)"]
                vector = {"diagram": diag, "view": complete.view_for(diag, base_view), "confidence": conf, "recall": recall,
                          "precision": precision, "issues": issues, "guesses": guesses}
                counts["guesses"] += len(guesses)
                if guesses:
                    counts["cells-with-guesses"] += 1
        cell["vector"] = vector
        cell["guesses"] = guesses
        if kind == "diagram":
            counts["diagrams"] += 1
            counts["conf-" + (vector["confidence"] if vector else "none")] += 1
            if not vector or vector["confidence"] != "high":
                review.append({"page": n, "cell": cid, "name": name, "confidence": vector["confidence"] if vector else "none",
                               "issues": vector["issues"] if vector else ["no vector: the drawing could not be traced"],
                               "crop": cell["crop"], "anchor": cell["anchor"]})
        # ---- library: one play per diagram cell
        if kind == "diagram":
            pid = f"gb19-p{n:03d}-{cid}"
            cell["playId"] = pid
            line1 = cell["lines"][0] if cell["lines"] else ""
            line2 = cell["lines"][1] if len(cell["lines"]) > 1 else ""
            pers = re.match(r"^\s*\[([0-9/]+)\]\s*", line1 or page["title"])
            personnel = pers.group(1) if pers else None
            form_label = re.sub(r"^\s*\[[0-9/]+\]\s*", "", line1).strip()
            diagram = (vector or {}).get("diagram") or {"players": {}, "paths": {}, "annotations": {}}
            conf_word = vector["confidence"] if vector else "low"
            notes = None
            if conf_word != "high" or guesses:
                parts = [f"Rebuilt from the scan with {conf_word} confidence"]
                if guesses:
                    parts.append(f"{len(guesses)} placement(s) by educated guess: " + "; ".join(g.split(":")[0] for g in guesses[:8]))
                notes = "; ".join(parts) + f". Check it against page {n} in the Green Bay 2019 reader."
            play = {
                "id": pid, "name": line2 or line1 or page["title"] or f"Page {n} {cid}",
                "formationLabel": form_label or None, "personnel": personnel,
                "category": PLAY_TYPES.get(page["type"], "Special"),
                "tags": [t for t in ["gb-2019", page["type"], SECTIONS[si][1]] if t],
                "positionNotes": {}, "diagram": diagram,
                "source": SOURCE_NAME, "sourcePage": n, "sourceCell": cid,
                "rawCall": name or None,
                "createdAt": STAMP, "updatedAt": STAMP,
            }
            if vector:
                play["rebuild"] = {"confidence": vector["confidence"], "recall": vector["recall"], "precision": vector["precision"],
                                   "issues": (vector["issues"] + guesses)[:20], "method": "traced"}
            if cell["footer"]:
                play["defense"] = {"front": cell["footer"]}
            if notes:
                play["notes"] = notes
            play = {k: v for k, v in play.items() if v is not None}
            plays.append((si, play))
            # formation: one per distinct formation line (+ personnel); positions from its best drawing
            if form_label and vector and vector["confidence"] in ("high", "medium") and not guesses:
                fkey = (form_label.upper(), personnel or "")
                score = vector["recall"] + vector["precision"]
                fid = "gb19-f-" + slug(form_label + ("-" + personnel if personnel else ""))
                off = {k: p for k, p in vector["diagram"]["players"].items() if p["side"] == "offense"}
                if len(off) >= 9 and (fkey not in form_best or score > form_best[fkey][0]):
                    form_best[fkey] = (score, fid, off, n, cid)
                play["formationId"] = fid
        page["cells"].append(cell)
    # reading order on the page: rows (tops within 120 px), then left to right; added cells fall into place
    rows_ = []
    for c in sorted(page["cells"], key=lambda c: c["bbox"][1]):
        if rows_ and c["bbox"][1] - rows_[-1][0]["bbox"][1] < 120:
            rows_[-1].append(c)
        else:
            rows_.append([c])
    page["cells"] = [c for r in rows_ for c in sorted(r, key=lambda c: c["bbox"][0])]
    pages.append(page)

for (name, pers), (score, fid, players, n, cid) in form_best.items():
    formations[fid] = {
        "id": fid, "name": name, "side": "offense", "personnel": pers or None, "playersPerSide": 11 if len(players) >= 11 else max(6, min(12, len(players))) if len(players) in (6, 7, 8, 9, 11, 12) else 11,
        "players": players, "tags": ["gb-2019"], "source": SOURCE_NAME, "sourcePage": n,
        "note": f"Drawn as on page {n} ({cid}); spacing follows the drawing (OL 1 yd apart).",
        "createdAt": STAMP, "updatedAt": STAMP,
    }
    formations[fid] = {k: v for k, v in formations[fid].items() if v is not None}
# plays pointing at a formation that did not make it (no good drawing) lose the link
for _, p in plays:
    if p.get("formationId") and p["formationId"] not in formations:
        del p["formationId"]

# ------------------------------------------------------------------ text the scan cut off
CUT = "\u2026"
key_vocab = Counter()
for p in pages:
    for b in p["blocks"]:
        if b.get("kind") == "kv":
            for k, _v in b["rows"]:
                if k and not k.startswith(CUT) and k != CUT:
                    key_vocab[k] += 1
# the label sequences of the concept pages, for rows whose label is wholly cut
seq_vocab = Counter()
for p in pages:
    for b in p["blocks"]:
        if b.get("kind") == "kv" and all(k and not k.startswith(CUT) and k != CUT for k, _v in b["rows"]):
            seq_vocab[tuple(k for k, _v in b["rows"])] += 1
for p in pages:
    for b in p["blocks"]:
        if b.get("kind") != "kv":
            continue
        restored = []
        keys = [k for k, _v in b["rows"]]
        for i, (k, _v) in enumerate(b["rows"]):
            if k and k.startswith(CUT) and len(k) > 1:
                tail = k[1:]
                cands = [(cnt, full) for full, cnt in key_vocab.items() if full.endswith(tail) and len(full) > len(tail)]
                if cands:
                    cands.sort(reverse=True)
                    keys[i] = cands[0][1]
                    restored.append(i)
        if any(k == CUT or not k for k in keys):
            # a sequence of the same length whose known labels agree
            best = None
            for seq, cnt in seq_vocab.most_common():
                if len(seq) != len(keys):
                    continue
                if all(k in (CUT, "") or k == sk for k, sk in zip(keys, seq)):
                    best = seq
                    break
            if best:
                for i, k in enumerate(keys):
                    if k in (CUT, ""):
                        keys[i] = best[i]
                        restored.append(i)
        if restored:
            b["rows"] = [[keys[i], v] for i, (_k, v) in enumerate(b["rows"])]
            b["restored"] = sorted(set(restored))
            counts["restored-labels"] += len(set(restored))

# ------------------------------------------------------------------ the book's own indexes become links
def key(s):
    s = re.sub(r"^[…\s]+", "", s or "")
    s = re.sub(r"\[[^\]]*\]", " ", s)  # personnel brackets
    return " ".join(re.sub(r"[^A-Z0-9#\-]+", " ", s.upper()).split())


def find_target(text, lo, hi, prefer_cells=True):
    k = key(text)
    if len(k) < 3:
        return None
    for p in pages[lo - 1:hi]:
        if p["type"] in ("index", "divider", "blank"):
            continue
        t = key(p["title"])
        if t and (k in t or (len(t) > 6 and t in k)):
            return "#" + p["anchor"]
    if prefer_cells:
        for p in pages[lo - 1:hi]:
            for c in p["cells"]:
                for ln in c["lines"]:
                    if k == key(ln) or (len(k) > 8 and k in key(ln)):
                        return "#" + c["anchor"]
    return None


route_pages = [p for p in pages if p["type"] == "route-tree"]
for p in pages:
    if p["type"] != "index":
        continue
    si = p["section"]
    lo = p["n"]
    hi = SECTIONS[si + 1][0] - 1 if si + 1 < len(SECTIONS) else 477
    for b in p["blocks"]:
        if b.get("kind") == "table":
            b["hrefs"] = [find_target(r[0] if r else "", lo, hi) for r in b.get("rows", [])]
            restored = []
            for i, (r, h) in enumerate(zip(b["rows"], b["hrefs"])):
                if r and r[0].startswith(CUT) and h and h.startswith("#"):
                    tgt = next((q for q in pages if "#" + q["anchor"] == h or "#" + q["titleAnchor"] == h), None)
                    if tgt and tgt["title"] and key(r[0][1:]) and key(r[0][1:]) in key(tgt["title"]):
                        r[0] = tgt["title"]
                        restored.append(i)
            if restored:
                b["restored"] = restored
                counts["restored-index-rows"] += len(restored)
        elif b.get("kind") == "heading":
            m = re.match(r"^PAGE\s+(\d+)", b["text"].strip(), re.I)
            if m:
                tgt = next((q for q in route_pages if q["printedPage"] == m.group(1)), None)
                if tgt:
                    b["href"] = "#" + tgt["anchor"]
        elif b.get("kind") == "list":
            hrefs = []
            for it in b.get("items", []):
                k = key(it)
                hit = None
                for q in route_pages:
                    for bb in q["blocks"]:
                        if bb.get("kind") == "table" and not hit:
                            for r in bb.get("rows", []):
                                if r and k and key(r[0].splitlines()[0] if r[0] else "").startswith(k):
                                    hit = "#" + q["anchor"]
                                    break
                    if hit:
                        break
                hrefs.append(hit if hit else find_target(it, lo, hi))
            b["hrefs"] = hrefs
            counts["index-links"] += sum(1 for h in hrefs if h)
    for b in p["blocks"]:
        if b.get("kind") == "table":
            counts["index-links"] += sum(1 for h in b["hrefs"] if h)
            counts["index-rows"] += len(b["hrefs"])

# ------------------------------------------------------------------ sections and TOC
sections = []
for i, (start, fallback) in enumerate(SECTIONS):
    end = SECTIONS[i + 1][0] - 1 if i + 1 < len(SECTIONS) else 477
    title = section_titles.get(i) or fallback
    if re.fullmatch(r"2019 (TRAINING CAMP|INSTALL).*", title or "", re.I) or not title.strip():
        # index pages put the section name in their first heading (INSTALL #1 - RUNS, DROPBACK PROTECTIONS)
        heads = [b["text"] for b in pages[start - 1]["blocks"] if b.get("kind") == "heading"]
        title = heads[0] if heads else fallback
    entries = []
    for p in pages[start - 1:end]:
        kids = [{"label": " / ".join(c["lines"]), "anchor": c["anchor"]} for c in p["cells"] if c["kind"] == "diagram" and c["lines"]]
        if p["type"] == "route-tree":
            for b in p["blocks"]:
                if b.get("kind") == "table":
                    for r in b.get("rows", []):
                        if r and r[0].strip():
                            kids.append({"label": r[0].replace("\n", " "), "anchor": p["anchor"]})
        entries.append({"label": p["title"] or ("Blank" if p["type"] == "blank" else p["type"].replace("-", " ").title()),
                        "page": p["n"], "anchor": p["anchor"], "children": kids})
    sections.append({"id": f"s{i + 1}", "title": title, "start": start, "end": end, "anchor": f"page-{start}", "entries": entries})

# The reader only draws high-confidence rebuilds; every other rebuild (with its drawing) goes to the review
# file, so the reader stays light enough to render on this machine.
review_cells = []
for p in pages:
    for c in p["cells"]:
        v = c.get("vector")
        if v and v["confidence"] != "high":
            review_cells.append({"page": p["n"], "cell": c["id"], "lines": c["lines"], "anchor": c["anchor"], "crop": c["crop"],
                                 "cropBox": c["cropBox"], "vector": v})
book = {"id": BOOK_ID, "title": "Green Bay 2019", "source": SOURCE_NAME, "pageCount": 477,
        "built": STAMP, "sections": sections, "pages": pages}
with open(os.path.join(OUT, "book.json"), "w", encoding="utf8") as f:
    json.dump(book, f, ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(OUT, "review.json"), "w", encoding="utf8") as f:
    json.dump({"id": BOOK_ID, "title": "Green Bay 2019", "cells": review_cells}, f, ensure_ascii=False, separators=(",", ":"))

playbook = {
    "id": BOOK_ID, "name": "Green Bay 2019", "subtitle": "LaFleur offense",
    "cover": {"title": "Green Bay 2019", "subtitle": "2019 Training Camp Offensive Playbook", "team": "Green Bay Packers", "season": "2019", "showCover": True},
    "sections": [{"id": f"gb19-s{i + 1}", "title": sections[i]["title"], "kind": "plays",
                  "itemIds": [p["id"] for si, p in plays if si == i]} for i in range(len(SECTIONS)) if any(si == i for si, _ in plays)],
    "defaultLayout": "4up", "paper": "letter", "createdAt": STAMP, "updatedAt": STAMP,
}
library = {"app": "playforge", "version": 2, "exportedAt": STAMP, "formations": list(formations.values()),
           "plays": [p for _, p in plays], "playbooks": [playbook],
           "settings": {"hashPreset": "nfl", "theme": "plain", "paper": "letter", "defaultPlayersPerSide": 11, "flipSwapsXZ": False, "showLandmarks": False}}
with open(os.path.join(OUT, "library.json"), "w", encoding="utf8") as f:
    json.dump(library, f, ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(ROOT, "book", "review.json"), "w", encoding="utf8") as f:
    json.dump(review, f, ensure_ascii=False, indent=1)
counts["formations"] = len(formations)
counts["plays"] = len(plays)
with open(os.path.join(ROOT, "book", "build-report.json"), "w") as f:
    json.dump(dict(counts), f, indent=1)
print(json.dumps(dict(counts)))
