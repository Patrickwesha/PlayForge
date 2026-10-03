# Charting pre-snap alignment from All-22 frames

You chart where the Eagles offense lined up on each snap, from still frames. Formation only: never name the play, the routes or the coverage. Work in `C:\Users\Panashe\Documents\LIFE OS\PlayForge` (Git Bash; python and ffmpeg on PATH).

## What you have (week folder = `source/film/w1`)

- `map.json`: each snap id (W1-001 ...) -> `play` number and `setT` (seconds into the clip of the set frame, about 1 s accurate), plus the sideline camera orientation per quarter.
- `chart-rows.txt`: what an earlier pass (from the NFL site, with the official on-field player list) recorded for each snap: quarter, down and distance, personnel, family, strength, backfield, hash, play text, notes. PERSONNEL in that file is from the official list: trust it. The rest is a second opinion to compare against, not the answer.
- For each play NNN (zero padded): `set-NNN-sl.jpg` (sideline angle, 1920x1080), `set-NNN-ez.jpg` (end zone angle, same moment), `set-NNN-ez2.jpg` (end zone 1.5 s later, players turning: good for jersey numbers), `strip-NNN.jpg` (sideline time strip, a tile every 1.5 s, 6 per row).
- More frames when you need them (the set frame is too early, mid-shift, or after the snap):
  `python scripts/film/frames.py set "D:/eagles-film-room/footage/Washington Commanders at Philadelphia Eagles 2026 REG 1 - Game C.mp4" source/film/w1/plays.json source/film/w1/alt <play>:<seconds>` writes into `source/film/w1/alt/` (use that folder so you do not overwrite another worker's frames).
- To zoom: `ffmpeg -v error -y -i IN.jpg -vf "crop=W:H:X:Y,scale=iw*2:-2" source/film/w1/alt/zoom-<play>-<k>.jpg`, then Read it.

## Teams and roster

Eagles are in dark (midnight green) jerseys, white numbers. 2026 numbers seen on the chart: QB #1 Hurts. RB #26 Barkley, #28 Shipley, #8 Bigsby. TE #88 Goedert, #83 Mundt, #84 Jenkins. WR #6 D.Smith, #13 Wicks, #9 Lemon, #0 M.Brown, #80 Cooper. Use `chart-rows.txt` play text and notes for who was on the field. If you cannot read a number, name = null: never guess a name from position alone unless the personnel leaves only one possibility (say so in notes).

## Method per snap

1. Read the strip to confirm the set moment: the last frame where the offense is set and still, AFTER any shift (everybody resets) and BEFORE any motion starts or the ball is snapped. If `setT` is off, pull a better frame into `alt/`.
2. End zone frame: backfield (under center / gun / pistol, back's side and depth), which tight end is attached vs detached, on or off the ball for the men near the line, hash. Check whether the camera is behind the offense (you see the quarterback's back: screen left = offense LEFT) or facing it (screen left = offense RIGHT).
3. Sideline frame: count receivers each side and their width against the painted numbers and hash marks. Orientation from map.json: when the offense faces screen-left, the TOP of the screen is the offense's RIGHT; facing screen-right, the top is the offense's LEFT. Confirm it against the end zone frame: both angles must tell the same left/right story.
4. The end zone angle crops the wide receivers; the sideline angle shows everyone. Use both.
5. Motion: look down the strip. If a player is moving at the snap, the SET formation is where he started. Write the motion as `who / from where / path / at snap` (or `stop-and-set` for a shift, and then chart the formation after the shift).

## Vocabulary (exact strings)

- `form_family`: `2 Back` | `3x1 'T'` | `Bunch 'B'` | `2x2 'D'` | `2x2 Stack 'S'` | `Empty` | `Big` | `Goal Line` | `Unknown`. 2x2 = two receivers each side. 3x1 = three one side, one away. Bunch = three clustered close enough to touch. Stack = one receiver directly behind another. Empty = nobody in the backfield but the QB. 2 Back = two players in the backfield besides the QB. Big = 3+ tight ends, or no more than one receiver detached. Precedence: Empty > Big > 2 Back > Bunch > Stack > 3x1 / 2x2.
- `backfield`: `Under Center` | `Gun` | `Pistol`.
- `strength`: `Rt` | `Lt` (offense's view) = side with more receivers; when balanced, the side of the Y (Goedert; else the only tight end). null if it cannot be told.
- `hash`: `Left` | `Middle` | `Right` (offense's view; Middle = between the hashes, not on one).
- players: every eligible plus the QB (11 personnel = QB, 1 RB, 1 TE, 3 WR; 12 = QB, 1 RB, 2 TE, 2 WR; and so on: the counts MUST match the personnel).
  - `pos`: QB | RB | FB | TE | WR
  - `side`: L | R | C (C = QB and backs directly behind the ball)
  - `align`: QB: `under_center` | `pistol` | `gun`. Backs: `deep` (I-back depth behind the QB) | `offset` (under center, beside the QB line) | `gun_offset` (beside the QB in the gun) | `pistol_back` | `fb` (in front of the deep back) | `wing_back` (H-back off the tackle's hip, in the backfield). Receivers and tight ends: `inline` (attached to the end of the line, on the ball) | `wing` (off the hip of the end man, off the ball) | `tight` (within about 3 yards of the end man) | `slot` (between the tackle box and the numbers) | `numbers` (on the painted numbers) | `wide` (outside the numbers).
  - `on_line`: true | false (receivers and tight ends only)
  - `order`: receivers and tight ends only: 1 = closest to the ball on that side, counting outward
  - `stack_behind`: the name (or true) of the player this one is stacked directly behind, only for a stack
  - `id_unknown`: true when the body is there but you could not read who it is (name null)
- Use landmarks (hash, numbers, tackle). Do not estimate yards.

## Output: one file per snap, `source/film/w1/out/W1-0NN.json`

```json
{
  "id": "W1-001",
  "personnel": "12", "form_family": "3x1 'T'", "backfield": "Under Center", "strength": "Rt", "hash": "Left",
  "formation": "plain words: who is where, set then as snapped",
  "motion": "Smith / slot R / across to L / at snap",
  "confidence": "H/M/H",
  "angles": "Both",
  "setT": 6.0,
  "agrees_with_chart": {"form_family": true, "strength": true, "backfield": true, "hash": false},
  "notes": "what was read on which angle, anything inferred, why you disagree with the earlier chart if you do",
  "players": [
    {"pos": "QB", "name": "J.Hurts", "side": "C", "align": "under_center"},
    {"pos": "RB", "name": "S.Barkley", "side": "C", "align": "deep"},
    {"pos": "TE", "name": "D.Goedert", "side": "R", "align": "inline", "on_line": true, "order": 1},
    {"pos": "WR", "name": null, "id_unknown": true, "side": "R", "align": "slot", "on_line": false, "order": 2}
  ]
}
```

`confidence` = personnel / formation / hash, each H, M or L. Formation and hash are H only when both angles agree on a clean set frame. `motion` null when there is none. `setT` = the time you actually charted from.

Rules: chart what the frame shows. When you and the earlier chart disagree, look again at both angles, then write what you see and say why in notes. Unsure = say unsure and lower the confidence: a wrong confident answer is the worst outcome. Do not edit any file outside `source/film/w1/out/` and `source/film/w1/alt/`. Do not run git.

Final report: list each snap id with family / strength / backfield, every disagreement with the earlier chart, and every snap you rate L on formation.
