"""Cleaned, sharpened crops of every diagram cell, plus a reduced copy of every page, for the reader.

  python scripts/playbook/clean_crops.py [first] [last]

Cleaning: paper and scanner grey go to pure white (low-saturation light pixels), ink is darkened a
little, then a mild unsharp mask. Colours (the book's red / blue / green / brown) are kept.
Writes public/book/gb-2019/crops/p-NNN-cK.webp and public/book/gb-2019/pages/p-NNN.webp (gitignored).
"""
import json
import os
import re
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cellgeom  # noqa: E402

first = int(sys.argv[1]) if len(sys.argv) > 1 else 1
last = int(sys.argv[2]) if len(sys.argv) > 2 else 477
OUT = os.path.join("public", "book", "gb-2019")
os.makedirs(os.path.join(OUT, "crops"), exist_ok=True)
os.makedirs(os.path.join(OUT, "pages"), exist_ok=True)
os.makedirs(os.path.join("source", "book", "crops"), exist_ok=True)


def clean(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    s, v = hsv[..., 1].astype(np.int16), hsv[..., 2].astype(np.int16)
    out = bgr.astype(np.float32)
    # paper: light and unsaturated -> white; a soft ramp keeps anti-aliased edges
    paper = np.clip((v - 175) / 45.0, 0, 1) * np.clip((70 - s) / 40.0, 0, 1)
    out = out * (1 - paper[..., None]) + 255 * paper[..., None]
    # ink: dark and unsaturated -> a little darker
    ink = (v < 110) & (s < 80)
    out[ink] *= 0.75
    out = np.clip(out, 0, 255).astype(np.uint8)
    blur = cv2.GaussianBlur(out, (0, 0), 1.0)
    return cv2.addWeighted(out, 1.5, blur, -0.5, 0)


for n in range(first, last + 1):
    page = cv2.imread(os.path.join("source", "pages", f"p-{n:03d}.png"))
    cells = cellgeom.page_cells(n)  # detected cells + the ones the transcription added, without overlaps
    tp = os.path.join("source", "book", "pages", f"p-{n:03d}.json")
    tcells = {c["id"]: c for c in (json.load(open(tp, encoding="utf8")).get("cells", []) if os.path.exists(tp) else [])}
    rows = json.load(open(os.path.join("source", "ocr", f"p-{n:03d}.json"), encoding="utf8"))
    boxes = {}
    for c in cells:
        x0, y0, x1, y1 = [int(v) for v in c["bbox"]]
        # the reader prints the cell's title lines as text above the drawing: start the crop below them
        if c.get("header") and c.get("body"):
            y0 = max(y0, int(c["body"][1]))
        else:
            lines = [re.sub(r"[^A-Z0-9]", "", l.upper()).replace("0", "O") for l in tcells.get(c["id"], {}).get("lines", [])]
            bottom = None
            for r in rows:
                cx = sum(p[0] for p in r["box"]) / 4
                top = min(p[1] for p in r["box"])
                bot = max(p[1] for p in r["box"])
                if not (x0 <= cx <= x1 and y0 <= top and bot <= y0 + (y1 - y0) * 0.3):
                    continue
                k = re.sub(r"[^A-Z0-9]", "", r["text"].upper()).replace("0", "O")
                if len(k) >= 3 and any(k in l or l in k for l in lines if len(l) >= 3):
                    bottom = max(bottom or 0, bot)
            if bottom:
                y0 = int(bottom) + 6
        boxes[c["id"]] = [max(x0, 0), max(y0, 0), x1, y1]
        crop = clean(page[max(y0, 0):y1, max(x0, 0):x1])
        cv2.imwrite(os.path.join(OUT, "crops", f"p-{n:03d}-{c['id']}.webp"), crop, [cv2.IMWRITE_WEBP_QUALITY, 92])
    with open(os.path.join("source", "book", "crops", f"p-{n:03d}.json"), "w") as f:
        json.dump(boxes, f)
    small = cv2.resize(clean(page), None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(OUT, "pages", f"p-{n:03d}.webp"), small, [cv2.IMWRITE_WEBP_QUALITY, 85])
    print(n, len(cells), flush=True)
