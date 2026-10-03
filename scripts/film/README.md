# Charting a game from the downloaded All-22

The pre-snap pass of the day-after flow (`/systems/eagles-2026#flow`), done from the video file instead of by hand. Working files go in `source/film/w<week>/` (gitignored). Week 1 2026 was done this way.

1. **Cuts.** `ffmpeg -nostdin -i GAME.mp4 -an -vf "scale=320:180,select='gt(scene,0.06)',metadata=print:file=cuts.txt" -f null -` (full frame rate; about 5 minutes for a game).
2. **Plays.** `python scripts/film/split_plays.py cuts.txt <duration seconds> plays.json` pairs each sideline clip with its end zone clip. It tolerates a false cut inside a clip and angles cut up to a second apart.
3. **Index.** `python scripts/film/frames.py index GAME.mp4 plays.json DIR` writes sheets of 20 plays. Match every workbook row (yard line, under center or gun, order) to a play number and note the set time and the camera orientation per quarter: `map.json`.
4. **Frames.** `python scripts/film/frames.py set GAME.mp4 plays.json DIR <play>:<seconds> ...` writes both angles at the set frame; `strip` writes a time strip of one play.
5. **Chart.** One file per snap in `DIR/out/`, following `scripts/film/CHARTING.md` (vocabulary, method, output shape). Batches of about 11 snaps can be charted in parallel. The set is taken before motion and after a shift. Every disagreement with the workbook row is written down with the reason.
6. **Collect.** `python scripts/film/build_json.py DIR import-data/W<week>_<teams>_playforge.json <week> <OPP> [home]` checks counts and labels and writes the alignment file.
7. **Import.** `npm run import:snaps` reads the workbook and every `import-data/W*_playforge.json`. Add the week to `FILM_WINS_WEEKS` in `scripts/import-snaps.ts` when the frame chart should beat the workbook's formation columns for that week.

What video cannot give: the official personnel (read it from NFL Pro's On Field Players list), down and distance, and the play text. Weak spots when reading frames: on or off the ball, stack versus a tight pair, bunch versus tight trips, receiver names.
