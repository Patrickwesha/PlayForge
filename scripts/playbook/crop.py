"""Zoom helper for reading a page by eye: crop a region of a 300 DPI page render and scale it.

  python scripts/playbook/crop.py <page> <x0> <y0> <x1> <y1> [scale] [out.png]
  python scripts/playbook/crop.py <page> <cellId> [scale] [out.png]

Coordinates are 300 DPI page pixels (the same space as source/ocr and source/cells).
Default out: source/zoom/p-NNN-<x0>-<y0>.png
"""
import json
import os
import sys

from PIL import Image

a = sys.argv[1:]
n = int(a[0])
img = Image.open(os.path.join("source", "pages", f"p-{n:03d}.png"))
if len(a) > 1 and a[1].startswith("c"):
    cells = json.load(open(os.path.join("source", "cells", f"p-{n:03d}.json")))["cells"]
    box = next(c["bbox"] for c in cells if c["id"] == a[1])
    rest = a[2:]
else:
    box = [int(v) for v in a[1:5]]
    rest = a[5:]
scale = float(rest[0]) if rest else 2.0
out = rest[1] if len(rest) > 1 else os.path.join("source", "zoom", f"p-{n:03d}-{box[0]}-{box[1]}.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
c = img.crop(box)
c = c.resize((int(c.width * scale), int(c.height * scale)), Image.LANCZOS)
c.save(out)
print(out, c.size)
