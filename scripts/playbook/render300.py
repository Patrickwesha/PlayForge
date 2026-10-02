"""Render every page of source/gb-2019-playbook.pdf to source/pages/p-NNN.png at 300 DPI (RGB).

  python scripts/playbook/render300.py

The scan is mixed raster: 1-bit ink layers at ~300 DPI over a 150 DPI colour background,
so 300 DPI is the native ink resolution. Output is gitignored (copyrighted source material).
"""
import os
import pymupdf

src = os.path.join("source", "gb-2019-playbook.pdf")
out = os.path.join("source", "pages")
os.makedirs(out, exist_ok=True)
doc = pymupdf.open(src)
made = 0
for i, page in enumerate(doc, start=1):
    target = os.path.join(out, f"p-{i:03d}.png")
    if os.path.exists(target):
        continue
    page.get_pixmap(dpi=300).save(target)
    made += 1
print(f"{len(doc)} pages, {made} new PNGs at 300 DPI in {out}")
