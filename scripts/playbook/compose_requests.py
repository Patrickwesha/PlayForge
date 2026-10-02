"""Every formation line printed on a diagram in the book -> a composition request for the tag engine.

  python scripts/playbook/compose_requests.py
  npx vitest run --config vitest.render.config.mts scripts/compose-book.render.tsx

Reads the checked transcriptions (source/book/pages), parses each diagram's first header line the way the
Install importer does (parse_calls.parse_formation_line + build_plays.bind_formation), and writes
source/book/compose-requests.json. The TS script then writes source/book/compositions.json.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse_calls  # noqa: E402
from build_plays import bind_formation  # noqa: E402

MOTION_PRE = re.compile(r"^(?:\(?G\)\s*)?([XYZFH](?:-[XYZFH])?)\s+(MO|SHORTY|SHORT|SH)\b", re.I)


def normalise(line):
    """The book's spellings of a formation line that the Install parser does not see: quotes around a motion
    letter, G without brackets, RIGHT / LEFT, a [TANK] personnel word, and shift pages ("Z MO TO I RT": the
    formation he ends in)."""
    t = line.replace("'", "").replace('"', "")
    t = re.sub(r"^\s*[\[(]\s*(TANK[^\])]*|\d{2}[XZ]?(?:/\d{2}[XZ]?)*)\s*[\])]\s*", "", t.strip())
    t = re.sub(r"\bRIGHT\b", "RT", t, flags=re.I)
    t = re.sub(r"\bLEFT\b", "LT", t, flags=re.I)
    t = re.sub(r"^(.*?)\bTO\b\s+", "", t, flags=re.I) if re.search(r"\bTO\b", t, flags=re.I) and not re.search(r"\b(RT|LT)\b.*\bTO\b", t, flags=re.I) else t
    t = re.sub(r"^\(?\s*G\s*\)?\s+", "(G) ", t, flags=re.I)
    return t


def request_for(line, personnel_hint=None):
    """-> (key, request) or (key, None) when the line names no pack formation."""
    key = re.sub(r"\s+", " ", parse_calls.clean(line).upper())
    parsed = parse_calls.parse_formation_line(normalise(line))
    if not parsed:
        pers_m = re.match(r"^\s*[\[(]\s*(\d{2}[XZ]?(?:/\d{2}[XZ]?)*)", line)
        parsed = parse_calls.parse_formation_line(normalise(re.sub(r"^\s*[\[(][^\])]*[\])]\s*", "", line)))
        if parsed and pers_m and not parsed["personnel"]:
            parsed["personnel"] = pers_m.group(1)
    if not parsed:
        return key, None
    pers = parsed["personnel"] or personnel_hint
    entry, _borrowed = bind_formation(parsed["formation"], pers)
    if not entry:
        return key, None
    pre = parsed["motion_tag"]
    return key, {
        "key": key,
        "formationKey": entry["key"],
        "preTag": pre,
        "postTags": parsed["adjustment_tags"],
        "direction": parsed["direction"],
        "personnel": pers,
    }


if __name__ == "__main__":
    seen = {}
    unparsed = []
    for n in range(1, 478):
        p = os.path.join("source", "book", "pages", f"p-{n:03d}.json")
        if not os.path.exists(p):
            continue
        t = json.load(open(p, encoding="utf8"))
        title_pers = re.match(r"^\s*\[([0-9/XZ]+)\]", t.get("title") or "")
        for c in t.get("cells", []):
            if c.get("kind") != "diagram" or not c.get("lines"):
                continue
            line = c["lines"][0]
            key, req = request_for(line, title_pers.group(1) if title_pers else None)
            if key in seen:
                continue
            seen[key] = req
            if not req:
                unparsed.append(line)
    reqs = [r for r in seen.values() if r]
    with open(os.path.join("source", "book", "compose-requests.json"), "w", encoding="utf8") as f:
        json.dump({"formations": reqs}, f, ensure_ascii=False, indent=0)
    print(f"{len(seen)} distinct lines, {len(reqs)} bound to a pack formation, {len(unparsed)} not (e.g. {unparsed[:6]})")
