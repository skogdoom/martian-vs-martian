# Milestone 1: Phaser host review

The `phaser` branch now has an opt-in Phaser 4.2.1 host. Run `npm ci` and
`npm run dev`, then open `http://localhost:5173/?engine=phaser` (substitute the port
printed by Vite). Add `&renderer=canvas` to select Canvas. The normal URL runs Pixi.

This is a calibration preview, with a seeded round using unchanged game logic and
simple entity markers. Space/Enter starts the round after dismissing the startup
overlay; use the normal movement/shoot controls. P/Esc pauses, R restarts, T returns
to the preview title, and V toggles 16:9. Original artwork and menus are later work.

Review the implementation in `src/phaser/main.js`, the scheduler in `clock.js`,
and the calibration scene in `preview.js`. `src/entry.js` selects the engine before
loading either runtime. There is one engine/canvas per page, with the existing input
and synthesized audio services. Phaser's own sound and input handlers are disabled.

## Validation

- All **460 tests pass**, with no skips. The original **271 test identities and
  source hashes in 30 files** remain unchanged. The 32 preservation baseline tests
  still pass; 157 new tests cover scheduling and replay through the host clock.
- Every one of the 30 saved scenarios matches its full state digest, checkpoints,
  inputs, and ordered events under 30/60/120/144 Hz and mixed frame-stall schedules.
  Scripted setup actions still occur at their exact recorded fixed-step boundaries.
- Chromium runs real WebGL and Canvas rendering at DPR 1, 2, and 3 (capped to 2).
  Each renderer/DPR case checks ten layouts: 16:9, 16:10, 4:3, ultrawide, and capped
  portrait, each with and without fixed 16:9, resizing the same host between them.
  Pixel samples prove black-bar clipping of deliberately oversized scenery and
  ground placement. Backing size, CSS size, camera mapping, and text textures are checked.
- Browser checks verify the consumed startup gesture, one presentation pass per
  frame, one shot from a tap in a multi-step frame, pause without elapsed round time,
  pause-menu layout input, extra-sky flight boundary, mocked controller pause/resume,
  focus/visibility-return scheduling, restart/title, recovery, repeated-error halt,
  and removal of host subscriptions, canvas, and debug handle on destruction.
- The same gate passes against the dev server, production at `/`, and production
  at `/martian-vs-martian/`: **180 layout checks** in total. Lint, production build,
  baseline verification, and the existing ten-round simulator pass.
- Production network checks confirm the Phaser chunk loads only when selected,
  at both root and subdirectory. Automatic Canvas fallback also starts successfully
  when WebGL is disabled.

The checked evidence is in [validation.json](validation.json), with representative
captures: [preview](preview.png), [extra sky](extra-sky.png), and [portrait](portrait.png).

To repeat the browser gate, use the Python packages pinned in the baseline runner:

```sh
python -m venv .venv-baseline
.venv-baseline/bin/pip install -r scripts/baseline/requirements.txt
# Uses system Chromium when installed; otherwise install Playwright's Chromium.
.venv-baseline/bin/python -m playwright install chromium
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

In another terminal:

```sh
.venv-baseline/bin/python scripts/phaser/check_host.py
# Against a static production server, including a real subdirectory mount:
.venv-baseline/bin/python scripts/phaser/check_host.py --base-url http://localhost:5175/martian-vs-martian/
npm run lint
npm test
npm run build
node scripts/baseline/logic.js
npm run sim -- 10
```

Evidence defaults to a temporary directory. `--output` chooses a directory;
the runner never rewrites Pixi reference images or fixtures. `--browser firefox`
or `--browser webkit` uses the corresponding installed Playwright browser.

## Timing and layout decisions

The existing game advertises a 250ms frame cap, but Pixi's default 10fps minimum
already caps the incoming delta to 100ms. That effective behavior is retained:
at most six 1/60-second steps after a stall, rather than changing gameplay speed
under stalls during a renderer migration. The original floating-point accumulator
is retained, including a possible one-frame delay at an exact step boundary.

Phaser resets its measured delta on focus/visibility return. The host instead uses
the RAF timestamps, with smoothing disabled, so a long return frame is capped in
the same way as Pixi. It does not auto-pause on tab hide; browser RAF suspension or
throttling determines when frames run, as in the original. Automated checks use a
controlled five-second gap and Phaser focus/visibility events; physical tab behavior
across browser engines remains part of later manual compatibility validation.

The backing canvas uses capped DPR and CSS uses window dimensions. Scale.NONE
and camera zoom apply the logical scale only once; the camera viewport supplies
clipping in both renderers. Original `fitWindow`, `sceneShift`, `menuLift`, and
`ARENA.flightTop` behavior is retained. Refitting does not advance game logic or
presentation animation. Text textures have resolution 2 independently of canvas DPR.

## Limits and next review

Measurements and captures use Chromium 154 with the cloud SwiftShader software GPU.
They establish host correctness, not physical GPU performance or full art/audio parity.
Firefox/WebKit binaries were unavailable; browser download attempts returned HTTP
403 `Domain forbidden`. Their compatibility is **unverified**, with no browser
support policy change. Real controllers, audible comparison, full scene flow,
procedural-art parity, and performance/soak acceptance remain later milestones.

Both engines temporarily exist in build output as separate lazy chunks. Vite reports
the expected large Phaser chunk (about 1.38 MB uncompressed / 361 kB gzip); only the
selected runtime loads. The final Phaser-only cutover removes Pixi and the selector.
Frozen Pixi images still show `1.1.0-dev`; the intentional `2.0.0-dev` version label
change is not a reason to regenerate preservation references.

This page records milestone 1 evidence. Milestone 2 is now implemented; see
[the drawing and resource ownership review](../phaser-primitives/README.md).
Milestone 3 has not started.
