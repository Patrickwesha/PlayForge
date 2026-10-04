"""
Turn the Rams 2022 formation diagrams (scripts/formations/rams_extract.py) into PlayForge formations
named in the Eagles system.

    python scripts/formations/rams_build.py source/rams-2022/formations.raw.json data/formations/rams-2022.system.json

The diagrams are not to scale, so positions are read as PICTURES and put on PlayForge's landmarks
(src/geometry/landmarks.ts), the same spots the editor snaps to:
  - a man within one line split of the end man is attached, a yard apart (TE at 3, the next at 4, ...)
  - a man after a -5- mark stands on Hash +5; after a -3- mark, on Hash +3; men touching him sit a yard either side
  - a # mark is the painted numbers: a man drawn on it is on Mid #s, inside it on Top #s (well inside: #s -2),
    outside it on Bottom #s; a pack extended to the numbers covers Top / Mid / Bottom
  - with no # mark the outermost detached man takes the normal split, #s +2
  - other detached men are slots, spread evenly between the end man and the wide man
  - a letter drawn level with the line is ON the ball, lower is OFF (1 yard)
  - backs: I (0, -5 and -7.5), offset behind a tackle (2, -5), halfback deep at 7.5
Names: the Rams word is replaced by the system word when the picture is the same (Double -> Dice,
Solo -> Deuce, Tout -> Open, Open -> Out, Clout -> Click ...). A Rams word whose system word already
means a different picture (Rams Trout, Rams Buddy) is left out: on film it is the same picture as Trips Open and Buddy.
"""
import json
import re
import sys

# Rams base word -> system word (same picture, checked spot by spot against the Green Bay definitions)
BASE = {
    "DOUBLE": "Dice", "SOLO": "Deuce", "SPREAD": "Dyno", "NORTH": "Sink",
    "SPEED": "Fast", "SPRINT": "Fit", "FAST": "Foot",
    "SPEED PACK": "Crip", "SPRINT PACK": "Crack", "FAST PACK": "Crush", "SWIFT PACK": "Cruz",
    "TRIO": "Trout", "TRICK": "Trio", "BOX": "Bin", "BIO": "Buddy",
}
VAR = {"TITE": "Tight", "TITER": "Tighter", "TIGHTER": "Tighter", "SLIM": "Hip", "SLOPE": "Hop", "TOUT": "Open", "OPEN": "Out", "CLOUT": "Click",
       "UNO": "G", "DOS": "E", "TRES": "D", "RIGHT": "Rt"}
FAMILY = {
    "I": "2 Back", "Strong": "2 Back", "Weak": "2 Back", "Red": "2 Back",
    "West": "3x1 'T'", "East": "3x1 'T'", "Trips": "3x1 'T'", "Troff": "3x1 'T'", "Trout": "3x1 'T'", "Train": "3x1 'T'", "Trio": "3x1 'T'", "Trey": "3x1 'T'", "Treat": "3x1 'T'",
    "Jinx": "3x1 'T'", "Jiggy": "3x1 'T'", "Jam": "3x1 'T'", "Jay": "3x1 'T'", "Jock": "3x1 'T'", "Jolt": "3x1 'T'",
    "Bunch": "Bunch 'B'", "Bin": "Bunch 'B'", "Buddy": "Bunch 'B'", "Bundle": "Bunch 'B'", "Bowl": "Bunch 'B'",
    "Deuce": "2x2 'D'", "Dice": "2x2 'D'", "Dixie": "2x2 'D'", "Dyno": "2x2 'D'",
    "Stack": "2x2 Stack 'S'", "South": "2x2 Stack 'S'", "Sink": "2x2 Stack 'S'", "Snug": "2x2 Stack 'S'",
    "Fast": "1x3 'F'", "Fit": "1x3 'F'", "Foot": "1x3 'F'", "Swift": "1x3 'F'", "Scoot": "1x3 'F'", "Fleet": "1x3 'F'",
    "Crip": "1x3 Bunch 'CR'", "Crack": "1x3 Bunch 'CR'", "Crush": "1x3 Bunch 'CR'", "Cruz": "1x3 Bunch 'CR'",
}
TWELVE = {"West", "East", "Deuce"}
# Rams words whose system word already names a different picture; same picture on film as the note says
LEFT_OUT = {"TROUT": "Trips Open", "BUDDY": "Buddy"}
TOUCH = 1.12  # line splits: closer than this = touching the next man
# The painted numbers on an NFL field, in yards from a ball in the middle (PlayForge landmarks: Top #s, Mid #s, Bottom #s)
NUM_TOP, NUM_MID, NUM_BOTTOM = 14.67, 15.67, 16.67
NUM_IN_2, NUM_OUT_2 = 12.67, 18.67  # "#s -2" and "#s +2" (the normal outside split)
HASH = 3.08  # NFL hash from a ball in the middle
HASH_5, HASH_3 = round(HASH + 5, 2), round(HASH + 3, 2)
ATTACHED = 3.35  # first man this close to the center is attached to the tackle


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def title_case(w):
    return w if w.startswith("(") or w.startswith("#") else w[:1].upper() + w[1:].lower()


def parse_title(title, page):
    t = title.replace("’", "'").replace("�", "'")
    pers = re.search(r"[\[(]([0-9]{2}[XZ]?)(?:/[0-9]{2})?[\])]", t)
    t = re.sub(r"[\[(][0-9/XZ]+[\])]", " ", t)
    t = re.sub(r"\((?:CLICK|ZOOM|TOAST)\)", " ", t)
    words = t.split()
    side = next((i for i, w in enumerate(words) if w in ("RT", "RIGHT", "LT", "LEFT")), None)
    if side is None:
        return None
    base_words, mods = words[:side], words[side + 1:]
    # "TRIO STORE RT", "FAST STAN RT": the second word is a variation, not part of the formation word
    extra = []
    while len(base_words) > 1 and base_words[-1] not in ("PACK",):
        extra.insert(0, base_words.pop())
    rams_base = " ".join(base_words)
    if rams_base in LEFT_OUT:
        return {"leftOut": f"Rams {title_case(rams_base)} is left out: its system word is taken, and on film it is the same picture as {LEFT_OUT[rams_base]}"}
    base = BASE.get(rams_base, " ".join(title_case(w) for w in base_words))
    mods = [VAR.get(w, "Numbers" if w.startswith("#") else title_case(w)) for w in extra + mods]
    if "Pack" in base and base not in FAMILY:  # Jinx Pack, Scoot Pack ...
        fam = "Bunch 'B'" if base.startswith("J") else "1x3 Bunch 'CR'"
    else:
        fam = FAMILY.get(base, "2 Back" if page <= 21 else "3x1 'T'")
    personnel = pers.group(1) if pers else ("21" if page <= 21 else "12" if base in TWELVE else "11")
    if personnel[:2] in ("22", "13", "23"):
        fam = "Big"
    if personnel == "20":
        fam = "2 Back"
    return {"base": base, "ramsBase": rams_base, "mods": mods, "personnel": personnel, "family": fam, "ramsTitle": re.sub(r"\s+", " ", title).strip()}


def place_side(rcv, marks, notes):
    """rcv: one side's receivers [{spot, a, on}] sorted by a (distance from center). Returns {spot: (x, y)}."""
    if not rcv:
        return {}
    clusters = [[rcv[0]]]
    split_marks = [m["a"] for m in marks if m["mark"] in ("-5-", "-3-")]
    for p in rcv[1:]:
        last = clusters[-1][-1]
        between = any(last["a"] - 0.1 <= m <= p["a"] for m in split_marks)  # a split mark between two men: not touching
        if p["a"] - last["a"] <= TOUCH and not between:
            clusters[-1].append(p)
        else:
            clusters.append([p])
    out = {}
    splits = sorted((m for m in marks if m["mark"] in ("-5-", "-3-")), key=lambda m: m["a"])
    hashes = [m["a"] for m in marks if m["mark"] == "#"]
    detached = []
    prev_x, prev_a, prev_te = 2.0, 2.0, False
    for ci, c in enumerate(clusters):
        mark = next((m for m in splits if prev_a - 0.5 <= m["a"] <= c[-1]["a"] + 0.2 and not m.get("used")), None)
        before = any(2.3 < m["a"] < c[0]["a"] - 0.1 for m in splits)  # a split mark between the tackle and him
        if ci == 0 and c[0]["a"] <= ATTACHED and not before:
            for k, p in enumerate(c):
                out[p["spot"]] = (3.0 + k, 0 if p["on"] else -1)
            # a split is measured from the last man ON the line: an off-the-ball wing does not move the end of the line
            on = [k for k, p in enumerate(c) if p["on"]]
            prev_x, prev_a, prev_te = (3.0 + on[-1] if on else 2.0), c[-1]["a"], bool(on)
            continue
        if mark:
            mark["used"] = True
            anchor = next((i for i, p in enumerate(c) if p["on"]), 0)
            ax = HASH_3 if mark["mark"] == "-3-" else HASH_5  # the split marks are landmarks: Hash +3, Hash +5
            for k, p in enumerate(c):
                out[p["spot"]] = (ax + (k - anchor), 0 if p["on"] else -1)
            prev_x, prev_a, prev_te = ax + len(c) - 1 - anchor, c[-1]["a"], False
            continue
        if len(c) >= 2 and c[0]["a"] < 4.9:
            # a touching pair or trio just off the tackle with no mark drawn: the family's 5 yard split
            anchor = next((i for i, p in enumerate(c) if p["on"]), 0)
            ax = HASH_5
            for k, p in enumerate(c):
                out[p["spot"]] = (ax + (k - anchor), 0 if p["on"] else -1)
            prev_x, prev_a, prev_te = ax + len(c) - 1 - anchor, c[-1]["a"], False
            continue
        detached.append(c)
        prev_a = c[-1]["a"]
    # detached clusters: the last is the wide man, the others are slots
    inner = detached[:-1] if detached else []
    for k, c in enumerate(inner, start=1):
        x = round(prev_x + (NUM_OUT_2 - prev_x) * k / (len(inner) + 1), 2)
        anchor = next((i for i, p in enumerate(c) if p["on"]), len(c) - 1)
        for i, p in enumerate(c):
            out[p["spot"]] = (x + (i - anchor), 0 if p["on"] else -1)
    if detached:
        c = detached[-1]
        outer = c[-1]
        x = NUM_OUT_2
        anchor = len(c) - 1
        if hashes:
            h = min(hashes, key=lambda v: abs(v - outer["a"]))
            d = h - outer["a"]
            # on the numbers / just inside them (Edge) / well inside (King)
            x = NUM_MID if abs(d) < 0.25 else NUM_TOP if 0 < d < 1.0 else NUM_IN_2 if d >= 1.0 else NUM_BOTTOM
            if abs(d) < 0.25 and len(c) == 3:
                # a pack extended to the numbers sits ON them: inside man on Top #s, point man in the middle, outside man on Bottom #s
                x, anchor = NUM_MID, 1
        for i, p in enumerate(c):
            out[p["spot"]] = (x + (i - anchor), 0 if p["on"] else -1)
    return out


def build(cell):
    info = parse_title(cell["title"], cell["page"])
    if not info:
        return None, "no formation name"
    if "leftOut" in info:
        return None, info["leftOut"]
    seen, dup = {}, False
    for p in cell["players"]:
        if p["spot"] in ("Q",):
            continue
        back = abs(p["dx"]) <= 2.6 and p["dy"] >= 1.5 and p["spot"] in ("H", "F")
        if p["dy"] > 1.5 and not back:
            continue  # a callout label, not a player
        key = p["spot"]
        if key in seen and (abs(seen[key]["dx"] - p["dx"]) > 0.05 or abs(seen[key]["dy"] - p["dy"]) > 0.05):
            dup = True
        seen[key] = {**p, "back": back}
    if dup:
        return None, "two overlapping drawings in one cell"
    notes = []
    players = {"LT": (-2, 0), "LG": (-1, 0), "C": (0, 0), "RG": (1, 0), "RT": (2, 0), "QB": (0, -1)}
    for p in seen.values():
        if p["back"]:
            side = 0 if abs(p["dx"]) < 1 else (2 if p["dx"] > 0 else -2)
            deep = p["spot"] == "H" and side == 0
            players[p["spot"]] = (side, -7.5 if deep else -5)
    for sign in (-1, 1):
        rcv = sorted(({"spot": p["spot"], "a": abs(p["dx"]), "on": p["dy"] < 0.3} for p in seen.values() if not p["back"] and p["dx"] * sign > 0), key=lambda r: r["a"])
        marks = [{"mark": m["mark"], "a": abs(m["dx"])} for m in cell["marks"] if m["dx"] * sign > 0]
        for spot, (x, y) in place_side(rcv, marks, notes).items():
            players[spot] = (sign * x, y)
    if "H" not in players and info["family"] != "Empty":
        players["H"] = (0, -7.5)
    for need in ("X", "Y", "Z", "F"):
        if need not in players:
            return None, f"no {need} in the drawing"
    if "Click" in info["mods"] and "Z" in players and "Y" in players:
        zx = players["Z"][0]
        players["Y"] = (zx + 1, -1)  # Click: the Y takes the split off the ball just outside the Z
    on_line = sum(1 for s, (x, y) in players.items() if y == 0 and s not in ("QB",))
    confidence = "derived"
    if any(m in ("Store", "Stan") for m in info["mods"]):
        confidence = "needs-review"
        notes.append("Stack variations are drawn loosely in the book: check the stack against the numbers.")
    if on_line != 7:
        confidence = "needs-review"
        notes.append(f"{on_line} men drawn on the line in the book's picture, not 7: check who is on and off the ball.")
    empty = all(not (abs(x) <= 2.6 and y <= -4) for s, (x, y) in players.items() if s in ("H", "F"))
    name = " ".join([info["base"], "Rt"] + info["mods"])
    fam = "Empty" if empty else info["family"]
    rams = info["ramsTitle"]
    return {
        "key": f"{slug(name.replace('(+)', 'plus').replace('(-)', 'minus'))}-{slug(info['personnel'])}",
        "name": name,
        "personnel": info["personnel"],
        "family": fam,
        "strength": "right",
        "qbAlignment": "under",
        "sourcePage": cell["page"],
        "book": "rams-2022",
        "ramsName": rams,
        "confidence": confidence,
        "note": " ".join([f"Alignment from the Rams 2022 general section p.{cell['page']} ({rams})."] + notes),
        "players": [{"spot": s, "x": round(x, 2) + 0, "y": y} for s, (x, y) in players.items()],
    }, None


def main():
    raw = json.load(open(sys.argv[1], encoding="utf-8"))
    out, skipped, keys = [], [], {}
    for cell in raw:
        if cell["page"] < 19 or not cell["title"]:
            continue
        f, why = build(cell)
        if not f:
            skipped.append(f"p{cell['page']} {cell['title']}: {why}")
            continue
        if f["key"] in keys:
            skipped.append(f"p{cell['page']} {cell['title']}: same name as p{keys[f['key']]} ({f['name']} [{f['personnel']}])")
            continue
        keys[f["key"]] = cell["page"]
        out.append(f)
    json.dump({"_generated": "Written by scripts/formations/rams_build.py from the Rams 2022 general section diagrams. Positions and names only.", "formations": out}, open(sys.argv[2], "w", encoding="utf-8", newline="\n"), indent=1)
    print(f"{len(out)} formations, {sum(1 for f in out if f['confidence'] != 'derived')} need review, {len(skipped)} skipped")
    for s in skipped:
        print("  skipped:", s)
    for f in out:
        skill = " ".join(f"{p['spot']}({p['x']},{p['y']})" for p in sorted(f["players"], key=lambda p: p["x"]) if p["spot"] in "XYZFH")
        print(f"{f['sourcePage']} {(f['name'] + ' [' + f['personnel'] + ']').ljust(30)} {('<- ' + f['ramsName']).ljust(34)} {skill}{'  REVIEW' if f['confidence'] != 'derived' else ''}")


if __name__ == "__main__":
    main()
