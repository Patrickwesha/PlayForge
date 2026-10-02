"""Merge the printed chunks into one PDF, re-point every contents link, and build the bookmarks.

  python scripts/playbook/finish_pdf.py

Reads source/book/pdf-parts/part-NNN.pdf (from export_pdf.mjs) and public/book/gb-2019/book.json.
Writes source/book/Green-Bay-2019-Playbook.pdf.

Each original page starts on a new sheet whose header reads "Page N"; that is how a book page is found in
the PDF. A link to "#page-N", a page title, a play or a section (Chromium leaves links to anchors outside
its chunk as web links) becomes a jump to the sheet where that book page starts.
"""
import glob
import json
import os
import re

import pymupdf

PARTS = sorted(glob.glob(os.path.join("source", "book", "pdf-parts", "part-*.pdf")))
OUT = os.path.join("source", "book", "Green-Bay-2019-Playbook.pdf")
book = json.load(open(os.path.join("public", "book", "gb-2019", "book.json"), encoding="utf8"))

doc = pymupdf.open()
for p in PARTS:
    with pymupdf.open(p) as part:
        doc.insert_pdf(part)

# book page -> sheet: the "Page N" chip at the top of the sheet where the page starts
sheet_of = {}
for i, pg in enumerate(doc):
    top = pg.rect.height * 0.2
    for x0, y0, x1, y1, text, *_ in pg.get_text("blocks"):
        if y0 > top:
            continue
        m = re.match(r"\s*Page (\d+)\b", text)
        if m and int(m.group(1)) not in sheet_of:
            sheet_of[int(m.group(1))] = i
            break
missing = [n for n in range(1, book["pageCount"] + 1) if n not in sheet_of]

# anchor -> book page
anchor_page = {}
for s in book["sections"]:
    anchor_page[s["id"]] = s["start"]
for p in book["pages"]:
    anchor_page[p["anchor"]] = p["n"]
    anchor_page[p["titleAnchor"]] = p["n"]
    for c in p["cells"]:
        anchor_page[c["anchor"]] = p["n"]

fixed = dropped = 0
for pg in doc:
    for ln in pg.get_links():
        uri = ln.get("uri") or ""
        if ln["kind"] == pymupdf.LINK_URI and "#" in uri:
            frag = uri.split("#", 1)[1]
            n = anchor_page.get(frag)
            pg.delete_link(ln)
            if n is not None and n in sheet_of:
                pg.insert_link({"kind": pymupdf.LINK_GOTO, "from": ln["from"], "page": sheet_of[n], "to": pymupdf.Point(0, 0)})
                fixed += 1
            else:
                dropped += 1
        elif ln["kind"] == pymupdf.LINK_URI and uri.startswith("http://localhost"):
            pg.delete_link(ln)  # app-only links (editor, review list) mean nothing in the PDF
            dropped += 1

# bookmarks: section > page title > play
toc = [[1, "Contents", 1]]
for s in book["sections"]:
    if s["start"] not in sheet_of:
        continue
    toc.append([1, s["title"], sheet_of[s["start"]] + 1])
    for e in s["entries"]:
        if e["page"] not in sheet_of:
            continue
        toc.append([2, f"{e['page']}  {e['label']}", sheet_of[e["page"]] + 1])
        for c in e["children"]:
            toc.append([3, c["label"], sheet_of[e["page"]] + 1])
doc.set_toc(toc)
doc.set_metadata({"title": "Green Bay 2019 Playbook (rebuilt)", "subject": book["source"], "creator": "PlayForge"})
# the book is all vector now; a deep garbage pass (garbage=3) over 500 MB of chunks never finishes on this PC
if any(pg.get_images() for pg in doc):
    doc.rewrite_images(dpi_threshold=220, dpi_target=200, quality=82, lossy=True, lossless=True)
tmp = OUT + ".new"
doc.save(tmp, garbage=1, deflate=True)
try:
    os.replace(tmp, OUT)  # fails while a viewer holds the old file open: the new one is left beside it
except PermissionError:
    OUT = tmp
print(json.dumps({"sheets": len(doc), "bookPagesFound": len(sheet_of), "missing": missing[:20], "linksFixed": fixed,
                  "linksDropped": dropped, "bookmarks": len(toc), "out": OUT}))
