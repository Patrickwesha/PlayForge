"""
Turn the extracted Rams 2022 diagram cells into PlayForge play specs named in the Eagles / Green Bay system.

    python scripts/rams/build_plays.py source/rams-2022/cells src/seeds/data/rams2022Plays.json

Inputs (all positions, names, page numbers and paraphrases; no book sentences):
  source/rams-2022/cells/*.json           every diagram cell (scripts/rams/extract_cells.py)
  source/rams-2022/text/*.txt             only the p3 index of each section (concept titles and pages)
  src/seeds/data/packers2019.json         the formation pack (system names, Rams names as aliases)
  data/systems/eagles-2026/{runs,pass}.json   the word map: Green Bay word = system word, Rams word = alias
  data/rams-2022/installs.json            Rams concept -> Green Bay install number and situation
  data/rams-2022/notes/*.json             paraphrased concept notes (per section)
  data/rams-2022/blocking-glossary.json   paraphrased line calls
  data/rams-2022/routes-glossary.json     paraphrased routes
  data/rams-2022/fronts.json              the Rams fronts (names)

The spec keeps the diagram's own geometry (players, defenders, labels, routes and blocks in yards of the drawing's
frame) next to the translated words; src/seeds/rams2022Plays.ts puts the offense on the pack formation's landmarks
and warps the drawing onto it.
"""
import glob
import hashlib
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(ROOT, "source")

# ---------------------------------------------------------------- the word map (Rams word -> system word)
BASE = {
    "DOUBLE": "Dice", "DBL": "Dice", "SOLO": "Deuce", "SPREAD": "Dyno", "NORTH": "Sink",
    "SPEED": "Fast", "SPRINT": "Fit", "FAST": "Foot",
    "SPEED PACK": "Crip", "SPRINT PACK": "Crack", "FAST PACK": "Crush", "SWIFT PACK": "Cruz",
    "TRIO": "Trout", "TRICK": "Trio", "BOX": "Bin", "BIO": "Buddy",
}
VAR = {"TITE": "Tight", "TITER": "Tighter", "TIGHTER": "Tighter", "SLIM": "Hip", "SLOPE": "Hop", "TOUT": "Open", "OPEN": "Out", "CLOUT": "Click",
       "UNO": "G", "DOS": "E", "TRES": "D", "#'S": "Numbers", "#S": "Numbers"}
# alignment words the tag engine (src/geometry/formationTags.ts) knows
ENGINE_ALIGN = {"CLOSE", "CLOSER", "OFF", "CLAMP", "CLICK", "OPEN", "OUT", "TIGHT", "TIGHTER", "SLOT", "ZOOM", "HIP", "HOP", "ACE", "BOOK", "NUMBERS", "GUN", "(+)", "(-)", "A", "B", "C", "D", "E", "G"}
ENGINE_MOTION = {"MO", "LT", "RT", "RIGHTY", "LEFTY", "SHORT", "SHORTY", "SH", "CTR", "COUNTER", "FLY", "HOME", "BEHIND", "HAY", "HAX", "FOY", "FOX", "BUMP", "LAB", "RAT", "TRIXIE"}
# Rams motion word -> (system word, who)  ("across" = Lt for a Rt call, Rt for a Lt call)
MOTION = {
    "ZAC": ("across", "Z"), "FAX": ("across", "F"), "YUCK": ("across", "Y"), "SOCK": ("across", "X"),
    "ZAC-O": ("Lefty", "Z"), "ZAC O": ("Lefty", "Z"), "FAX-O": ("Lefty", "F"), "FAX O": ("Lefty", "F"), "YUCK-O": ("Lefty", "Y"), "SOCK-O": ("Lefty", "X"),
    "TY": ("HAY", "H"), "TEX": ("HAX", "H"), "F IN": ("HOME", "F"), "BOLT": ("BEHIND", None), "HOVER": ("HOVER", None), "ORBIT": ("ORBIT", None),
    "FLY": ("FLY", None), "FLOW": ("FLOW", None), "FLIGHT": ("FLIGHT", None), "FLOCK": ("FLOCK", None), "FLOAT": ("FLOAT", None), "FLUTTER": ("FLUTTER", None), "SOAR": ("SOAR", None),
    "SHORT": ("SHORT", None), "MO": ("MO", None), "COUNTER": ("COUNTER", None), "DOT": ("DOT", None), "OZ": ("OZ", None), "SKIP": ("SKIP", None), "JUMP": ("JUMP", None),
    "LAB": ("LAB", "H"), "RAT": ("RAT", "H"), "LASSO": ("LASSO", "H"), "ROPE": ("ROPE", "H"), "FUZZ": ("BUMP", "F"), "HOP": ("BUMP", "H"), "TRADE": ("TRADE", None), "SLY": ("SLY", None),
}
LETTERS = {"X", "Y", "Z", "F", "H", "Q"}
# words that mean the same thing in both books, Rams spelling -> system spelling (call words)
CALL_WORDS = {
    "ZAP FUP": "QUATRO", "BARKLEY": "STANLEY", "RACE": "BOUNCE", "FAULK": "ARCHES", "DAGGER": "DOVER", "SPECIAL": "THRU", "PRESSURE": "TREE",
    "INDY": "INDIVIDUAL", "BULLET": "BARK", "T.O.": "PUMP", "O.T.": "PUMP", "OTB": "OVER", "BOBCAT": "FADE BACK", "POINT": "SURGE ARROW",
    "LIONS": "BOTH LION", "RUFFLES": "SPECIAL CHIP SCREEN", "LAYS": "SPECIAL CHIP SCREEN", "HOUSE": "WILLIAM SCREEN", "HEFNER": "WILLIAM SCREEN",
    "ROOF": "Y SCREEN", "CEILING": "Y SCREEN", "RACER": "SLEDGE", "FUP": "4 CALL", "PULSE": "PULL", "SHOVE": "PUSH", "SKATE": "SLIDE",
}
PROTECTIONS = ["200 JET", "300 JET", "2 JET", "3 JET", "200 SCAT", "300 SCAT", "2 SCAT", "3 SCAT", "200 SCRAM", "300 SCRAM", "2 SCRAM", "3 SCRAM", "SCRAM", "SCAT",
               "3 SCRABBLE", "2 SCRABBLE", "SCRABBLE", "JAX LT", "JAX RT", "2 TIMELY", "3 TIMELY", "58", "59", "WEEZY MADISON LICK", "WEEZY MADISON", "WEEZY", "FOAM", "FIZZ",
               "GRIZZLY SUCKER", "GRIZZLY STAPLE", "GRIZZLY PIN", "GRIZZLY", "LAKER FLOCK PIN", "LAKER PIN", "LAKER", "MILF FROG", "MILF MADISON", "MILF", "MAYS",
               "PADDY INSERT", "PADDY FLY", "PADDY", "P12 DIME FLOCK", "P12 DIME FLOW", "P12 DIME FLY", "P13 DIME FLY", "P12 DIME", "P13 DIME", "P12 PUNCH FLIGHT", "P12 PUNCH", "P13 PUNCH",
               "P15 WILLIE", "P14 WILLIE", "ACTION 3 JET", "ACTION 2 JET", "JOE FLOW MADISON", "JOE MADISON", "JOE", "ROLL RT FLY", "ROLL LT FLY", "ROLL RT", "ROLL LT",
               "RANDALL", "LAMAR", "LIZARD", "REPTILE", "FIRE 2 FLY", "BOOT RT", "BOOT LT", "CENTER RT", "CENTER LT"]
PROTECTION_SYSTEM = {"58": "Y6", "59": "Y7", "RANDALL": "FK 18 Keep", "LAMAR": "FK 19 Keep", "FOAM": "P19 Waggle (Foam)", "FIZZ": "P18 Waggle (Fizz)",
                     "MAYS": "P15 Willie (Mays)", "MILF": "P14 Willie (Milf)", "PADDY": "P12 Duo (Paddy)", "JAX LT": "Jax Lt", "JAX RT": "Jax Rt"}
RUN_SECTIONS = {"wide-zone", "mid-zone", "gun-mid-zone", "tight-zone", "dive-zone", "gap", "perimeter", "sweeps-specials"}
FAMILY = {"wide-zone": "Wide Zone", "mid-zone": "Mid Zone", "gun-mid-zone": "Mid Zone (gun)", "tight-zone": "Tight Zone", "dive-zone": "Dive Zone / Zone Read", "gap": "Gap", "perimeter": "Perimeter",
          "sweeps-specials": "Sweeps and Specials", "3-step": "Quick game", "7-step": "Drop back", "dropback-cans": "Drop back (cans)", "play-pass": "Play pass", "play-pass-cans": "Play pass (cans)",
          "movement": "Movement", "screens": "Screens", "run-alerts": "Run alerts", "red-zone": "Red zone", "two-minute": "Two minute", "pass-pro": "Protections"}
SITUATION = {"red-zone": "red-zone", "two-minute": "two-minute", "run-alerts": "run-alerts", "pass-pro": "protections"}
SECTION_FILE = {"05": "pass-pro", "06": "wide-zone", "07": "mid-zone", "08": "gun-mid-zone", "09": "tight-zone", "10": "dive-zone", "11": "gap", "12": "perimeter", "13": "sweeps-specials",
                "14": "3-step", "16": "7-step", "17": "dropback-cans", "18": "play-pass", "19": "play-pass-cans", "20": "movement", "21": "screens", "22": "run-alerts", "23": "red-zone", "24": "two-minute"}
RUN_FAMILY = {"wide-zone": "outside-zone", "mid-zone": "mid-zone", "gun-mid-zone": "mid-zone", "tight-zone": "inside-zone", "dive-zone": "inside-zone", "gap": "gap", "perimeter": "perimeter", "sweeps-specials": "sweep"}


def title_case(w):
    return w if w.startswith("(") or w.startswith("#") or re.fullmatch(r"[A-G]", w) else w[:1].upper() + w[1:].lower()


def norm(s):
    return re.sub(r"\s+", " ", (s or "").replace("’", "'").replace("‘", "'")).strip()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def load(path, default):
    try:
        return json.load(open(path, encoding="utf-8"))
    except FileNotFoundError:
        return default


# ---------------------------------------------------------------- the pack
def load_pack():
    pack = json.load(open(os.path.join(ROOT, "src/seeds/data/packers2019.json"), encoding="utf-8"))
    by_name = {}
    for f in pack["formations"]:
        by_name.setdefault(f["name"].upper(), {})[f["personnel"]] = f["key"]
    return by_name


# ---------------------------------------------------------------- the concept word map
def load_concepts():
    runs = json.load(open(os.path.join(ROOT, "data/systems/eagles-2026/runs.json"), encoding="utf-8"))
    pas = json.load(open(os.path.join(ROOT, "data/systems/eagles-2026/pass.json"), encoding="utf-8"))
    out = []
    for c in runs["concepts"] + pas["concepts"] + pas["protections"]:
        out.append(c)
    return out


def parse_index(section_num):
    """[(title, first page)] from the section's p3 index."""
    files = glob.glob(os.path.join(SOURCE, "rams-2022/text", f"{section_num}*.txt"))
    if not files:
        return []
    text = open(files[0], encoding="utf-8").read()
    m = re.search(r"=== p3 ===\n(.*?)\n=== p4 ===", text, re.S)
    if not m:
        return []
    lines = [l.strip() for l in m.group(1).split("\n") if l.strip()]
    out = []
    i = 0
    while i < len(lines) - 1:
        if lines[i] in ("CONCEPT", "PAGE #"):
            i += 1
            continue
        if re.fullmatch(r"\d+(-\d+)?", lines[i + 1]):
            first = int(lines[i + 1].split("-")[0])
            if first >= 5 or not out:
                out.append((norm(lines[i]), first))
            i += 2
        else:
            i += 1
    return out


# ---------------------------------------------------------------- formation line
def parse_formation(line, section):
    """'[12] WEST L' / 'Z MO SOUTH R CLOSE F SHORT' / '[11/01] DOUBLE RT CLOSE A' -> system words."""
    t = norm(line).upper().replace("’", "'")
    pers = None
    m = re.search(r"\[([0-9]{2}[XZ]?)(?:/([0-9]{2}[XZ]?))?\]", t)
    if m:
        pers = [m.group(1)] + ([m.group(2)] if m.group(2) else [])
        t = t[: m.start()] + " " + t[m.end():]
    t = re.sub(r"\((Z FLOAT/RAT-LAB|CLICK|ZOOM|TOAST|GUN)\)", r" \1 ", t)
    t = t.replace("/", " ").replace("Z-MO", "Z MO").replace("Y-MO", "Y MO").replace("F-MO", "F MO").replace("X-SHORT", "X SHORT").replace("Z-SHORT", "Z SHORT").replace("F-SHORT", "F SHORT").replace("Y-SHORT", "Y SHORT")
    words = t.split()
    side = next((i for i, w in enumerate(words) if w in ("R", "L", "RT", "LT", "RIGHT", "LEFT")), None)
    if side is None:
        return None
    direction = "RT" if words[side] in ("R", "RT", "RIGHT") else "LT"
    before, after = words[:side], words[side + 1:]
    # the base word is the last word(s) before the direction; everything before it is a shift / motion word
    base_words = [before[-1]] if before else []
    if len(before) >= 2 and before[-1] == "PACK":
        base_words = before[-2:]
    pre = before[: len(before) - len(base_words)]
    rams_base = " ".join(base_words)
    # "TRIO STORE RT", "TRIO STAN RT": a variation word rides inside the formation word
    extra = []
    if rams_base in ("STORE", "STAN") and len(pre) >= 1:
        extra = [rams_base]
        rams_base = pre[-1]
        pre = pre[:-1]
    base = BASE.get(rams_base, title_case(rams_base))
    gun = "GUN" in pre or "GUN" in after
    pre = [w for w in pre if w != "GUN"]
    tags = []
    motions = []
    unknown = []
    i = 0
    seq = extra + [w for w in after if w != "GUN"]
    while i < len(seq):
        w = seq[i]
        nxt = seq[i + 1] if i + 1 < len(seq) else None
        if w == "ALERT":
            i += 1
            continue
        if w in LETTERS and nxt:
            key = f"{w} {nxt}"
            mw = MOTION.get(nxt)
            if nxt in ("IN",):
                mw = ("HOME", w)
            if mw:
                motions.append({"player": w, "rams": key, "word": mw[0]})
                i += 2
                continue
        if w in MOTION and MOTION[w][1] is not None:
            motions.append({"player": MOTION[w][1], "rams": w, "word": MOTION[w][0]})
        elif w in MOTION:
            motions.append({"player": None, "rams": w, "word": MOTION[w][0]})
        elif w in VAR:
            tags.append(VAR[w])
        elif w.upper() in ENGINE_ALIGN or w in ("STORE", "STAN", "KING", "EDGE", "ACER", "TUNA", "EXTEND", "TOAST", "SLIMMER", "CLOSER", "TIGHTER", "ACE", "NUMBERS"):
            tags.append(title_case(w))
        else:
            unknown.append(w)
        i += 1
    # shift / motion words before the formation: "Z MO", "Y SHORT", "F MO", "Z FLOAT", "RAT-LAB"
    j = 0
    while j < len(pre):
        w = pre[j]
        nxt = pre[j + 1] if j + 1 < len(pre) else None
        if w in LETTERS and nxt and (nxt in MOTION or nxt in ("MO", "SHORT", "TRADE")):
            mw = MOTION.get(nxt, (nxt, w))
            motions.insert(0, {"player": w, "rams": f"{w} {nxt}", "word": mw[0], "pre": True})
            j += 2
            continue
        if w in ("RAT-LAB", "LAB-RAT"):
            motions.insert(0, {"player": "H", "rams": w, "word": "LAB/RAT", "pre": True})
        elif w in MOTION:
            motions.insert(0, {"player": MOTION[w][1], "rams": w, "word": MOTION[w][0], "pre": True})
        else:
            unknown.append(w)
        j += 1
    sysname = " ".join([base, "Rt" if direction == "RT" else "Lt"] + tags)
    return {"ramsLine": norm(line), "personnel": pers, "base": base, "ramsBase": rams_base, "direction": direction, "tags": tags, "motions": motions, "unknown": unknown, "gun": gun, "name": sysname}


# ---------------------------------------------------------------- call line
def parse_call(line, section):
    t = norm(line).upper()
    t = re.sub(r"\s+", " ", t)
    can = None
    m = re.search(r"[\[(]CAN[\])]\s*(RUN/PASS|PASS/RUN|R/P|RUN|PASS|ZONE ANSWER|[A-Z0-9 ]+)?", t)
    if m:
        can = (m.group(1) or "").strip() or "game plan"
        t = (t[: m.start()] + " " + t[m.end():]).strip()
    t = re.sub(r"\s+", " ", t)
    toss = t.startswith("TOSS ")
    if toss:
        t = t[5:]
    run_no = None
    mm = re.match(r"^(1[2-9]|3[0-9]|5[0-9])\b\s*(.*)$", t)
    protection = None
    rest = t
    if section in RUN_SECTIONS or (section == "run-alerts" and mm) or (section == "two-minute" and mm and not re.search(r"JET|SCAT|SCRAM", t)):
        if mm:
            run_no = int(mm.group(1))
            rest = mm.group(2)
    else:
        for p in PROTECTIONS:
            if t.startswith(p + " ") or t == p:
                protection = p
                rest = t[len(p):].strip()
                break
    words = rest.split()
    # translate the concept words
    out = []
    i = 0
    while i < len(words):
        two = " ".join(words[i: i + 2])
        if two in CALL_WORDS:
            out.append(CALL_WORDS[two])
            i += 2
            continue
        out.append(CALL_WORDS.get(words[i], words[i]))
        i += 1
    system_rest = " ".join(out)
    # position tags "X STRIKE Z BLINK" -> route words per letter
    routes = {}
    ws = system_rest.split()
    for k, w in enumerate(ws):
        if w in LETTERS and k + 1 < len(ws) and ws[k + 1] not in LETTERS:
            routes[w] = ws[k + 1]
    system_call = " ".join(filter(None, ["TOSS" if toss else "", str(run_no) if run_no else "", PROTECTION_SYSTEM.get(protection, protection) if protection else "", system_rest]))
    return {"ramsCall": norm(line), "runNumber": run_no, "toss": toss, "protection": protection, "protectionSystem": PROTECTION_SYSTEM.get(protection, protection) if protection else None,
            "concept": system_rest, "conceptRams": rest, "can": can, "routeWordsFromCall": routes, "name": re.sub(r"\s+", " ", system_call).strip()}


# ---------------------------------------------------------------- players, paths, labels
OL_SPOTS = ["LT", "LG", "C", "RG", "RT"]


def identify_players(cell):
    """Diagram offense -> {spot: (x, y)} with spots LT LG C RG RT Q H X Y Z F (plus U for an unlabeled extra man)."""
    off = cell["offense"]
    spots = {}
    unlabeled = []
    for o in off:
        lab = o["label"]
        if lab == "HB":
            lab = "H"
        if lab == "QB":
            lab = "Q"
        if lab and lab in LETTERS and lab not in spots:
            spots[lab] = (o["x"], o["y"])
        elif lab and lab in LETTERS:
            spots.setdefault("dups", []).append(lab)
        elif o["shape"] == "square":
            spots["C"] = (0.0, 0.0)
        else:
            unlabeled.append(o)
    dups = spots.pop("dups", [])
    # linemen: unlabeled rings on the line, by x
    line = sorted([o for o in unlabeled if abs(o["y"]) < 0.5 and 0.4 < abs(o["x"]) < 2.7], key=lambda o: o["x"])
    left = [o for o in line if o["x"] < 0][-2:]
    right = [o for o in line if o["x"] > 0][:2]
    if len(left) == 2:
        spots["LT"], spots["LG"] = (left[0]["x"], 0.0), (left[1]["x"], 0.0)
    elif len(left) == 1:
        spots["LG" if abs(left[0]["x"]) < 1.5 else "LT"] = (left[0]["x"], 0.0)
    if len(right) == 2:
        spots["RG"], spots["RT"] = (right[0]["x"], 0.0), (right[1]["x"], 0.0)
    elif len(right) == 1:
        spots["RG" if right[0]["x"] < 1.5 else "RT"] = (right[0]["x"], 0.0)
    for s, x in (("LT", -2.0), ("LG", -1.0), ("C", 0.0), ("RG", 1.0), ("RT", 2.0)):
        spots.setdefault(s, (x, 0.0))
    used = set(id(o) for o in left + right)
    rest = [o for o in unlabeled if id(o) not in used]
    # the quarterback: the unlabeled man right behind the center, under center or in the gun (the pass sections
    # print his drop number in the ring instead of a letter); the back: the deepest one in the middle
    if "Q" not in spots:
        q = sorted([o for o in rest if abs(o["x"]) < 0.9 and -3.2 < o["y"] < -0.5], key=lambda o: -o["y"])
        if not q:
            q = sorted([o for o in rest if abs(o["x"]) < 0.9 and -6.5 < o["y"] <= -3.2 and o["shape"] == "ring"], key=lambda o: -o["y"])
        if q:
            spots["Q"] = (q[0]["x"], q[0]["y"])
            rest = [o for o in rest if o is not q[0]]
    if "H" not in spots:
        h = sorted([o for o in rest if o["y"] < -2.5 and abs(o["x"]) < 4], key=lambda o: o["y"])
        if h:
            spots["H"] = (h[0]["x"], h[0]["y"])
            rest = [o for o in rest if o is not h[0]]
    extra = [(round(o["x"], 2), round(o["y"], 2)) for o in rest if o["shape"] != "letter"]
    return spots, dups, extra


def path_role(spot, path, is_run):
    if path.get("role") == "motion":
        return "motion"
    if path["dashed"]:
        return "free"
    if spot in OL_SPOTS:
        return "block"
    if spot in ("Y", "F", "X", "Z", "H", "U") and path["end"] == "tbar":
        return "block"
    if spot == "Q":
        return "free"
    if is_run and spot in ("H", "F") and path["end"] == "arrow":
        return "ball"
    return "route"


def is_defense_ink(p):
    """The book draws the defence's movement (a safety rolling down, the backers' fit line) in green or brown;
    the offence's lines are black, blue (the ball carrier on a sweep) or red (a changed assignment)."""
    r, g, b = p.get("color") or (0, 0, 0)
    return (g > 0.35 and r < 0.2 and b < 0.2) or (r > 0.45 and 0.1 < g < 0.4 and b < 0.15)


def attach_paths(cell, spots):
    """Give every path an owner spot. Returns [{spot, pts (absolute diagram yards), dashed, end, startMark, role, branch}]."""
    owners = {}
    paths = cell["paths"]
    def nearest_spot(pt, limit):
        best = None
        for s, (x, y) in spots.items():
            d = math.hypot(pt[0] - x, pt[1] - y)
            if d < limit and (best is None or d < best[0]):
                best = (d, s)
        return best
    out = []
    pending = []
    bars = []
    def ink(p):
        return tuple(round(c, 1) for c in (p.get("color") or (0, 0, 0)))
    def continues(k):
        """A coloured line (the book's blue jet man, a red changed assignment) that starts where a line of the
        same colour ends continues it, even when it also starts beside a man."""
        p = paths[k]
        if ink(p) == (0.0, 0.0, 0.0) or len(p["pts"]) < 2:
            return False
        for j, q in enumerate(paths):
            if j != k and ink(q) == ink(p) and len(q["pts"]) >= 2 and math.hypot(q["pts"][-1][0] - p["pts"][0][0], q["pts"][-1][1] - p["pts"][0][1]) < 0.5:
                return True
        return False
    def in_note_box(q):
        """The underline of a progression number, or the frame of a boxed note: print, not line work."""
        pts = q["pts"]
        length = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
        for l in cell["labels"]:
            lines = l["text"].split("\n")
            half_w = max(0.6, 0.17 * max(len(t) for t in lines))
            half_h = 0.55 * len(lines) + 0.9
            if l["kind"] == "note":
                half_w, half_h = max(1.5, half_w + 0.6), half_h + 0.6
            elif length > 0.8:
                continue
            if all(abs(q[0] - l["x"]) < half_w and abs(q[1] - l["y"]) < half_h for q in pts):
                return True
        return False
    def is_callout(q):
        """A cloud drawn around a word: a small closed shape."""
        pts = q["pts"]
        if len(pts) < 5 or math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) > 0.35:
            return False
        xs, ys = [q[0] for q in pts], [q[1] for q in pts]
        return max(xs) - min(xs) < 4 and max(ys) - min(ys) < 2.5
    for k, p in enumerate(paths):
        pts = p["pts"]
        if len(pts) < 2:
            continue
        if is_defense_ink(p) or in_note_box(p) or is_callout(p):
            continue
        length = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
        if p.get("bar"):
            bars.append({"spot": None, "pts": pts, "dashed": p["dashed"], "end": "none", "startMark": "none", "role": "bar"})
            continue
        hit = nearest_spot(pts[0], 0.75) or nearest_spot(pts[0], 1.05)
        hit_end = nearest_spot(pts[-1], 0.75)
        if hit_end and (not hit or hit_end[0] < hit[0]) and p["startMark"] in ("arrow", "tbar", "dot"):
            pts = list(reversed(pts))
            p = dict(p, end=p["startMark"], startMark=p["end"])
            hit = hit_end
        if p["anchor"] and p["anchor"].get("shape") == "ghost":
            # a motion: from the ghost to the player at the other end
            far = nearest_spot(pts[-1], 1.2) or nearest_spot(pts[0], 1.2)
            if far:
                out.append({"spot": far[1], "pts": pts, "dashed": True, "end": p["end"], "startMark": p["startMark"], "role": "motion", "ghost": [p["anchor"]["x"], p["anchor"]["y"]]})
                continue
        long_enough = length >= 0.4 or (p["end"] == "tbar" and length >= 0.15)
        if hit and hit[0] < 0.5 and long_enough and not continues(k):
            # a stem chained with the outline of a half-filled symbol: the vertices inside the symbol go
            sx, sy = spots[hit[1]]
            pts = list(pts)
            while len(pts) > 2 and math.hypot(pts[1][0] - sx, pts[1][1] - sy) < 0.6:
                pts.pop(0)
            out.append({"spot": hit[1], "pts": pts, "dashed": p["dashed"], "end": p["end"], "startMark": p["startMark"], "role": None, "k": k, "color": ink(p)})
        elif long_enough:
            pending.append({"pts": pts, "dashed": p["dashed"], "end": p["end"], "startMark": p["startMark"], "k": k, "color": ink(p),
                            "ring": hit or nearest_spot(pts[0], 1.4), "ringEnd": nearest_spot(pts[-1], 1.05)})
    # the rest: a continuation or a branch of an owned line (its start snaps onto that line), else a man's own line
    changed = True
    while changed and pending:
        changed = False
        for q in list(pending):
            best = None
            # a line with no man at either end may sit a little further off the line it continues (a route
            # leaving the far end of a T-bar)
            tol = 0.5 if (q.get("ring") or q.get("ringEnd")) else 0.75
            # the fork may sit anywhere along the line, not only on a vertex (a back's option off his track,
            # several branches from one point): the nearest point of the line is the join. A coloured line
            # joins a line of its own colour first (the red changed assignment, the blue jet man), and a vertex
            # beats a point along a line, so a route crossing the back's track does not hang off the track.
            for o in out:
                same_ink = o.get("color") == q.get("color")
                if q.get("color") != (0.0, 0.0, 0.0) and not same_ink and any(x.get("color") == q.get("color") for x in out):
                    continue
                for where, e in (("start", q["pts"][0]), ("end", q["pts"][-1])):
                    for vi, v in enumerate(o["pts"]):
                        d = math.hypot(v[0] - e[0], v[1] - e[1])
                        if d < tol and (best is None or d < best[0]):
                            best = (d, o, where, vi, None)
                    for si in range(len(o["pts"]) - 1):
                        a, b = o["pts"][si], o["pts"][si + 1]
                        dx, dy = b[0] - a[0], b[1] - a[1]
                        n2 = dx * dx + dy * dy or 1e-9
                        t = max(0.0, min(1.0, ((e[0] - a[0]) * dx + (e[1] - a[1]) * dy) / n2))
                        if t <= 0.02 or t >= 0.98:
                            continue
                        foot = [a[0] + t * dx, a[1] + t * dy]
                        d = math.hypot(foot[0] - e[0], foot[1] - e[1]) + 0.25
                        if d < tol and (best is None or d < best[0]):
                            best = (d, o, where, si + 1, foot)
            if best:
                d, o, where, vi, foot = best
                if foot is not None:
                    # the fork becomes a vertex of the line it leaves, so the two draw as one piece of line work
                    o["pts"].insert(vi, [round(foot[0], 2), round(foot[1], 2)])
                # a line whose far end sits on a man is that man's own line (it leads to the join, not from it):
                # nothing else ever runs into a player's symbol
                far = q.get("ringEnd") if where == "start" else q.get("ring")
                if far and far[1] != o["spot"]:
                    pts = list(reversed(q["pts"])) if where == "start" else list(q["pts"])
                    end = q["startMark"] if where == "start" else q["end"]
                    start_mark = q["end"] if where == "start" else q["startMark"]
                    out.append({"spot": far[1], "pts": pts, "dashed": q["dashed"], "end": end, "startMark": start_mark, "role": None, "k": q["k"], "color": q.get("color")})
                    pending.remove(q)
                    changed = True
                    continue
                pts = list(q["pts"]) if where == "start" else list(reversed(q["pts"]))
                pts[0] = list(o["pts"][vi])
                end = q["end"] if where == "start" else q["startMark"]
                start_mark = q["startMark"] if where == "start" else q["end"]
                out.append({"spot": o["spot"], "pts": pts, "dashed": q["dashed"], "end": end, "startMark": start_mark, "role": None, "branch": True, "color": q.get("color")})
                pending.remove(q)
                changed = True
        if not changed:
            # nothing joins a line: the nearest ring (a little further off) owns the next one
            ringed = [q for q in pending if q.get("ring")]
            if ringed:
                q = min(ringed, key=lambda q: q["ring"][0])
                out.append({"spot": q["ring"][1], "pts": q["pts"], "dashed": q["dashed"], "end": q["end"], "startMark": q["startMark"], "role": None, "k": q["k"], "color": q.get("color")})
                pending.remove(q)
                changed = True
    free = [{"spot": None, "pts": q["pts"], "dashed": q["dashed"], "end": q["end"], "startMark": q["startMark"], "role": "free"} for q in pending if not in_note_box(q)] + bars
    return out, free


def attach_labels(cell, spots, owned):
    """Every label goes to the nearest player or to the owner of the nearest route point."""
    out = []
    for l in cell["labels"]:
        if re.fullmatch(r"\d\+?", l["text"].strip()) and any(math.hypot(l["x"] - x, l["y"] - y) < 0.4 for x, y in spots.values()):
            continue
        best = None
        # a word printed under a man is his, not the neighbour's beside him: sideways distance counts more
        for s, (x, y) in spots.items():
            d = math.hypot(1.6 * (l["x"] - x), l["y"] - y)
            if best is None or d < best[0]:
                best = (d, s)
        for o in owned:
            for v in o["pts"]:
                d = math.hypot(1.3 * (l["x"] - v[0]), l["y"] - v[1]) * 1.15
                if best is None or d < best[0]:
                    best = (d, o["spot"])
        spot = best[1] if best and best[0] < 3.0 else None
        out.append({"kind": l["kind"], "text": l["text"], "x": l["x"], "y": l["y"], "spot": spot})
    return out


# ---------------------------------------------------------------- main
def main():
    cells_dir, out_path = sys.argv[1], sys.argv[2]
    pack = load_pack()
    concepts = load_concepts()
    installs = load(os.path.join(ROOT, "data/rams-2022/installs.json"), {"concepts": []})
    install_by = {(c["section"], norm(c["indexTitle"]).upper()): c for c in installs.get("concepts", [])}
    notes_by = {}
    for f in glob.glob(os.path.join(ROOT, "data/rams-2022/notes/*.json")):
        d = json.load(open(f, encoding="utf-8"))
        for c in d.get("concepts", []):
            notes_by[(d["section"], norm(c.get("indexTitle") or c.get("key", "")).upper())] = c
    blocking = {t["term"].upper(): t for t in load(os.path.join(ROOT, "data/rams-2022/blocking-glossary.json"), {"terms": []}).get("terms", [])}
    routes_gl = {r["name"].upper(): r for r in load(os.path.join(ROOT, "data/rams-2022/routes-glossary.json"), {"routes": []}).get("routes", [])}
    fronts = load(os.path.join(ROOT, "data/rams-2022/fronts.json"), {"fronts": []})["fronts"]
    front_names = {norm(f["name"]).upper(): f for f in fronts}
    # concept lookup by Rams alias and by system term words
    alias_to_term = {}
    for c in concepts:
        for a in c.get("aliases", []):
            if a.get("book") == "rams-2022":
                alias_to_term[norm(a["term"]).upper()] = c
    term_words = {re.sub(r"[^A-Z0-9 /]", "", norm(c["term"]).upper()): c for c in concepts}

    def find_concept(system_call, index_title, section):
        """The system concept entry for a call, by its words (protections only on the protection pages)."""
        skip = {"TOSS", "CAN", "RUN", "PASS", "R/P", "ZONE", "ANSWER"}
        call_words = set(re.findall(r"[A-Z][A-Z.0-9]+|\d+", re.sub(r"\bPASS (\d\d)\b", r"P\1", system_call.upper()))) - skip
        title_words = set(re.findall(r"[A-Z][A-Z.0-9]+|\d+", re.sub(r"\bPASS (\d\d)\b", r"P\1", (index_title or "").upper()))) - skip
        words = call_words | title_words
        best = None
        pool = [c for c in concepts if (section == "pass-pro") == str(c.get("id", "")).startswith("pro.")]
        for c in pool:
            term = norm(c["term"]).upper()
            tw = [w for w in re.findall(r"[A-Z][A-Z.]+", term) if w not in ("CAN",)]
            significant = [w for w in tw if not re.fullmatch(r"P?\d+(-\d+)?", w)]
            if not tw or not any(w in words for w in (significant or tw)):
                continue
            # the call's own words count double: the index title lists the Rams word next to the system one
            score = sum(2 if w in call_words else 1 for w in set(tw) if w in words)
            # prefer the concept whose sources mention this Rams section, then the one with more words matched
            sec_hit = any(s.get("book") == "rams-2022" and (s.get("section") or "").lower().replace(" ", "-").find(section.split("-")[0]) >= 0 for s in c.get("sources", []))
            key = (score, sec_hit, -len(term))
            if best is None or key > best[0]:
                best = (key, c)
        return best[1] if best else None

    plays = []
    report = {"cells": 0, "plays": 0, "noFormation": [], "noCall": [], "unknownWords": {}, "packMiss": [], "dups": []}
    for num, section in SECTION_FILE.items():
        path = os.path.join(cells_dir, f"{section}.json")
        if not os.path.exists(path):
            continue
        data = json.load(open(path, encoding="utf-8"))
        index = parse_index(num)
        is_run = section in RUN_SECTIONS
        for page in data["pages"]:
            # the concept this page belongs to
            concept_title, concept_page = None, None
            for title, first in index:
                if first <= page["page"]:
                    concept_title, concept_page = title, first
            for cell in page["cells"]:
                report["cells"] += 1
                fline, cline = norm(cell["formationLine"]), norm(cell["callLine"])
                # two-minute pages print the name where the formation goes: "911 - 911 | DOUBLE RT OFF 3 JET AGGIE"
                if section == "two-minute" and cline and not re.search(r"\b(RT|LT|R|L)\b", fline.upper()) and re.search(r"\b(RT|LT)\b", cline.upper()):
                    m = re.match(r"^(.*?\b(?:RT|LT)\b(?:\s+(?:OFF|CLOSE|CLAMP|TITE|ACE|SLOT|KING|EDGE))*)\s+(.*)$", cline.upper())
                    if m:
                        fline, cline = m.group(1), m.group(2)
                if section == "pass-pro":
                    form = None
                    # the protection name is the formation line on these pages; when the extractor paired a front name
                    # with it the protection is on the call line instead
                    prot = next((p for p in PROTECTIONS if fline.upper().startswith(p)), None)
                    if not prot:
                        prot = next((p for p in PROTECTIONS if cline.upper().startswith(p)), None)
                        if prot and not cell["front"]:
                            cell["front"] = fline
                    if not prot:
                        # a cell whose header is only the front name: the protection is the page's
                        title_words = norm(page["title"]).upper()
                        prot = next((p for p in ("JET", "SCAT", "SCRAM", "58-59", "WEEZY", "FOAM", "MAYS", "PADDY", "DIME", "PUNCH", "LAKER", "RANDALL", "REPTILE", "ROLL", "RUFFLES", "HOUSE", "ROOF", "KLAY", "SLAMMER", "GIANNIS") if p in title_words), None)
                        prot = {"JET": "2 JET / 3 JET", "SCAT": "2 SCAT / 3 SCAT", "SCRAM": "2 SCRAM / 3 SCRAM", "58-59": "Y6 / Y7"}.get(prot, prot) or fline.upper()
                        if not cell["front"] and not re.search(r"JET|SCAT|SCRAM|PASS|WILLIE|DIME|DUO|PUNCH", fline.upper()):
                            cell["front"] = fline
                    call = {"ramsCall": norm(fline + " " + cline), "runNumber": None, "toss": False, "protection": prot, "protectionSystem": PROTECTION_SYSTEM.get(prot, prot), "concept": prot, "conceptRams": prot, "can": None, "routeWordsFromCall": {}, "name": PROTECTION_SYSTEM.get(prot, prot)}
                else:
                    form = parse_formation(fline, section)
                    call = parse_call(cline, section) if cline else None
                if form is None and section != "pass-pro":
                    report["noFormation"].append(f"{section} p{page['page']} c{cell['cell']}: {fline} / {cline}")
                if call is None:
                    report["noCall"].append(f"{section} p{page['page']} c{cell['cell']}: {fline}")
                    call = {"ramsCall": "", "runNumber": None, "toss": False, "protection": None, "protectionSystem": None, "concept": "", "conceptRams": "", "can": None, "routeWordsFromCall": {}, "name": ""}
                spots, dups, extra = identify_players(cell)
                if dups:
                    report["dups"].append(f"{section} p{page['page']} c{cell['cell']}: {dups}")
                owned, free = attach_paths(cell, spots)
                for o in owned:
                    if o.get("role") != "motion":
                        o["role"] = path_role(o["spot"], o, is_run)
                # one ball carrier: on a jet or fly the motion man's line carries it, else the back's; the other
                # arrow is the fake
                balls = [o for o in owned if o.get("role") == "ball"]
                if len(balls) > 1:
                    jet = bool(re.search(r"\b(FLY|JET|FLIGHT|SLALOM)\b", (cline or "").upper()))
                    keep = next((o for o in balls if (o["spot"] != "H") == jet), balls[0])
                    for o in balls:
                        if o is not keep:
                            o["role"] = "route"
                labels = attach_labels(cell, spots, owned)
                # formation in the pack?
                pack_key, pack_personnel = None, None
                personnel = (form or {}).get("personnel") or ([] if form is None else [])
                if form:
                    for w in form["unknown"]:
                        report["unknownWords"][w] = report["unknownWords"].get(w, 0) + 1
                    cand = pack.get(form["name"].upper()) or pack.get(form["name"].upper().replace(" LT ", " RT ").replace(" LT", " RT"))
                    # the cell's personnel first, then the same number of backs (one-back words for 11 / 12 / 13, two-back for 21 / 20 / 23)
                    backs = (personnel or ["11"])[0][0]
                    order = lambda keys: (personnel or []) + sorted(keys, key=lambda k: (k[0] != backs, k))
                    if cand:
                        for p in order(list(cand.keys())):
                            if p in cand:
                                pack_key, pack_personnel = cand[p], p
                                break
                    base_cand = pack.get((form["base"] + " Rt").upper())
                    base_key = None
                    if base_cand:
                        for p in order(list(base_cand.keys())):
                            if p in base_cand:
                                base_key, base_pers = base_cand[p], p
                                break
                    if not pack_key and not base_key:
                        report["packMiss"].append(f"{section} p{page['page']}: {form['name']} ({fline})")
                else:
                    base_key = None
                # the concept
                inst = install_by.get((section, (concept_title or "").upper()), {})
                note = notes_by.get((section, (concept_title or "").upper()), {})
                sysc = find_concept(call["name"], concept_title, section) if call["name"] else None
                if not sysc and concept_title:
                    sysc = alias_to_term.get(norm(concept_title).upper())
                category = "Run" if is_run or (section == "run-alerts" and call["runNumber"]) else "Screen" if section == "screens" else "PA" if section in ("play-pass", "play-pass-cans", "movement") else "Pass"
                if section == "two-minute" and call["runNumber"] and call["runNumber"] < 20:
                    category = "Run"
                front = norm(cell["front"]).upper()
                front_entry = front_names.get(front) or front_names.get(front.replace("OV ", "OVER ").replace("UN ", "UNDER "))
                # per-player words: block calls from the red labels, routes from the route labels
                block_calls, route_words, depth_words = {}, {}, {}
                for l in labels:
                    if not l["spot"]:
                        continue
                    word = " ".join(l["text"].split())
                    if l["kind"] == "block":
                        block_calls.setdefault(l["spot"], []).append(word)
                    elif l["kind"] == "route":
                        route_words.setdefault(l["spot"], []).append(word)
                    elif l["kind"] == "depth":
                        depth_words.setdefault(l["spot"], []).append(word)
                for letter, w in call["routeWordsFromCall"].items():
                    route_words.setdefault(letter, [])
                    if w not in route_words[letter]:
                        route_words[letter].insert(0, w)
                # position notes: the drawing's words, the glossary's meaning, the page's rules
                position_notes = {}
                for spot in set(list(block_calls) + list(route_words) + list((note.get("positions") or {}).keys())):
                    bits = []
                    for w in block_calls.get(spot, []):
                        g = blocking.get(w.upper().strip("'"))
                        bits.append(f"{w}: {g['means']}" if g else w)
                    for w in route_words.get(spot, []):
                        g = routes_gl.get(w.upper())
                        depth = ", ".join(depth_words.get(spot, []))
                        bits.append(f"{w}{' (' + depth + ')' if depth else ''}: {g['shape']}" if g else (f"{w} ({depth})" if depth else w))
                    rule_key = "OL" if spot in OL_SPOTS else "QB" if spot == "Q" else spot
                    rule = (note.get("positions") or {}).get(rule_key)
                    if rule:
                        bits.append(rule)
                    if bits:
                        position_notes[spot] = " ".join(bits)
                for spot in OL_SPOTS:
                    ol_rule = (note.get("positions") or {}).get("OL")
                    if ol_rule and spot not in position_notes:
                        position_notes[spot] = ol_rule
                motion_words = [m["rams"] for m in (form or {}).get("motions", [])]
                tags = sorted(set(filter(None, [
                    "rams-2022", section, FAMILY.get(section), f"install-{inst.get('install')}" if inst.get("install") else None, inst.get("situation") or SITUATION.get(section),
                    inst.get("group"), category.lower(), *(personnel or []), (form or {}).get("base"), (form or {}).get("ramsBase"), *((form or {}).get("tags", [])), *motion_words,
                    call["protection"], call["protectionSystem"], "toss" if call["toss"] else None, "can" if call["can"] else None, "gun" if (form or {}).get("gun") or (call["runNumber"] or 0) >= 30 else None,
                    front or None, front_entry["name"] if front_entry else None, (sysc["term"] if sysc else None), *(re.findall(r"[A-Za-z][A-Za-z.]+", sysc["term"]) if sysc else []), call["conceptRams"] or None, call["concept"] or None,
                    *[w for ws in block_calls.values() for w in ws], *[w for ws in route_words.values() for w in ws], *(note.get("tags") or []),
                ])))
                name = (call["name"] or (form["name"].upper() if form else fline)).upper()
                sys_name = name  # the word map in parse_call already put the system words in
                spec = {
                    "key": f"{section}-p{page['page']}-c{cell['cell']}",
                    "section": section, "family": FAMILY.get(section), "page": page["page"], "cell": cell["cell"], "cellNumber": cell.get("cellNumber"),
                    "pageTitle": norm(page["title"]), "conceptTitle": concept_title, "conceptPage": concept_page,
                    "install": inst.get("install"), "group": inst.get("group"), "situation": inst.get("situation") or SITUATION.get(section), "installBasis": inst.get("basis"),
                    "systemConcept": sysc["term"] if sysc else None, "systemConceptId": sysc.get("id") if sysc else None, "conceptMeans": (sysc or {}).get("means"), "conceptOnFilm": (sysc or {}).get("onFilm"),
                    "name": sys_name, "alias": call["ramsCall"] if re.sub(r"[()\s]", "", call["ramsCall"]).upper() != re.sub(r"[()\s]", "", sys_name).upper() else None, "rawCall": norm(fline + " / " + cline), "category": category,
                    "formation": form, "packKey": pack_key, "packPersonnel": pack_personnel, "baseKey": base_key, "personnel": (personnel or [None])[0],
                    "runNumber": call["runNumber"], "runFamily": RUN_FAMILY.get(section) if category == "Run" else None, "toss": call["toss"], "protection": call["protectionSystem"], "protectionRams": call["protection"],
                    "concept": call["concept"], "can": call["can"], "front": norm(cell["front"]), "frontNote": norm(cell["frontNote"]), "frontKey": front_entry["name"] if front_entry else None,
                    "unit": cell["unit"], "unitY": cell["unitY"],
                    "offense": {s: [round(x, 2), round(y, 2)] for s, (x, y) in spots.items()}, "extraMen": extra, "ghosts": cell["ghosts"], "marks": cell["marks"],
                    "defenders": cell["defenders"], "paths": owned, "freePaths": free, "labels": labels,
                    "routeWords": route_words, "blockCalls": block_calls, "positionNotes": position_notes,
                    "notes": {k: note.get(k) for k in ("summary", "qb", "hb", "criteria", "progression", "alerts", "can") if note.get(k)},
                    "warnings": [w for w in [
                        f"Two drawings may share this cell: the letters {', '.join(sorted(set(dups)))} are printed twice." if dups else None,
                        "The book prints this diagram without its own header; it takes the call printed above it." if cell.get("inheritedHeader") else None,
                        f"Formation words the system does not know: {', '.join(form['unknown'])}." if form and form["unknown"] else None,
                    ] if w],
                    "tags": tags,
                }
                plays.append(spec)
                report["plays"] += 1
    body = json.dumps({"plays": plays}, sort_keys=True)
    rev = hashlib.sha1(body.encode()).hexdigest()[:12]
    json.dump({"revision": rev, "source": "Rams 2022 (McVay), rebuilt in the Eagles 2026 system", "_generated": "Written by scripts/rams/build_plays.py. Positions, names, page numbers and paraphrased notes only.", "plays": plays},
              open(out_path, "w", encoding="utf-8", newline="\n"), indent=0, separators=(",", ":"))
    json.dump(report, open(os.path.join(ROOT, "data/rams-2022/build-report.json"), "w", encoding="utf-8"), indent=1)
    print(f"{report['plays']} plays from {report['cells']} cells; no formation {len(report['noFormation'])}, no call {len(report['noCall'])}, pack misses {len(report['packMiss'])}, dup letters {len(report['dups'])}")
    print("unknown formation words:", dict(sorted(report["unknownWords"].items(), key=lambda kv: -kv[1])))
    for s in report["packMiss"][:40]:
        print("  pack miss:", s)
    for s in report["noFormation"][:20]:
        print("  no formation:", s)


if __name__ == "__main__":
    main()
