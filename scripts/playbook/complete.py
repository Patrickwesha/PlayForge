"""Complete a traced diagram so nothing the page shows is missing, and nothing the scan cut off stays cut.

Used by build_book.py. The traced vector is what the tracer could see; the checked transcription says what
the page prints (ring letters, defenders); the composition (scripts/compose-book.render.tsx) says where the
formation pack puts each man for that formation line. Every player added here is an educated guess and is
listed in `guesses`, so the reader and the library can flag it for a spot check.

Rules, in order:
  1. stray rings: more offence than the page lists (and no ghost outline) -> drop unlabeled, unattached rings
     away from the line until the count fits
  2. missing lettered players: the composition's spot (scaled to the drawing's width), else the mirror of the
     opposite receiver, else a default spot by letter, on the cut side when one side is cut
  3. missing linemen next to a found centre, and a missing quarterback the page lists
  4. missing defenders: the mirror of the same letter on the other side, else a default spot by letter
  5. the view window grows to show every player
"""
import math
import re
from collections import Counter

QB_LABELS = {"Q", "QB", "5", "7", "3", "S", "10", "1", "9"}
OL_LABELS = {"OL", "DB", "C", "LT", "LG", "RG", "RT", "T", "G"}  # letters some pages print inside linemen rings: not skill players
FORMATION_PAGES = {"run-play", "pass-play", "play-action", "screen", "formation", "protection", "defense", "situational", "concept"}

# default spots by letter: (x on the strong side, y); x is mirrored for the weak side
OFF_DEFAULT = {
    "X": (-14.0, 0.0), "Z": (14.0, 0.0), "Y": (3.0, 0.0), "F": (6.5, -1.0), "H": (0.0, -7.0), "HB": (0.0, -7.0),
    "FB": (0.0, -4.5), "U": (-3.0, 0.0), "E": (3.0, 0.0), "N": (3.0, 0.0),
}
DEF_DEFAULT = {
    "E": (4.3, 1.3), "T": (1.8, 1.3), "N": (0.6, 1.3), "DT": (1.8, 1.3), "DE": (4.3, 1.3), "NT": (0.0, 1.3),
    "M": (0.0, 4.3), "S": (4.0, 4.3), "W": (-4.0, 4.3), "P": (2.5, 4.3), "B": (-2.5, 4.3), "J": (-2.5, 4.3), "R": (5.5, 4.3),
    "SAM": (4.0, 4.3), "MIKE": (0.0, 4.3), "WILL": (-4.0, 4.3),
    "C": (14.0, 6.5), "CB": (14.0, 6.5), "FS": (0.0, 12.0), "SS": (6.0, 10.0), "$": (8.0, 4.5), "NW": (8.0, 4.5), "NB": (8.0, 4.5),
    "NS": (8.0, 4.5), "WS": (-8.0, 4.5), "SC": (-14.0, 6.5), "E$": (6.0, 1.3), "LB": (0.0, 4.3), "D": (8.0, 4.5), "F": (0.0, 12.0),
}
MIRROR = {"X": "Z", "Z": "X", "S": "W", "W": "S", "P": "B", "B": "P"}


def norm_def(s):
    s = re.sub(r"[^A-Za-z$]", "", s or "")
    return "NW" if s.upper() == "NW" else s.upper()


def norm_ring(s):
    s = re.sub(r"[^A-Za-z0-9]", "", s or "").upper()
    return {"HB": "H"}.get(s, s)


class Completion:
    def __init__(self, diagram, tcell, page_type, comp, cut_left, cut_right, gun=False):
        self.d = diagram or {"players": {}, "paths": {}, "annotations": {}}
        self.t = tcell or {}
        self.page_type = page_type
        self.comp = comp
        self.cut_left, self.cut_right = cut_left, cut_right
        self.gun = gun
        self.guesses = []
        self.next_id = 1

    # ---------------------------------------------------------------- helpers
    def players(self, side=None):
        return [p for p in self.d["players"].values() if side is None or p["side"] == side]

    def new_id(self, prefix):
        while f"{prefix}{self.next_id}" in self.d["players"]:
            self.next_id += 1
        pid = f"{prefix}{self.next_id}"
        self.next_id += 1
        return pid

    def add(self, side, label, x, y, symbol="circle", why="", color=None):
        pid = self.new_id("g")
        p = {"id": pid, "side": side, "symbol": symbol, "label": label, "x": round(x, 2), "y": round(y, 2)}
        if color:
            p["labelColor"] = color
        self.d["players"][pid] = p
        self.guesses.append(f"{label or ('C' if symbol == 'square' else 'lineman')}: {why}")
        return p

    def attached(self, pid):
        return any(q["anchor"].get("playerId") == pid for q in self.d["paths"].values())

    def centre(self):
        sq = [p for p in self.players("offense") if p["symbol"] == "square"]
        return sq[0] if sq else None

    def line_row(self):
        c = self.centre()
        if c:
            return c["y"]
        ys = sorted(p["y"] for p in self.players("offense") if not p["label"])
        return ys[len(ys) // 2] if ys else 0.0

    def is_ol(self, p):
        return p["side"] == "offense" and (p["symbol"] == "square" or (not p["label"] and abs(p["y"] - self.line_row()) < 0.7 and abs(p["x"]) < 3.2))

    def is_qb_spot(self, p):
        """The unlabeled ring nearest behind the centre is the quarterback; rings deeper behind him are backs."""
        row = self.line_row()
        behind = [q for q in self.players("offense") if not q["label"] and q["symbol"] == "circle" and abs(q["x"]) < 1.0 and -7.5 < q["y"] - row < -0.4]
        if not behind:
            return False
        return p["id"] == max(behind, key=lambda q: q["y"])["id"]

    def unexplained(self):
        """Rings the tracer found but could not read: not a lineman, not the quarterback's spot, no ghost outline."""
        return [p for p in self.players("offense") if not p["label"] and p["symbol"] == "circle" and p.get("outline") != "dashed"
                and not self.is_ol(p) and not self.is_qb_spot(p)]

    def strong_side(self):
        """+1 when the tight end / most receivers are to the right."""
        y = [p for p in self.players("offense") if norm_ring(p["label"]) == "Y"]
        if y:
            return 1 if y[0]["x"] >= 0 else -1
        off = [p for p in self.players("offense") if p["label"] and norm_ring(p["label"]) not in QB_LABELS]
        if off:
            return 1 if sum(p["x"] for p in off) >= 0 else -1
        return 1

    def guess_side(self):
        if self.cut_left and not self.cut_right:
            return -1
        if self.cut_right and not self.cut_left:
            return 1
        left = sum(1 for p in self.players("offense") if p["x"] < -3)
        right = sum(1 for p in self.players("offense") if p["x"] > 3)
        return -1 if left < right else 1

    def width_scale(self):
        """How the drawing compresses the pack's widths: median |found x| / |composed x| over the receivers both have."""
        if not self.comp:
            return 1.0
        ratios = []
        for cp in self.comp["players"]:
            if abs(cp["x"]) < 4 or not cp["label"]:
                continue
            m = [p for p in self.players("offense") if norm_ring(p["label"]) == norm_ring(cp["label"]) and abs(p["x"]) > 1]
            if m:
                ratios.append(abs(m[0]["x"]) / abs(cp["x"]))
        if not ratios:
            return 1.0
        ratios.sort()
        return max(0.4, min(1.2, ratios[len(ratios) // 2]))

    # ---------------------------------------------------------------- steps
    def prune_strays(self, expected_total):
        off = self.players("offense")
        ghosts = [p for p in off if p.get("outline") == "dashed"]
        extra = len(off) - len(ghosts) - expected_total
        if extra <= 0:
            return
        cands = [p for p in off if not p["label"] and p["symbol"] == "circle" and p.get("outline") != "dashed"
                 and not self.is_ol(p) and not self.is_qb_spot(p) and not self.attached(p["id"])]
        if not cands:
            return
        cx = sum(p["x"] for p in off) / len(off)
        cy = sum(p["y"] for p in off) / len(off)
        cands.sort(key=lambda p: -math.hypot(p["x"] - cx, p["y"] - cy))
        for p in cands[:extra]:
            del self.d["players"][p["id"]]
            self.guesses.append(f"stray ring at ({p['x']}, {p['y']}) removed: the page lists no player there")

    def complete_offense(self):
        rings = [norm_ring(r) for r in self.t.get("rings") or []]
        rings = [r for r in rings if r and r not in OL_LABELS]
        want = Counter(rings)
        have = Counter(norm_ring(p["label"]) for p in self.players("offense") if p["label"])
        missing = want - have
        scale = self.width_scale()
        side = self.guess_side()
        row = self.line_row()
        for letter in sorted(missing.elements()):
            if letter in QB_LABELS:
                qb = [p for p in self.players("offense") if abs(p["x"]) < 0.9 and -6 < p["y"] - row < -0.4 and not p["label"]]
                if qb:
                    qb[0]["label"] = letter  # the unlabeled ring behind the centre is the quarterback
                    self.guesses.append(f"{letter}: letter given to the ring behind the centre")
                else:
                    self.add("offense", letter, 0, row - (5.0 if self.gun else 1.3), why="placed behind the centre (not visible in the drawing)")
                continue
            spot = None
            if self.comp:
                cp = next((c for c in self.comp["players"] if norm_ring(c["label"]) == letter), None)
                if cp:
                    x = cp["x"] * (scale if abs(cp["x"]) > 4 else 1.0)
                    # a cut side tells which way he went when the composition and the drawing disagree
                    if (self.cut_left and not self.cut_right and x > 0) or (self.cut_right and not self.cut_left and x < 0):
                        x = -x
                    spot = (x, cp["y"] + row, "placed from the formation pack (cut off / not visible in the drawing)")
            if spot is None and letter in MIRROR:
                twin = [p for p in self.players("offense") if norm_ring(p["label"]) == MIRROR[letter]]
                if twin:
                    spot = (-twin[0]["x"], twin[0]["y"], f"mirrored from the {MIRROR[letter]} (cut off / not visible in the drawing)")
            if spot is None:
                dx, dy = OFF_DEFAULT.get(letter, (8.0, -1.0))
                sgn = side if letter in ("X", "Z", "U") else self.strong_side()
                if letter == "X":
                    sgn = -self.strong_side() if not (self.cut_left or self.cut_right) else side
                spot = (abs(dx) * sgn if letter in ("X", "Z") else dx * sgn, dy + row, "default spot for the letter (cut off / not visible in the drawing)")
            x, y, why = spot
            # a ring the tracer found but could not read, near where he belongs, IS him
            near = sorted(self.unexplained(), key=lambda p: math.hypot(p["x"] - x, p["y"] - y))
            if near and math.hypot(near[0]["x"] - x, near[0]["y"] - y) < 5.0:
                near[0]["label"] = letter
                self.guesses.append(f"{letter}: letter given to an unread ring near his spot")
                continue
            # keep clear of a player already on that spot
            while any(math.hypot(p["x"] - x, p["y"] - y) < 0.9 for p in self.players("offense")):
                x += 1.0 * (1 if x >= 0 else -1)
            self.add("offense", letter, x, y, why=why)

    def complete_line(self):
        c = self.centre()
        if not c:
            return
        row = c["y"]
        ol = [p for p in self.players("offense") if self.is_ol(p) and p["symbol"] != "square"]
        if len(ol) >= 4:
            return
        for k in (-1, 1, -2, 2):
            x = c["x"] + k * 1.0
            if any(abs(p["x"] - x) < 0.6 and abs(p["y"] - row) < 0.7 for p in self.players("offense")):
                continue
            if (k < 0 and self.cut_right and not self.cut_left and len(ol) >= 2) or (k > 0 and self.cut_left and not self.cut_right and len(ol) >= 2):
                pass
            self.add("offense", "", x, row, why="lineman slot next to the centre was empty")
            ol.append(None)
            if len(ol) >= 4:
                break

    def complete_defense(self):
        want = Counter(norm_def(x) for x in (self.t.get("defenders") or []) if norm_def(x))
        have = Counter(norm_def(p["label"]) for p in self.players("defense"))
        missing = want - have
        if not missing:
            return
        row = self.line_row()
        strong = self.strong_side()
        side = self.guess_side()
        colour = Counter(p.get("labelColor", "black") for p in self.players("defense")).most_common(1)
        for letter in sorted(missing.elements()):
            spot = None
            twin = [p for p in self.players("defense") if norm_def(p["label"]) == letter]
            if twin and letter in ("C", "E", "T", "CB", "DE", "DT"):
                # the second of a pair goes on the other side
                t = twin[0] if len(twin) == 1 else None
                if t:
                    spot = (-t["x"], t["y"], f"mirrored from the other {letter}")
            if spot is None and letter in MIRROR:
                m = [p for p in self.players("defense") if norm_def(p["label"]) == MIRROR[letter]]
                if m:
                    spot = (-m[0]["x"], m[0]["y"], f"mirrored from the {MIRROR[letter]}")
            if spot is None:
                dx, dy = DEF_DEFAULT.get(letter, (6.0, 4.5))
                if letter in ("C", "CB", "SC"):
                    # over the outside receiver on the side that has no corner yet
                    cs = [p for p in self.players("defense") if norm_def(p["label"]) in ("C", "CB", "SC")]
                    sgn = side if not cs else (-1 if all(p["x"] > 0 for p in cs) else 1)
                    wr = [p for p in self.players("offense") if p["label"] and norm_ring(p["label"]) in ("X", "Z") and (p["x"] > 0) == (sgn > 0)]
                    x = wr[0]["x"] if wr else abs(dx) * sgn
                    spot = (x, row + dy, "placed over the outside receiver (cut off / not visible in the drawing)")
                else:
                    sgn = strong if letter in ("S", "SS", "P", "SAM", "R", "$", "NW", "NB", "NS", "D", "E$") else (-strong if letter in ("W", "B", "J", "WS", "WILL") else side)
                    spot = (dx * sgn if dx else 0.0, row + dy, "default spot for the letter (cut off / not visible in the drawing)")
            x, y, why = spot
            while any(math.hypot(p["x"] - x, p["y"] - y) < 1.2 for p in self.players("defense")):
                x += 1.5 * (1 if x >= 0 else -1)
            self.add("defense", letter if letter != "NW" else "Nw", x, y, symbol="letter", why=why, color=colour[0][0] if colour else None)

    def run(self):
        rings = [norm_ring(r) for r in self.t.get("rings") or []]
        skill = [r for r in rings if r and r not in OL_LABELS and r not in QB_LABELS]
        qb = [r for r in rings if r in QB_LABELS]
        expected = len(skill) + max(len(qb), 1) + 5  # the quarterback's ring is drawn even when it carries no letter
        if self.page_type not in FORMATION_PAGES:
            return self.d, self.guesses
        self.complete_offense()
        self.prune_strays(expected)
        self.complete_line()
        self.complete_defense()
        return self.d, self.guesses


def view_for(diagram, base_view=None, pad=1.8):
    """A window that shows every player and every line point: the frame's window grown to the content."""
    xs, ys = [], []
    for p in diagram["players"].values():
        xs.append(p["x"])
        ys.append(p["y"])
        if p.get("motion"):
            xs.append(p["motion"]["from"]["x"])
            ys.append(p["motion"]["from"]["y"])
    for q in diagram["paths"].values():
        ax = ay = 0.0
        if q["anchor"]["kind"] == "player":
            a = diagram["players"].get(q["anchor"]["playerId"])
            if not a:
                continue
            ax, ay = a["x"], a["y"]
        for pt in q["points"]:
            xs.append(ax + pt["x"])
            ys.append(ay + pt["y"])
    for a in diagram["annotations"].values():
        xs.append(a["x"])
        ys.append(a["y"])
    if not xs:
        return base_view or {"minX": -12, "maxX": 12, "minY": -8, "maxY": 8}
    v = {"minX": min(xs) - pad, "maxX": max(xs) + pad, "minY": min(ys) - pad, "maxY": max(ys) + pad}
    if base_view:
        v = {"minX": min(v["minX"], base_view["minX"]), "maxX": max(v["maxX"], base_view["maxX"]),
             "minY": min(v["minY"], base_view["minY"]), "maxY": max(v["maxY"], base_view["maxY"])}
    # not narrower than a formation needs, and not an extreme aspect
    w, h = v["maxX"] - v["minX"], v["maxY"] - v["minY"]
    if w < 16:
        cx = (v["minX"] + v["maxX"]) / 2
        v["minX"], v["maxX"] = cx - 8, cx + 8
        w = 16
    if h < w * 0.45:
        cy = (v["minY"] + v["maxY"]) / 2
        v["minY"], v["maxY"] = cy - w * 0.225, cy + w * 0.225
    return {k: round(val, 2) for k, val in v.items()}


def from_composition(comp, tcell, gun=False):
    """A diagram built from the composition alone (nothing traced): the formation, the quarterback, defenders by default."""
    d = {"players": {}, "paths": {}, "annotations": {}}
    k = 1
    for cp in comp["players"]:
        pid = f"c{k}"
        k += 1
        p = {"id": pid, "side": "offense", "symbol": cp.get("symbol", "circle"), "label": cp.get("label", ""), "x": cp["x"], "y": cp["y"]}
        if cp.get("outline"):
            p["outline"] = cp["outline"]
        d["players"][pid] = p
    c = Completion(d, tcell, "play", None, False, False, gun)
    c.guesses.append("whole formation placed from the formation pack: the drawing could not be traced")
    c.complete_offense()
    c.complete_defense()
    return c.d, c.guesses
