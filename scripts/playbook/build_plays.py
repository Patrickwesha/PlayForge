"""Pass 1 output + Pass 3: write the checked-in seed data for the route library and the composed plays.

  python scripts/playbook/build_plays.py            (uses every calls.install-N.json + tags.install-N.json present)

A play = an imported formation + a protection + a route word per eligible receiver (or a run family).
This script only BINDS names: it looks the formation up in the imported pack, looks every route word up
in the route library, and records what it could not bind. Geometry is composed at load time by
src/seeds/packers2019Plays.ts with the repo's own helpers, so there is no parallel math here.

Rerunnable: plays are keyed on formation line + call line, output is rewritten whole, same input gives
the same bytes. Verbatim book text never goes into the checked-in files; with the local OCR present a
fuller copy (verbatim descriptions) is written to data/packers-2019/local/ for your own use.
"""
import difflib
import glob
import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from parse_calls import clean, parse_call_line, parse_formation_line  # noqa: E402

ROOT = os.path.join("data", "packers-2019")
OUT_ROUTES = os.path.join("src", "seeds", "data", "packers2019Routes.json")
OUT_PLAYS = os.path.join("src", "seeds", "data", "packers2019Plays.json")
PACK = json.load(open(os.path.join("src", "seeds", "data", "packers2019.json"), encoding="utf-8"))

slug = lambda s: re.sub(r"(^-+|-+$)", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))  # noqa: E731


def stable_hash(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:12]


# ---------------------------------------------------------------- routes (Pass 1)
src = json.load(open(os.path.join(ROOT, "routes.source.json"), encoding="utf-8"))
raw_path = os.path.join(ROOT, "local", "routes.raw.json")
raw = json.load(open(raw_path, encoding="utf-8")) if os.path.exists(raw_path) else []

routes, seen = [], set()
for r in src["routes"]:
    group = r.get("group", "WR")
    key = slug(f"{group}-{r['name']}-{r.get('variant', '')}")
    if key in seen:
        raise SystemExit(f"duplicate route key {key}")
    seen.add(key)
    rng = r.get("depth_range")
    depth = (rng[0] + rng[1]) / 2 if rng else None
    if depth is None and r.get("depth_from_steps"):
        depth = round(r["steps"] * src["steps_to_yards"] * 2) / 2
    pts = []
    for p in r["points"]:
        pt = {"x": p[0], "y": p[1]}
        if len(p) > 2 and p[2] == "s":
            pt["smooth"] = True
        if len(p) > 2 and p[2] == "back-relative":
            pt["relativeY"] = True
        pts.append(pt)
    routes.append(
        {
            "key": key,
            "name": r["name"],
            "variant": r.get("variant"),
            "group": group,
            "frame": r.get("frame", "receiver"),
            "sourcePage": r["source_page"],
            "breakDepthYards": depth,
            "depthRange": rng,
            "steps": r.get("steps"),
            "depthFromSteps": bool(r.get("depth_from_steps")),
            "breakDirection": r["break_direction"],
            "isDoubleMove": r["is_double_move"],
            "vsCoverageAdjustments": r.get("vs", []),
            "landmark": r.get("landmark"),
            "aliasOf": r.get("alias_of"),
            "points": pts,
            "confidence": r["confidence"],
            "note": r.get("note"),
        }
    )
routes_out = {
    "_generated": "Written by scripts/playbook/build_plays.py from data/packers-2019/routes.source.json. Do not edit by hand.",
    "pack": "packers-2019-routes",
    "source": src["source"],
    "stepsToYards": src["steps_to_yards"],
    "revision": stable_hash(routes),
    "routes": routes,
}
json.dump(routes_out, open(OUT_ROUTES, "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)

if raw:
    # local-only fuller copy: the same records with the book's verbatim description joined in by page + name
    full = []
    for r in routes:
        cands = [x for x in raw if x["source_page"] == r["sourcePage"]]
        best = max(cands, key=lambda x: difflib.SequenceMatcher(None, (x["name"] + " " + " ".join(x["name_qualifiers"])).upper(), (r["name"] + " " + (r["variant"] or "")).upper()).ratio(), default=None)
        full.append({**r, "description_verbatim": best["description_verbatim"] if best else None, "ocr_name": best["name"] if best else None})
    json.dump(full, open(os.path.join(ROOT, "local", "routes.library.full.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

by_name = {}
for r in routes:
    by_name.setdefault(r["name"], []).append(r)


def find_route(word, in_backfield):
    """'NAME' or 'NAME:variant' -> route record, preferring the HB tree for a back in the backfield."""
    name, _, variant = word.partition(":")
    cands = by_name.get(name.strip(), [])
    if variant:
        cands = [c for c in cands if (c["variant"] or "").lower() == variant.strip().lower()]
    if not cands:
        return None
    want = "HB" if in_backfield else "WR"
    cands = sorted(cands, key=lambda c: (c["group"] != want, c["variant"] is not None and not variant))
    return cands[0]


# ---------------------------------------------------------------- formations
FORM = {}
for f in PACK["formations"]:
    FORM.setdefault(f["name"].upper(), []).append(f)
# words that are part of a formation NAME in the pack; anything else after the direction is a player/motion tag
NAME_WORDS = sorted({w for f in PACK["formations"] for w in f["name"].upper().split(" RT")[1].split()})


def bind_formation(base, tags, personnel):
    """Longest pack name that starts the tag list. -> (formation entry | None, applied tags, unapplied tags)"""
    tags = [t for t in tags if t != "GUN"]
    for n in range(len(tags), -1, -1):
        if any(t not in NAME_WORDS for t in tags[:n]):
            continue
        name = " ".join([base, "RT"] + tags[:n])
        if name in FORM:
            want = [p for p in (personnel or "").split("/") if p]
            entries = FORM[name]
            pick = next((e for p in want for e in entries if e["personnel"] == p), entries[0])
            return pick, tags[:n], tags[n:]
    return None, [], tags


# ---------------------------------------------------------------- run families and QB rules
def run_family(n):
    if n in (18, 19, 38, 39):
        return "outside-zone"
    if n in (14, 15):
        return "inside-zone"
    if n in (12, 13):
        return "gap"
    return None


RULE_CAP = 240  # short rule text only; the long concept paragraph stays in the book


def concept_rules(first, last):
    """
    QB and OL/TE rule lines per concept page, applied to the diagram pages that follow it.
    Concept pages are two columns (LABEL: | text), and plain OCR text interleaves them, so this reads
    the word boxes: the text for a label is every word to the right of the label column between that
    label and the next one.
    """
    rules, cur = {}, None
    for n in range(first, last + 1):
        path = os.path.join(ROOT, "ocr", "words", f"p-{n:03d}.json")
        if not os.path.exists(path):
            continue
        words = [w for w in json.load(open(path, encoding="utf-8")) if w[0].strip()]
        labels = sorted((w for w in words if re.fullmatch(r"[A-Z/]{2,8}:", w[0]) and w[1] < 330 and w[0] != "NOTES:" and w[4] - w[2] < 30), key=lambda w: w[2])
        names = [w[0] for w in labels]
        if "QB:" in names or any(re.fullmatch(r"\w*CEPT:", x) for x in names):
            cur = {"page": n}
            col = max(w[3] for w in labels) + 8
            notes_y = min((w[2] for w in words if w[0].upper().startswith("NOTES")), default=10 ** 6)
            for i, lab in enumerate(labels):
                key = {"QB:": "qb", "OL/TE:": "ol"}.get(lab[0])
                if not key:
                    continue
                y0 = lab[2] - 6
                y1 = min(labels[i + 1][2] - 6 if i + 1 < len(labels) else 10 ** 6, notes_y)
                body = sorted((w for w in words if w[1] >= col and y0 <= w[2] < y1), key=lambda w: (round(w[2] / 14), w[1]))
                text = re.sub(r"\s+", " ", " ".join(w[0] for w in body)).replace("�", "'").strip()
                if text:
                    cur[key] = text if len(text) <= RULE_CAP else text[:RULE_CAP].rsplit(" ", 1)[0] + " ..."
        if cur:
            rules[n] = cur
    return rules


# ---------------------------------------------------------------- plays (Pass 2 + 3)
def sim(a, b):
    n = lambda s: re.sub(r"[^A-Z0-9]", "", s.upper())  # noqa: E731
    return difflib.SequenceMatcher(None, n(a), n(b)).ratio()


plays, report = {}, {"installs": {}}
for calls_path in sorted(glob.glob(os.path.join(ROOT, "calls.install-*.json"))):
    data = json.load(open(calls_path, encoding="utf-8"))
    install = data["install_number"]
    first, last = data["pages"]
    tags_path = os.path.join(ROOT, f"tags.install-{install}.json")
    tags = json.load(open(tags_path, encoding="utf-8"))["pages"] if os.path.exists(tags_path) else {}
    rules = concept_rules(first, last) if os.path.isdir(os.path.join(ROOT, "ocr", "words")) else {}
    ocr = data["calls"] + data["unparsed"]
    stats = {"calls_ocr_parsed": len(data["calls"]), "calls_unparsed": len(data["unparsed"]), "unparsed_confirmed_by_reading": 0, "cells_ocr_missed": 0, "plays": 0, "derived": 0, "needs_review": 0, "skipped_unparsed": [], "missing_formations": [], "missing_routes": []}
    used = set()
    cells = []

    # pass plays: the cells I read (they carry the route words); matched back to the OCR record for provenance
    for page, items in tags.items():
        for v in items:
            cand = [(sim(v["f"] + v["c"], (o["raw_formation_line"] or "") + (o["raw_call_line"] or "")), i) for i, o in enumerate(ocr) if o["source_page"] == int(page) and i not in used]
            score, idx = max(cand, default=(0, None))
            rec = dict(parse_formation_line(v["f"]) or {})
            if not rec:
                stats["skipped_unparsed"].append({"page": int(page), "raw": f"{v['f']} / {v['c']}", "reason": "formation line does not fit the grammar"})
                continue
            rec.update(parse_call_line(v["c"]))
            rec.update({"source_page": int(page), "raw_formation_line": clean(v["f"]), "raw_call_line": clean(v["c"]), "route_tags": v["tags"], "review": v.get("review")})
            if idx is not None and score >= 0.8:
                used.add(idx)
                if ocr[idx]["status"] == "parsed":
                    rec["call_source"] = "ocr"
                else:
                    rec["call_source"] = "ocr-flagged-confirmed-by-reading"
                    stats["unparsed_confirmed_by_reading"] += 1
            else:
                rec["call_source"] = "read-from-page"
                stats["cells_ocr_missed"] += 1
            cells.append(rec)

    # everything else the OCR parsed cleanly (the runs). Flagged calls stay out: nothing is guessed.
    for i, o in enumerate(ocr):
        if i in used:
            continue
        if str(o["source_page"]) in tags:
            continue  # a pass page: the cells above are the source of truth
        if o["status"] != "parsed":
            stats["skipped_unparsed"].append({"page": o["source_page"], "raw": o["raw_call_string"], "reason": o["reason"]})
            continue
        cells.append({**o, "route_tags": {}, "review": None, "call_source": "ocr"})

    for c in cells:
        page = c["source_page"]
        entry, applied, unapplied = bind_formation(c["formation"], c["adjustment_tags"], c["personnel"])
        label = " ".join([c["formation"], c["direction"]] + [t for t in c["adjustment_tags"] if t != "GUN"])
        if c.get("motion_tag"):
            label = f"{c['motion_tag']} {label}"
        key = slug(f"{label}-{c['raw_call_line']}")
        if key in plays:
            plays[key]["alsoOnPages"] = sorted(set(plays[key].get("alsoOnPages", []) + [page]))
            continue
        reasons = []
        if not entry:
            stats["missing_formations"].append({"page": page, "formation": label})
            continue  # never invent a formation
        if entry["confidence"] != "derived":
            reasons.append(f"formation {entry['name']} [{entry['personnel']}] is itself needs-review (positions are a starting shape)")
        if unapplied:
            reasons.append("alignment or motion tags not applied to the formation: " + " ".join(unapplied))
        if c.get("motion_tag"):
            reasons.append(f"motion {c['motion_tag']} is recorded but not drawn")
        if c["review"]:
            reasons.append(c["review"])
        if c["call_source"] != "ocr":
            reasons.append("call text " + ("was flagged by OCR and confirmed by reading the page" if c["call_source"].startswith("ocr-flagged") else "was read from the page (OCR missed the cell)"))

        concept = c["concept"]
        run_no = c.get("run_number")
        family = run_family(run_no) if run_no and not c["route_tags"] else None
        up = (c["raw_call_line"] or "").upper()
        if c["route_tags"]:
            category = "Screen" if "SCREEN" in up else "PA" if re.search(r"\bP1[45]\b|\bPASS\b|\bFK\b|KEEP", up) else "Pass"
        elif family:
            category = "Run"
        else:
            category = "Special"
            reasons.append("no run family or route words could be bound for this call; formation only")

        route_tags = {}
        for letter, word in c["route_tags"].items():
            spot = next((p for p in entry["players"] if p["spot"] == letter), None)
            if not spot:
                reasons.append(f"{letter} is tagged {word} but the formation has no {letter}")
                continue
            in_backfield = letter in ("H", "F") and spot["y"] <= -3
            r = find_route(word, in_backfield)
            if not r:
                stats["missing_routes"].append({"page": page, "route": word})
                reasons.append(f"route word {word} is not in the library")
                continue
            if r["frame"] == "receiver" and in_backfield:
                reasons.append(f"{letter} runs {r['name']} from a receiver spot, but the imported formation has him in the backfield")
            if r["confidence"] != "derived":
                reasons.append(f"route {r['name']} is needs-review in the library")
            route_tags[letter] = r["key"]
        if family:
            reasons.append("run blocking is drawn from generic family rules (lower fidelity than routes)")
            if "(CAN)" in up:
                reasons.append("'can' call: two plays in one call, only the first is drawn")

        rule = rules.get(page) if category == "Run" else None
        notes = []
        if rule and rule.get("qb"):
            notes.append(f"QB (p-{rule['page']:03d}): {rule['qb']}")
        if rule and rule.get("ol"):
            notes.append(f"OL/TE (p-{rule['page']:03d}): {rule['ol']}")
        pers = c["personnel"] or entry["personnel"]
        plays[key] = {
            "key": key,
            "name": c["raw_call_line"],
            "formationLabel": label,
            "formationKey": entry["key"],
            "direction": c["direction"],
            "personnel": pers,
            "category": category,
            "install": install,
            "sourcePage": page,
            "rawCall": f"[{pers}] {label} / {c['raw_call_line']}",
            "callSource": c["call_source"],
            "adjustmentTags": c["adjustment_tags"],
            "unappliedTags": unapplied,
            "motionTag": c.get("motion_tag"),
            "protection": c.get("protection"),
            "concept": concept,
            "runNumber": run_no if family else None,
            "runFamily": family,
            "routeTags": route_tags,
            "notes": " ".join(notes) or None,
            "confidence": "needs-review" if reasons else "derived",
            "reviewNotes": reasons,
        }
    mine = [p for p in plays.values() if p["install"] == install]
    stats["plays"] = len(mine)
    stats["derived"] = sum(p["confidence"] == "derived" for p in mine)
    stats["needs_review"] = stats["plays"] - stats["derived"]
    stats["by_category"] = {k: sum(p["category"] == k for p in mine) for k in ("Run", "Pass", "PA", "Screen", "Special")}
    report["installs"][install] = stats

ordered = [plays[k] for k in sorted(plays)]
plays_out = {
    "_generated": "Written by scripts/playbook/build_plays.py. Do not edit by hand.",
    "pack": "packers-2019-plays",
    "source": "2019 Green Bay Packers offensive playbook (LaFleur)",
    "revision": stable_hash(ordered),
    "plays": ordered,
}
json.dump(plays_out, open(OUT_PLAYS, "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)

report["routes"] = {"total": len(routes), "derived": sum(r["confidence"] == "derived" for r in routes), "needs_review": [f"{r['name']}{' (' + r['variant'] + ')' if r['variant'] else ''} p-{r['sourcePage']:03d}" for r in routes if r["confidence"] != "derived"]}
json.dump(report, open(os.path.join(ROOT, "import-report.json"), "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)
print(json.dumps({"routes": {"total": report["routes"]["total"], "derived": report["routes"]["derived"], "needs_review": len(report["routes"]["needs_review"])}, "installs": {k: {kk: (len(vv) if isinstance(vv, list) else vv) for kk, vv in v.items()} for k, v in report["installs"].items()}}, indent=1))
