"""Side-by-side check: the scan crop next to the vector rebuilt from yards (independent of the scorer).

  python scripts/playbook/preview.py <page> [cellId ...]   -> source/vector/preview/p-NNN-cK.png
"""
import json
import math
import os
import sys

import cv2
import numpy as np

page = int(sys.argv[1])
only = sys.argv[2:]
v = json.load(open(os.path.join("source", "vector", f"p-{page:03d}.json"), encoding="utf8"))
img = cv2.imread(os.path.join("source", "pages", f"p-{page:03d}.png"))
os.makedirs(os.path.join("source", "vector", "preview"), exist_ok=True)
COL = {"black": (0, 0, 0), "red": (40, 40, 220), "blue": (200, 60, 20), "green": (40, 150, 40), "brown": (30, 50, 130),
       "orange": (0, 140, 255), "purple": (160, 40, 140), "gray": (128, 128, 128), "yellow": (0, 200, 220)}


def catmull(pts, smooth):
    out = [pts[0]]
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else pts[i + 1]
        if smooth[i] or smooth[i + 1]:
            for t in np.linspace(0, 1, 12)[1:]:
                t2, t3 = t * t, t * t * t
                out.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)))
        else:
            out.append(p2)
    return out


for cid, res in v.items():
    if only and cid not in only or "diagram" not in res:
        continue
    fr = res["frame"]
    x0, y0, x1, y1 = fr["crop"]
    crop = img[y0:y1, x0:x1]
    H, W = crop.shape[:2]
    s = fr["pxPerYard"]
    ox, oy = fr["origin"]
    canvas = np.full_like(crop, 255)

    def px(x, y):
        return (int(round(ox + x * s)), int(round(oy - y * s)))

    D = res["diagram"]
    for p in D["paths"].values():
        if p["anchor"]["kind"] == "player":
            a = D["players"][p["anchor"]["playerId"]]
            pts = [(a["x"] + q["x"], a["y"] + q["y"]) for q in p["points"]]
        else:
            pts = [(q["x"], q["y"]) for q in p["points"]]
        sm = [bool(q.get("smooth")) for q in p["points"]]
        dense = catmull(pts, sm)
        P = [px(*q) for q in dense]
        col = COL.get(p.get("color", "black"), (0, 0, 0))
        if p["line"] == "solid":
            cv2.polylines(canvas, [np.array(P, np.int32)], False, col, 3, cv2.LINE_AA)
        else:
            dash, gap = (int(s * 0.3), int(s * 0.25)) if p["line"] == "dashed" else (3, int(s * 0.2))
            acc, on = 0.0, True
            for a, b in zip(P, P[1:]):
                L = math.dist(a, b)
                t = 0.0
                while t < L:
                    seg = (dash if on else gap) - acc
                    t2 = min(L, t + seg)
                    if on:
                        pa = (int(a[0] + (b[0] - a[0]) * t / L), int(a[1] + (b[1] - a[1]) * t / L))
                        pb = (int(a[0] + (b[0] - a[0]) * t2 / L), int(a[1] + (b[1] - a[1]) * t2 / L))
                        cv2.line(canvas, pa, pb, col, 3, cv2.LINE_AA)
                    acc += t2 - t
                    if acc >= (dash if on else gap) - 1e-6:
                        on, acc = not on, 0.0
                    t = t2
        if len(P) >= 2:
            tip = np.array(P[-1], float)
            prev = np.array(P[-2], float)
            d = tip - prev
            d = d / max(np.hypot(*d), 1e-6)
            n = np.array([-d[1], d[0]])
            if p["end"] == "arrow":
                tri = np.array([tip + d * s * 0.2, tip - d * s * 0.4 + n * s * 0.22, tip - d * s * 0.4 - n * s * 0.22], np.int32)
                cv2.fillPoly(canvas, [tri], col)
            elif p["end"] == "tbar":
                cv2.line(canvas, tuple((tip + n * s * 0.35).astype(int)), tuple((tip - n * s * 0.35).astype(int)), col, 3)
            elif p["end"] == "dot":
                cv2.circle(canvas, tuple(tip.astype(int)), int(s * 0.16), col, -1)
    r = int(0.42 * s)
    for p in D["players"].values():
        c = px(p["x"], p["y"])
        if p["side"] == "defense":
            col = COL.get(p.get("labelColor", "black"), (0, 0, 0))
            cv2.putText(canvas, p["label"], (c[0] - int(r * 0.6 * len(p["label"])), c[1] + int(r * 0.6)), cv2.FONT_HERSHEY_TRIPLEX, s / 50, col, 2, cv2.LINE_AA)
            continue
        if p["symbol"] == "square":
            cv2.rectangle(canvas, (c[0] - r, c[1] - r), (c[0] + r, c[1] + r), (0, 0, 0), 3)
        elif p.get("shade") == "full":
            cv2.circle(canvas, c, r, (90, 30, 20), -1)
        else:
            cv2.circle(canvas, c, r, (255, 255, 255), -1)
            cv2.circle(canvas, c, r, (0, 0, 0), 3 if p.get("outline") != "dashed" else 1, cv2.LINE_AA)
        if p["label"]:
            fc = (255, 255, 255) if p.get("shade") == "full" else (0, 0, 0)
            cv2.putText(canvas, p["label"], (c[0] - int(r * 0.45 * len(p["label"])), c[1] + int(r * 0.4)), cv2.FONT_HERSHEY_SIMPLEX, s / 75, fc, 2, cv2.LINE_AA)
    for a in D["annotations"].values():
        c = px(a["x"], a["y"])
        col = COL.get(a.get("color", "black"), (0, 0, 0))
        sz = {"sm": 0.3, "md": 0.4, "lg": 0.55}[a.get("size", "md")] * s / 40
        (tw, th), _ = cv2.getTextSize(a["text"], cv2.FONT_HERSHEY_SIMPLEX, sz, 1)
        cv2.putText(canvas, a["text"], (c[0] - tw // 2, c[1] + th // 2), cv2.FONT_HERSHEY_SIMPLEX, sz, col, 1, cv2.LINE_AA)
    both = np.concatenate([crop, np.full((H, 12, 3), 200, np.uint8), canvas], 1)
    tag = f"{res['confidence']} r={res['score']['recall']} p={res['score']['precision']}"
    cv2.putText(both, tag, (10, H - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    cv2.imwrite(os.path.join("source", "vector", "preview", f"p-{page:03d}-{cid}.png"), both)
    print("wrote", cid)
