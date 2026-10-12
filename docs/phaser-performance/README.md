# Milestone 6: performance and soak verification

The hardware reference is an **M1 MacBook Air**, with Safari as the primary browser
and Chrome for comparison. Cloud timing uses Chromium/ANGLE SwiftShader and cannot
establish that device's 60 fps acceptance. The default game remains Pixi pending
cutover; version remains `2.0.0-dev`.

## Review on the M1

Run `npm ci` and `npm run dev`, then open the printed server URL with
`/scripts/phaser/benchmark.html`. Click **Run comparison**, keep the tab visible,
and save the JSON report. Use power rather than battery, turn Low Power Mode off,
and close heavy tabs. Repeat in Safari and Chrome with the same conditions.
The runner uses a 1280×720 game viewport and the screen's DPR, capped at 2 by the
actual game. Each engine runs alone, with matching seeded inputs and cosmetic
fixtures. It collects three 60-second samples after five seconds of warmup for
ordinary play, stress, snow, and fireworks. Allow about 30 minutes. To include
crowded pens and animal rain, add
`?profiles=ordinary,crowded,stress,animal-rain,snow,fireworks` to the benchmark URL
and allow about 45 minutes. This browser runner measures warmed development
runtime code; production startup/transfer measurements are in the cloud report.

Sound is disabled in the graphics benchmark so untrusted scripted key presses
cannot repeatedly create blocked contexts. The game retains its synthesizer;
audio remains active in the separate lifecycle soak. The benchmark is development
instrumentation and is absent from the normal production entry.

The proposed physical-device gate remains 60 fps in ordinary play, p95 frame CPU
below 16.7 ms, and no more than a 10% regression from matching Pixi samples. Browser
rAF intervals describe callback pacing; physical display scanout is not measured.
Save results and review the budgets before milestone 7. Cloud timing is evidence
about this runner, never a replacement for M1 acceptance.

## Implementation

- Identical raster recipes share scene-owned textures. Replacing a paint slot
  leaves the previous recipe available until the frame ends, allowing slot
  permutations to reuse it. Unreferenced recipes are removed after rendering;
  destroying a scope releases its resources immediately. Shared images cannot
  mutate one another. Cache ownership and inherited tint have independent checks.
- Procedural canvases request `willReadFrequently` before Phaser builds their
  pixel buffers. This avoids repeated GPU readbacks during texture construction.
  Ordinary bitmap resizing defers its blank upload until final pixels are drawn.
- WebGL uses native shader tinting; Canvas retains the pixel multiplication path.
  Labels keep their original colors and metrics. Original recipes, geometry,
  layering and alpha remain subject to the existing bounded image comparisons.
- Gameplay effects and fireworks use native dynamic Graphics in WebGL. Ellipse
  radii are translated to diameters, fills/strokes retain individual alpha, and
  straight fireworks paths keep their original points and widths. Canvas retains
  raster rendering. Snow keeps the existing supersampled raster masks so tiny
  flakes remain visible in minified portrait views.
- No simulation, options, scoring, controls, sound recipe, or original test changes.
  Caps remain 1500 particles, 12 popups, 220 snowflakes and 700 fireworks sparks.
  Cosmetic randomness and fixed-step particle lifetimes remain separate from
  simulation randomness. Pausing freezes the effects as before.

## Cloud timing results

The [raw timing report](performance.json) contains 36 sequential production samples:
six scenarios × two engines × three 60-second windows, each after five seconds of
warmup. The table shows medians across the three runs; percentile distributions,
individual repeats, draw calls, uploads, startup resources and final snapshots
remain in the raw report. Chromium 154.0.8037.57 uses ANGLE SwiftShader at
1280×720, DPR 1. Sound APIs are disabled only for this graphics comparison.

| Scenario | Pixi rAF fps | Phaser rAF fps | Pixi p95 CPU ms | Phaser p95 CPU ms | CPU change |
| --- | ---: | ---: | ---: | ---: | ---: |
| ordinary | 10.34 | 12.32 | 2.3 | 6.4 | +178% |
| crowded | 8.72 | 10.59 | 3.3 | 8.8 | +167% |
| stress | 7.74 | 9.32 | 10.2 | 25.2 | +147% |
| animal-rain | 10.36 | 12.21 | 1.6 | 7.7 | +381% |
| snow | 9.99 | 10.29 | 2.8 | 8.5 | +204% |
| fireworks | 10.06 | 12.05 | 2.6 | 7.6 | +192% |

Phaser has faster median rAF pacing here, but higher CPU costs in every scenario.
**The proposed 10% CPU comparison allowance is exceeded in all six cloud scenarios.**
Stress also exceeds 16.7 ms p95 CPU on this runner. Neither engine reaches 60 fps
on SwiftShader. These are explicit measured exceptions, not physical M1 results;
the milestone 6 acceptance gate remains open before cutover. The narrower
optimizations preserve quality and reduce resource churn, but do not establish
performance parity with Pixi. Review the M1 results and budgets before milestone 7.

Production startup measurements were captured before importing fixture helpers.
Encoded JS resource bytes exclude the HTML document and do not assume GitHub Pages
compression. The bundle hashes/sizes in [validation.json](validation.json) identify
the production build. Generated canvas RGBA estimates and JS heap exclude full
native GPU/audio allocations.

## Preservation and rendering checks

All 460 tests in 32 files pass, including every original test identity in the
unchanged 30 files (271 tests). All 48 original source hashes are unchanged.
Lint, the production build and the ten-round simulator pass. Browser checks pass
816 development artwork cases, with 488 separate strict silhouette checks, and
232 production artwork cases at each root/subdirectory URL. WebGL and Canvas
are checked at DPR 1 and 2; four 100-cycle artwork ownership runs and four
primitive ownership runs pass. Four real Pixi/Phaser play traces preserve round
state and every step's ordered events across 2,400 frames / 4,760 fixed steps.
Cache checks pass in all four renderer/DPR combinations. Actual WebGL context
restoration during active play preserves pixels and resources at both DPRs.

Review the captured [Phaser effects](effects-phaser.png) against [Pixi](effects-pixi.png),
and [Phaser fireworks](fireworks-phaser.png) against [Pixi](fireworks-pixi.png).
These are the checked frames from the preserved recipe/pose/pixel comparisons.

## Lifecycle results

The production soak completed 1801 seconds, 50 completed match cycles, 60 completed
rounds and five pause-menu restarts without a halt. All samples had one running
page-level audio context; active sources ranged from zero to three and drained to
zero after host disposal. DOM listeners stayed at 33 throughout the session and
dropped to 23 after host disposal; remaining Phaser/page-audio listeners live until
the page closes. Collected JS heap ranged from 55.2–79.2 MB overall and 72.3–79.2 MB
in the last fifteen minutes. Counts vary with the current field; the separate
50-cycle production ownership check verifies identical title-scene object, texture
and subscription counts after every completed match.

The raw soak report has a zero `steps` field from an unused host-update hook. It is
excluded from analysis and the hook has been removed from the repeatable driver.
All transitions used the shipped native frame loop; the measured duration uses
wall-clock time. Browser-native GPU/audio allocation totals remain unavailable.

## Evidence and reproduction

`validation.json` records completed checks, immutable source fingerprints and
limitations. Timing, lifecycle samples and artwork evidence are saved separately.
The real production host is used for the soak and production scene checks.

Start Vite on port 5173 in one terminal. In another, run `npm run build` and
`npm run preview -- --port 5175`. With Chromium installed, run the checks below
in a third terminal (a Python virtual environment is recommended).

```sh
python -m pip install -r scripts/phaser/requirements.txt
python scripts/phaser/check_resources.py --base-url http://127.0.0.1:5173/
python scripts/phaser/check_artwork.py --base-url http://127.0.0.1:5173/ --batch-uploads
python scripts/phaser/check_soak.py --base-url http://127.0.0.1:5175/ --minutes 30
python scripts/phaser/check_performance.py \
  --base-url http://127.0.0.1:5175/ \
  --fixture-url http://127.0.0.1:5173/ \
  --profiles ordinary crowded stress animal-rain snow fireworks \
  --seconds 60 --repeats 3 --software-gpu
```

Serve `dist/` after a production build for port 5175; Vite supplies only the
measurement helpers and unchanged pure logic fixture functions. Samples use the
actual game's frame callback, scene update/render, and renderer submission.
Performance samples run sequentially without a concurrent soak or heavy test job.
When cloud rAF intervals exceed the preserved 100 ms delta cap, engines can
complete different fixed-step counts during the same wall-clock window. Reports
include those counts and final world snapshots; this is a real-host throughput
comparison, not an equal-state CPU microbenchmark.
An interrupted Vite reload attempt was discarded. The 15 completed samples were
retained and the remaining full windows resumed, with unchanged timed code and
strict runtime/configuration/browser fingerprints. Do not edit loaded helpers
during a run; Vite can reload even the production page through helper imports.
`--software-gpu` is specifically for the cloud runner; omit it when using physical
Chrome with `--browser` pointing to the installed Chrome binary. Safari uses the
local browser runner above.

Phaser exposes current particle/popup/ring/stain counts through its scene diagnostics;
the unchanged Pixi scene keeps those arrays private. The first cloud snapshots
recorded objects/textures without the Phaser effect counts; those counts were
already checked in the soak and are included in later snapshots and the M1 runner.
This snapshot addition runs after the measurement window and changes no timed work.

Reports contain p50/p95/p99 frame intervals, CPU work, submission time, draw calls,
texture uploads, long tasks where supported, objects, texture counts, JS heap,
startup resources and encoded transfer sizes. Generated canvas RGBA bytes are an
estimate of retained pixel surfaces, not complete GPU memory. Renderer buffers,
platform allocations and physical scanout are not exposed by this harness.

The soak runs for real wall-clock time through the shipped loop. Its first fifty
match fixtures shorten active rounds to exercise results/tally/menu cleanup and
periodic pause-menu restarts; subsequent rounds run at their normal duration.
It samples collected JS heap, texture keys, wrappers, listeners, context count,
source lifetimes, and particles. World arrays may keep gone entities within a
round; the scene and its view maps must release them when it ends. The bounded
observer does not retain histories of dead nodes or listeners. Native source
`ended` callbacks or expired scheduled stops plus collected wrappers establish
cleanup; neither collection nor elapsed time alone hides an unscheduled voice.

WebGL context loss is forced with `WEBGL_lose_context`. After restoration, generated
art and dynamic effects must match the frozen pre-loss image, with unchanged
resource counts. Canvas reports this check as inapplicable.

## Acceptance still open

M1 Safari/Chrome timing and long-session acceptance remain required before cutover.
Human listening, Safari audio interruptions, Firefox/WebKit coverage and physical
controller/rumble checks from prior milestones remain pending. Measured exceptions
must stay visible; passing tests or a faster cloud sample do not close those gates.
Milestone 7 has not started. Stop here for review.
