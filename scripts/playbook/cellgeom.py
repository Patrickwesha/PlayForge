"""The diagram cells of a page: the ruled boxes the detector found, corrected by the transcription.

The transcription adds diagrams the detector missed (ids x1, x2 ... with their own bbox). When the
detector had merged that diagram into a neighbour, the neighbour is trimmed so the two do not overlap.
Every step that cuts cells out of a page (tracing, crops, the book) uses this one function.
"""
import json
import os


def _load(path, default):
    if os.path.exists(path):
        with open(path, encoding="utf8") as f:
            return json.load(f)
    return default


def page_cells(n, root="source"):
    det = _load(os.path.join(root, "cells", f"p-{n:03d}.json"), {"cells": []})["cells"]
    tpage = _load(os.path.join(root, "book", "pages", f"p-{n:03d}.json"), {}) or {}
    extra = [c for c in tpage.get("cells", []) if c.get("bbox") and not any(d["id"] == c["id"] for d in det)]
    cells = [dict(c) for c in det]
    for x in extra:
        xb = [int(v) for v in x["bbox"]]
        for c in cells:
            b = list(c["bbox"])
            ix0, iy0, ix1, iy1 = max(b[0], xb[0]), max(b[1], xb[1]), min(b[2], xb[2]), min(b[3], xb[3])
            if ix1 - ix0 < 20 or iy1 - iy0 < 20:
                continue
            overlap = (ix1 - ix0) * (iy1 - iy0) / float((xb[2] - xb[0]) * (xb[3] - xb[1]))
            if overlap < 0.5:
                continue
            # trim the merged cell on the side the added diagram sits
            if xb[1] > b[1] + 40:
                b[3] = min(b[3], xb[1] - 4)
            elif xb[3] < b[3] - 40:
                b[1] = max(b[1], xb[3] + 4)
            elif xb[0] > b[0] + 40:
                b[2] = min(b[2], xb[0] - 4)
            elif xb[2] < b[2] - 40:
                b[0] = max(b[0], xb[2] + 4)
            if b != c["bbox"]:
                c["bbox"] = b
                c["header"] = None
                c["body"] = b
                c["trimmed"] = True
        cells.append({"id": x["id"], "bbox": xb, "header": None, "body": xb, "cutLeft": xb[0] <= 6, "cutRight": xb[2] >= 1644})
    return cells
