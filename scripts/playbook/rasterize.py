"""Rasterize the playbook PDF to one grayscale PNG per page (same job as `pdftoppm -r 200 -gray -png`).

  python scripts/playbook/rasterize.py "path/to/playbook.pdf" [dpi]

Output: data/packers-2019/ocr/png/p-001.png ... (gitignored: the scans are copyrighted source material).
Needs PyMuPDF: python -m pip install --user pymupdf
"""
import os
import sys

import pymupdf

pdf = sys.argv[1]
dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 200
out = os.path.join("data", "packers-2019", "ocr", "png")
os.makedirs(out, exist_ok=True)
doc = pymupdf.open(pdf)
made = 0
for i, page in enumerate(doc, start=1):
    target = os.path.join(out, f"p-{i:03d}.png")
    if os.path.exists(target):
        continue
    page.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY).save(target)
    made += 1
print(f"{len(doc)} pages, {made} new PNGs at {dpi} DPI in {out}")
