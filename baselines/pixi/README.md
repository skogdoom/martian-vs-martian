# Pixi preservation baseline — milestone 0

This is the first milestone of `PHASER_MIGRATION.md`. It captures the current game
before the Phaser host is introduced. Application source, the dependency manifest
and lockfile, and all original test files are unchanged.

## Review material

- [Overview](overview.png): selected screens and seasonal artwork.
- [Full gallery](gallery.html): all 98 full-size PNG references, including fixed-step
  animation sequences. Animation frames are separate samples, not video recordings.
- `visuals.json`: case settings, image hashes, date, cosmetic seed, viewport, DPR,
  canvas backing size, engine and GPU metadata. DPR 2 and 3 screenshots are sampled
  at CSS size; canvas metadata separately verifies the game's resolution cap of 2.
- `visual-verification.json`: successful independent replay, including the fourteen
  images with small bounded rounding differences (all other images matched exactly).
- `logic.json`: 30 deterministic scenarios, their recorded input runs, ordered
  events, state checkpoints, and a SHA-256 digest covering **every** stepped state.
- `checks.json`: the names and source hashes of all 271 original tests, execution
  results, application-source hashes, tool versions, and production file sizes.
- `performance.json`: timed samples and their environment/methodology limits.
- `performance-summary.md`: ranges across the three samples of each profile.
- `simulation.txt`: output from the existing ten-round balance simulation. Its
  aggregate results are observational; it is not seeded or used as a golden test.

## Coverage checklist

| Area | Captured preservation reference |
| --- | --- |
| Screens | Title, settings, countdown, active play, pause, round result over the adopted frozen field, tally, and sudden death. |
| Options | All 60/90/120-second and best-of-1/3/5/7 combinations on the title; solo title and active play at easy/normal/hard; seeded full bot rounds for all nine length/difficulty combinations. |
| Session | Best-of-1/3/5/7 ties extend into sudden death, winner statistics, play-again tally retention, solo-hard mode isolation, and return to the original two-player tally. |
| Mechanics | Cow lifting/delivery/theft/release/splat, movement/ram, shot knockback/daze, restocking, wolf landing/eating/leaving, timed bomb landing/countdown/blast, golden delivery and ammo-crate pickup. |
| Power-ups | All thirteen collected through mystery packages in logic fixtures; individual visual references. Twin, steal and parachute fixtures also carry/deliver/release animals. Instant transformations render actual package collection, bursts and replacement animals. |
| Layout | 16:9, 16:10, 4:3, ultrawide, capped portrait, fixed 16:9 on a 4:3 window, and DPR 1/2/3. |
| Procedural art | Normal world/UI, saucers/herd, power icons/weapons, stressed fire/glitter/beams/drops, and Christmas, New Year's Eve, midsummer, May 4 and Halloween. Late seasonal samples include fireworks/fighters/bats after their startup delays. |

These are preservation fixtures, not a claim of complete browser coverage.
Real controllers, rumble, audible sound, fullscreen activation, background-tab
behavior, other browser engines, the full sprite-state gallery, and physical GPU
performance remain explicit checks in later milestones. The original audio and
gamepad unit tests are retained.

The stopped-loop screenshots cover scene content; page-level controller/mute/error
notices and startup/visibility timing are host-integration checks for milestone 1.

## Reproduce and verify

Run from the repository root with the documented Node runtime and installed npm
dependencies. No Phaser dependency is needed for this milestone.

```sh
npm ci
npm run lint
npm test
npm run build
node scripts/baseline/logic.js
npm run sim -- 10
```

The suite has **303 passing tests in 31 files**: 271 originals and 32 new baseline
checks. A normal replay verifies frozen references; it never rewrites them. Test
names and hashes in `checks.json` allow checking that original cases survived.

Browser tooling is isolated from the application and Node test dependency graph.
Python 3, Playwright 1.62.0, Pillow 12.3.0 and Chromium 154.0.8037.57 were used here.
If needed, install the pinned Python tools into a local virtual environment and
install Chromium through Playwright or use an existing system Chromium:

```sh
python -m venv .venv-baseline
.venv-baseline/bin/pip install -r scripts/baseline/requirements.txt
.venv-baseline/bin/python -m playwright install chromium
```

Keep a Vite server running in a separate terminal, then run the capture verifier:

```sh
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
python scripts/baseline/capture.py --browser /usr/bin/chromium
```

Use the virtual-environment Python instead of `python` when applicable, and omit
`--browser` on a machine without a system Chromium to use the Playwright browser.
The runner prints its temporary output directory. Do not run browser captures and
performance measurements concurrently. Loopback requests are internal validation.

Logic scenarios use explicit world/bot seeds and fixed `STEP = 1 / 60`. Browser
captures freeze `Date` before imports (including the default logic seed) and use a
separate seeded `Math.random` stream for cosmetic choices. Live animation starts
disabled; the harness drives the **existing scene implementations** with fixed
steps and one view sync per step, then renders the resulting canvas. The real host
loop is used for performance samples. This keeps capture machinery out of `src/`.

No input, world physics, sound recipe, renderer, or game rule is mocked in the Node
fixtures. Checkpoints expand each entity once; hook targets use collection/index
references because application IDs can repeat. Infinity (the initial `sinceHit`
sentinel) and RNG functions have explicit representations. NaN is rejected. Raw
floating-point values are preserved rather than rounded before hashing. Input runs
can be expanded by their `at`/`steps` fields for later host timing comparisons;
scripted setup actions and their resulting state are recorded at fixed step numbers.

Image comparison uses matching dimensions and no masks. At most 64 pixels may
differ, by at most **one** RGB channel value each, to account for measured software
GPU rounding. Larger differences fail and leave artifacts plus `verification.json`.
A different browser/font/GPU stack may require investigation and a documented
comparison policy; do not regenerate to hide drift.

Only deliberate baseline creation/replacement uses these commands:

```sh
node scripts/baseline/logic.js --write
python scripts/baseline/capture.py --write
python scripts/baseline/capture.py --write --performance
npm test -- --reporter=json --outputFile=/tmp/martian-final-tests.json
node scripts/baseline/report.js /tmp/martian-final-tests.json
```

The performance command defaults to five seconds of warmup and three sequential
60-second samples for each of ordinary play, stress, snow and fireworks. A diagnostic
probe can use `--seconds 2 --repeats 1 --output /tmp/martian-probe` without replacing
the reference report. Interrupted reports have `complete: false`; short probes must
not be described as the full baseline. The writer saves completed samples as it goes.

## Performance interpretation

The capture environment is Linux x86_64, headless Chromium and WebGL through ANGLE
SwiftShader (a **software GPU**). Results are useful for comparing both engines on
this runner. They do not establish the plan's physical laptop/iGPU 60 fps target.

Measurements separate update CPU, view-sync CPU, render-submission CPU, actual rAF
intervals, draw calls, object/texture counts and reported JS heap. Submission timing
excludes asynchronous GPU execution. Harness input/stress setup and instrumentation
are included in CPU cost. GPU memory and private gameplay particle counts are not
exposed and are reported as unavailable. Production sizes in `checks.json` are file
and gzip sizes, not measured network transfer or a total of eagerly loaded chunks.

Stress is a documented diagnostic setup: 24 burning/glittering animals, two held
lasers, forced saucer alignment, incoming hazards/drops and periodic rockets/bombs.
It intentionally keeps pressure stable rather than estimating the frequency of such
a state in normal play. Sound is muted, and captures do not validate audible audio.
Headless performance variability and the 60 fps acceptance budget must be assessed
on reference hardware in milestone 6 before cutover.
