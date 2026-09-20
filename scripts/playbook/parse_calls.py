"""Pass 2: pull every play CALL off the install diagram pages.

An install diagram page is a title bar (concept, sometimes with personnel) over a grid of cells.
Each cell starts with two header lines:
    line 1: [personnel] FORMATION DIRECTION adjustment/motion tags      e.g. [12/11] Y MO STAMP RT
    line 2: the call: protection + concept + route/run tags             e.g. 200 JET BOTH OMAHA
Headers OCR cleanly (large caps); the tiny route labels inside the drawings do not, so they are
not used here. Nothing is guessed: a header that does not fit the grammar is kept as UNPARSED with
its raw text and page number.

  python scripts/playbook/parse_calls.py <install-number> <first-page> <last-page>

Output: data/packers-2019/calls.install-<n>.json
"""
import json
import os
import re
import sys

ROOT = os.path.join("data", "packers-2019")

FORMATIONS = json.load(open(os.path.join("src", "seeds", "data", "packers2019.json"), encoding="utf-8"))["formations"]
# base words that start a formation name in the pack ("I", "WEST", "DEUCE", "PISTOL BONE", ...)
BASES = sorted({f["name"].upper().split(" RT")[0] for f in FORMATIONS}, key=len, reverse=True)
MOTION = re.compile(r"^\(?\s*([XYZFH](?:-[XYZFH])?)\s+(MO|SH)\s*\)?\s+")
PERSONNEL = re.compile(r"^[\[\(I1l]?\s*(\d{2}[XZ]?(?:/\d{2}[XZ]?)*)\s*[\]\)]\s*")
PROTECTION = re.compile(r"^(P?\d{1,3}|2|3)\s+(JET|SCAT|SCRAM|SOLID|WILLIE|FLOW|FK|KP)\b")


def lines_of(words):
    """Cluster words into rows by vertical centre, then split each row wherever there is a wide gap (two cells side by side)."""
    rows = []
    for w in sorted(words, key=lambda w: (w[2] + w[4]) / 2):
        cy = (w[2] + w[4]) / 2
        if rows and abs(rows[-1]["cy"] - cy) < 9:
            rows[-1]["words"].append(w)
            rows[-1]["cy"] += (cy - rows[-1]["cy"]) / len(rows[-1]["words"])
        else:
            rows.append({"cy": cy, "words": [w]})
    lines = []
    for r in rows:
        cur = None
        for w in sorted(r["words"], key=lambda w: w[1]):
            if cur and w[1] - cur["x1"] < 45:
                cur["words"].append(w)
                cur["x1"] = max(cur["x1"], w[3])
            else:
                cur = {"cy": r["cy"], "x0": w[1], "x1": w[3], "words": [w]}
                lines.append(cur)
    for l in lines:
        l["text"] = " ".join(w[0] for w in l["words"])
        l["h"] = sorted(w[4] - w[2] for w in l["words"])[len(l["words"]) // 2]
        real = [w[5] for w in l["words"] if len(re.sub(r"[^A-Za-z0-9]", "", w[0])) >= 2]
        l["conf"] = min(real) if real else 0
    return lines


def clean(s):
    s = s.replace("‘", "").replace("’", "").replace("|", "I").replace("{", "(").replace("}", ")")
    s = re.sub(r"\bILT\b", "I LT", s)
    s = re.sub(r"\bIRT\b", "I RT", s)
    return re.sub(r"\s+", " ", s).strip(" .,-_")


def parse_formation_line(text):
    """-> dict or None. Grammar: [personnel] (motion) BASE DIR tags..."""
    out = {"personnel": None, "motion_tag": None, "formation": None, "direction": None, "adjustment_tags": []}
    t = clean(text).upper()
    m = PERSONNEL.match(t)
    if m:
        out["personnel"] = m.group(1)
        t = t[m.end():]
    t = re.sub(r"^\(?G\)\s*", "GUN ", t)
    gun = t.startswith("GUN ")
    if gun:
        t = t[4:]
    m = MOTION.match(t + " ")
    if m:
        out["motion_tag"] = f"{m.group(1)} {m.group(2)}"
        t = t[m.end():].strip()
    base = next((b for b in BASES if re.match(rf"^{re.escape(b)}\s+(RT|LT)\b", t)), None)
    if not base:
        return None
    rest = t[len(base):].split()
    out["formation"] = base
    out["direction"] = rest[0]
    out["adjustment_tags"] = (["GUN"] if gun else []) + rest[1:]
    return out


def parse_call_line(text):
    t = clean(text).upper()
    out = {"protection": None, "concept": t, "run_number": None}
    m = PROTECTION.match(t)
    if m:
        out["protection"] = f"{m.group(1)} {m.group(2)}"
        out["concept"] = t[m.end():].strip()
    m = re.search(r"\b(1[2-9]|3[89]|5[0-9])\b", t)
    if m and not out["protection"]:
        out["run_number"] = int(m.group(1))
    return out


def main(install, first, last):
    calls, unparsed = [], []
    for n in range(first, last + 1):
        path = os.path.join(ROOT, "ocr", "words", f"p-{n:03d}.json")
        words = [w for w in json.load(open(path, encoding="utf-8")) if w[0].strip()]
        lines = lines_of(words)
        titles = [l for l in lines if l["h"] >= 24 and l["cy"] < 260 and len(l["text"]) > 6]
        title = clean(" ".join(l["text"] for l in sorted(titles, key=lambda l: l["x0"])))
        heads = [l for l in lines if 11 <= l["h"] <= 23 and l["cy"] > 180 and len(l["text"]) >= 4 and re.search(r"[A-Z]{2}", l["text"]) and l["text"].upper() == l["text"]]
        heads.sort(key=lambda l: (l["cy"], l["x0"]))
        used = set()
        tm = re.search(r"\[(\d{2}[XZ]?(?:/\d{2}[XZ]?)*)\]", title.upper())
        page_personnel = tm.group(1) if tm else None
        for i, a in enumerate(heads):
            if i in used:
                continue
            fa = parse_formation_line(a["text"])
            if not fa:
                continue
            # the call line sits right under it, overlapping in x
            b = next((h for j, h in enumerate(heads) if j not in used and j != i and 14 <= h["cy"] - a["cy"] <= 40 and min(a["x1"], h["x1"]) - max(a["x0"], h["x0"]) > 20), None)
            used.add(i)
            rec = {
                "install_number": install,
                "source_page": n,
                "page_title": title,
                "cell": {"x": round((a["x0"] + a["x1"]) / 2), "y": round(a["cy"])},
                "raw_formation_line": clean(a["text"]),
                "raw_call_line": clean(b["text"]) if b else None,
                **fa,
            }
            if rec["personnel"] is None:
                rec["personnel"] = page_personnel
            if b:
                used.add(heads.index(b))
                rec.update(parse_call_line(b["text"]))
                rec["ocr_confidence"] = min(a["conf"], b["conf"])
            pers = f"[{rec['personnel']}] " if rec["personnel"] else ""
            rec["raw_call_string"] = f"{pers}{rec['raw_formation_line'].split('] ')[-1]} / {rec['raw_call_line'] or '?'}"
            if not b or rec.get("ocr_confidence", 0) < 55:
                rec["status"] = "UNPARSED"
                rec["reason"] = "no call line under the formation line" if not b else f"low OCR confidence ({rec['ocr_confidence']})"
                unparsed.append(rec)
            else:
                rec["status"] = "parsed"
                calls.append(rec)

    out = os.path.join(ROOT, f"calls.install-{install}.json")
    json.dump({"install_number": install, "pages": [first, last], "calls": calls, "unparsed": unparsed}, open(out, "w", encoding="utf-8"), indent=1)
    print(f"install {install}: {len(calls)} calls parsed, {len(unparsed)} UNPARSED -> {out}")


if __name__ == "__main__":
    main(int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]))
