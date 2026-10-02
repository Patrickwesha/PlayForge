"""Compact per-page brief for the transcription pass: cells and OCR lines grouped by cell, one line each.

  python scripts/playbook/agent_inputs.py   -> source/book/input/p-NNN.txt
"""
import json
import os

for n in range(1, 478):
    cells = json.load(open(os.path.join("source", "cells", f"p-{n:03d}.json")))["cells"]
    rows = json.load(open(os.path.join("source", "ocr", f"p-{n:03d}.json"), encoding="utf8"))
    out = [f"PAGE {n}  (300 DPI page pixels, 1650 x 2550)", "CELLS:"]
    for c in cells:
        cut = (" cutLeft" if c.get("cutLeft") else "") + (" cutRight" if c.get("cutRight") else "")
        out.append(f"  {c['id']} bbox={c['bbox']}{cut}")
    groups = {c["id"]: [] for c in cells}
    groups["page"] = []
    for r in rows:
        cx = round(sum(p[0] for p in r["box"]) / 4)
        cy = round(sum(p[1] for p in r["box"]) / 4)
        owner = "page"
        for c in cells:
            x0, y0, x1, y1 = c["bbox"]
            if x0 <= cx <= x1 and y0 <= cy <= y1:
                owner = c["id"]
                break
        groups[owner].append((cy, cx, r["text"], r["conf"]))
    out.append("OCR (draft, often wrong; centre x,y then text):")
    for k, g in groups.items():
        if not g:
            continue
        out.append(f"  [{k}]")
        for cy, cx, t, conf in sorted(g):
            out.append(f"    {cx},{cy}  {t}" + ("  (?)" if conf < 0.7 else ""))
    with open(os.path.join("source", "book", "input", f"p-{n:03d}.txt"), "w", encoding="utf8") as f:
        f.write("\n".join(out) + "\n")
print("ok")
