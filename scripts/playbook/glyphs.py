"""Single-glyph classifier for the letters inside player rings and the defender letters.

OCR engines are poor at isolated capitals inside circles, so each glyph is compared against templates
rendered from the system fonts (Arial / Calibri / Times / Verdana, regular and bold) after both are
normalised to the same box. Returns (char, score) with score in 0..1.
"""
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT_DIR = r"C:\Windows\Fonts"
FONTS = ["arialbd.ttf", "arial.ttf", "calibrib.ttf", "calibri.ttf", "timesbd.ttf", "times.ttf", "verdanab.ttf",
         "tahomabd.ttf", "cambriab.ttf", "georgiab.ttf", "segoeuib.ttf", "bookosb.ttf" ]
CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$"
N = 32
_templates = None


def norm(binary):
    """binary: uint8 0/255 with ink = 255. Crop to ink, pad to square keeping aspect, resize to N x N."""
    ys, xs = np.nonzero(binary)
    if len(xs) == 0:
        return None, 1.0
    g = binary[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = g.shape
    side = max(h, w)
    sq = np.zeros((side, side), np.uint8)
    sq[(side - h) // 2:(side - h) // 2 + h, (side - w) // 2:(side - w) // 2 + w] = g
    out = cv2.resize(sq, (N, N), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    out = cv2.GaussianBlur(out, (5, 5), 1.2)  # tolerate the blocky edges of small scanned glyphs
    return out, w / float(h)


def templates():
    global _templates
    if _templates is not None:
        return _templates
    _templates = []
    for fname in FONTS:
        path = os.path.join(FONT_DIR, fname)
        if not os.path.exists(path):
            continue
        font = ImageFont.truetype(path, 96)
        for ch in CHARS:
            im = Image.new("L", (160, 160), 0)
            ImageDraw.Draw(im).text((20, 10), ch, fill=255, font=font)
            arr = np.array(im)
            arr = np.where(arr > 110, 255, 0).astype(np.uint8)
            t, aspect = norm(arr)
            if t is not None:
                _templates.append((ch, t, aspect))
    return _templates


def classify(binary, allowed=None, digit_margin=0.12):
    """Best template match. Player and defender labels are letters far more often than digits, so a digit
    (Z/2, S/5, B/8, O/0) only wins with a clear margin."""
    g, aspect = norm(binary)
    if g is None:
        return "", 0.0
    gz = g - g.mean()
    best = {}
    for ch, t, ta in templates():
        if allowed and ch not in allowed:
            continue
        tz = t - t.mean()
        d = float((gz * tz).sum() / (np.sqrt((gz * gz).sum() * (tz * tz).sum()) + 1e-6))
        d -= 0.15 * abs(np.log((aspect + 1e-3) / (ta + 1e-3)))  # aspect matters (I vs H vs W)
        if d > best.get(ch, -9):
            best[ch] = d
    if not best:
        return "", 0.0
    letters = {c: v for c, v in best.items() if not c.isdigit()}
    digits = {c: v for c, v in best.items() if c.isdigit()}
    bl = max(letters, key=letters.get) if letters else None
    bd = max(digits, key=digits.get) if digits else None
    if bl and (not bd or digits[bd] - letters[bl] < digit_margin):
        return bl, letters[bl]
    return bd, digits[bd]


def split_glyphs(binary, min_area=12):
    """Left-to-right glyph masks of a small word (connected components, merging vertically stacked bits)."""
    n, lab, stats, _ = cv2.connectedComponentsWithStats(binary)
    comps = [(stats[i][0], stats[i][1], stats[i][2], stats[i][3], i) for i in range(1, n) if stats[i][4] >= min_area]
    comps.sort()
    groups = []
    for c in comps:
        if groups and c[0] < groups[-1][0] + groups[-1][2] * 0.6:  # overlaps horizontally: same glyph ($, i)
            g = groups[-1]
            x0, y0 = min(g[0], c[0]), min(g[1], c[1])
            x1, y1 = max(g[0] + g[2], c[0] + c[2]), max(g[1] + g[3], c[1] + c[3])
            groups[-1] = (x0, y0, x1 - x0, y1 - y0, g[4] + [c[4]])
        else:
            groups.append((c[0], c[1], c[2], c[3], [c[4]]))
    out = []
    for x, y, w, h, ids in groups:
        m = np.isin(lab, ids).astype(np.uint8) * 255
        out.append((m, (x, y, w, h)))
    return out


def read_word(binary, allowed=None, max_chars=3, soft=None):
    """Classify each glyph of a short word. Returns (text, min score).
    soft: optional grey ink image (0 = paper, 255 = ink) of the same size; when given, glyph shapes are
    taken from it (inside each component's box) instead of the thresholded mask."""
    parts = split_glyphs(binary)
    if not parts or len(parts) > max_chars:
        return "", 0.0
    hmax = max(p[1][3] for p in parts)
    txt, sc = "", 1.0
    for m, (x, y, w, h) in parts:
        if h < hmax * 0.4:
            continue  # stray dot / underline
        if soft is not None:
            pad = 1
            box = np.zeros_like(m)
            box[max(y - pad, 0):y + h + pad, max(x - pad, 0):x + w + pad] = 1
            m = np.where(box > 0, soft, 0).astype(np.uint8)
            m[m < 50] = 0
        ch, s = classify(m, allowed)
        txt += ch
        sc = min(sc, s)
    return txt, sc
