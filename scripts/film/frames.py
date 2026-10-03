"""
Frames for charting, from plays.json (scripts/film/split_plays.py).

    python scripts/film/frames.py index  GAME.mp4 plays.json OUT_DIR            one small frame per play (who is on offense?)
    python scripts/film/frames.py strip  GAME.mp4 plays.json OUT_DIR 6 7 9 ...   a time strip of the sideline clip (find the snap)
    python scripts/film/frames.py set    GAME.mp4 plays.json OUT_DIR 6:5.5 7:12  full-size frame of both angles at N seconds into the clip

index  -> OUT_DIR/index-01.jpg ...  5 x 4 sheets, tiles in play order (left to right, top to bottom)
strip  -> OUT_DIR/strip-006.jpg     one tile every STEP seconds, 6 per row, in time order
set    -> OUT_DIR/set-006-sl.jpg and set-006-ez.jpg (plus -sl2 / -ez2 one second later, for jersey numbers)
"""
import json
import os
import subprocess
import sys

STEP = 1.5  # seconds between strip tiles
COLS = 6


def ff(args):
    subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-y"] + args, check=True)


def grab(video, t, out, width=None):
    vf = ["-vf", f"scale={width}:-2"] if width else []
    ff(["-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", "-q:v", "3"] + vf + [out])


def main():
    mode, video, plays_path, out = sys.argv[1:5]
    plays = {p["n"]: p for p in json.load(open(plays_path))["plays"]}
    os.makedirs(out, exist_ok=True)
    if mode == "index":
        tmp = os.path.join(out, "_tiles")
        os.makedirs(tmp, exist_ok=True)
        ns = sorted(plays)
        for n in ns:
            a, b = plays[n]["sl"]
            grab(video, a + min(4.0, (b - a) / 2), os.path.join(tmp, f"{n:03d}.jpg"), 640)
        per = 20
        for i in range(0, len(ns), per):
            chunk = ns[i : i + per]
            inputs = []
            for n in chunk:
                inputs += ["-i", os.path.join(tmp, f"{n:03d}.jpg")]
            rows = (len(chunk) + 4) // 5
            layout = "|".join(f"{(k % 5) * 640}_{(k // 5) * 360}" for k in range(len(chunk)))
            ff(inputs + ["-filter_complex", f"xstack=inputs={len(chunk)}:layout={layout}:fill=black", "-q:v", "4", os.path.join(out, f"index-{i // per + 1:02d}.jpg")])
            print(f"index-{i // per + 1:02d}.jpg plays {chunk[0]}-{chunk[-1]} ({rows} rows of 5)")
    elif mode == "strip":
        for n in map(int, sys.argv[5:]):
            a, b = plays[n]["sl"]
            tiles = int((b - a) / STEP)
            rows = (tiles + COLS - 1) // COLS
            ff(["-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", video, "-vf", f"fps=1/{STEP},scale=420:-2,tile={COLS}x{rows}", "-frames:v", "1", "-q:v", "4", os.path.join(out, f"strip-{n:03d}.jpg")])
            print(f"strip-{n:03d}.jpg {tiles} tiles, {STEP}s apart, clip {b - a:.1f}s")
    elif mode == "set":
        for spec in sys.argv[5:]:
            n, t = spec.split(":")
            n, t = int(n), float(t)
            p = plays[n]
            grab(video, p["sl"][0] + t, os.path.join(out, f"set-{n:03d}-sl.jpg"))
            if p["ez"]:
                grab(video, p["ez"][0] + t, os.path.join(out, f"set-{n:03d}-ez.jpg"))
                grab(video, p["ez"][0] + t + 1.5, os.path.join(out, f"set-{n:03d}-ez2.jpg"))
            print(f"set-{n:03d} at {t}s")


if __name__ == "__main__":
    main()
