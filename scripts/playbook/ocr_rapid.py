"""OCR every 300 DPI page render with RapidOCR (PaddleOCR models on onnxruntime, no admin install).

  python scripts/playbook/ocr_rapid.py [first] [last]

Writes source/ocr/p-NNN.json: [{"box": [[x,y]*4], "text": str, "conf": float}] in 300 DPI pixels.
Line-level boxes. Raw engine output: misreads are fixed later by reading the page image.
"""
import json
import os
import sys

from rapidocr_onnxruntime import RapidOCR

first = int(sys.argv[1]) if len(sys.argv) > 1 else 1
last = int(sys.argv[2]) if len(sys.argv) > 2 else 477
out = os.path.join("source", "ocr")
os.makedirs(out, exist_ok=True)
eng = RapidOCR()
for n in range(first, last + 1):
    target = os.path.join(out, f"p-{n:03d}.json")
    if os.path.exists(target):
        continue
    res, _ = eng(os.path.join("source", "pages", f"p-{n:03d}.png"))
    rows = [{"box": [[round(float(x)), round(float(y))] for x, y in box], "text": txt, "conf": round(float(c), 3)}
            for box, txt, c in (res or [])]
    with open(target, "w", encoding="utf8") as f:
        json.dump(rows, f, ensure_ascii=False)
    print(n, len(rows), flush=True)
