# M1 Safari report and native flag rendering

The saved [M1 Safari report](m1-safari-before.json) confirms that shader preparation
removed new program compilation during these runs, but frame pacing still trails
Pixi. These are **before-fix** physical-device results; no M1 results for the flag
change have been collected. Pixi remains the default and all acceptance gates
remain open.

## What the supplied report shows

The user reported an M1 MacBook Air. The report identifies Safari 26.5.2, Apple
GPU, a 1280×720 viewport and DPR 2. Each cell combines three 60-second samples
following five seconds of warmup. CPU percentiles below are medians of each run's
percentile; callback counts sum the runs. See [the computed summary](m1-summary.json).
The archived report preserves the supplied JSON data with normalized formatting;
its original upload hash and archived-file hash are recorded in that summary.

| Profile | Engine | Mean rAF fps | Median p95 CPU ms | Median p99 CPU ms | Callbacks >33.34 ms / measured callbacks |
| --- | --- | ---: | ---: | ---: | ---: |
| ordinary | Pixi | 60.00 | 3 | 4 | 1 / 10802 |
| ordinary | Phaser | 59.77 | 4 | 5 | 22 / 10761 |
| combined | Pixi | 59.77 | 5 | 7 | 16 / 10761 |
| combined | Phaser | 58.82 | 6 | 8 | 44 / 10591 |

Every Phaser run records zero new shader programs. Its median texture uploads
are two per measured callback in both profiles, versus zero for Pixi. Phaser's
combined p95 uploads are four, versus one for Pixi. Fewer draw calls do not imply
lower total frame cost.

The largest Phaser callback gap is 658 ms. The CPU maximum in that run is 24 ms;
this does not explain the whole pause. CPU work and callback intervals describe
different parts of the frame timeline. Safari does not support the benchmark's
long-task observer, so empty long-task arrays provide no additional diagnosis.
The data cannot identify garbage collection, GPU stalls or other browser work as
the cause of that gap.

This comparison uses development Pixi and the production Phaser candidate. The
candidate module graph matches the saved milestone 7 artifact, but the upload
contains no bundle hashes to prove its precise commit. CPU timing is coarsely
quantized around 1 ms. The combined fixture records matching arrivals but different
collision/event histories and some different fixed-step totals. Both engines
run in fixed Pixi-then-Phaser order. Those limits matter for the plan's 10% comparison
gate; this report does not close performance acceptance.

## Verified source of recurring uploads

An instrumented copy of the preceding production candidate traces the two ordinary
uploads through `createBackdrop().tick()`, its two flag polygons, recipe replacement
and Phaser's texture creation. Each waving flag creates a new 256×256 canvas and
uploads it every rendered frame. Midsummer has two changing ribbons per pole,
producing four uploads. This is independent of shooting, pickups and arrivals.

`flag()` now uses the existing `art.dynamicGraphics()` path. WebGL draws the same
animated polygon vertices with native Phaser Graphics; Canvas retains its existing
raster path. Wave timing, geometry, colors, placement, layering and seasonal
variants are unchanged. No game logic, input, audio, particle limits, dependencies,
version or engine selection changes.

A deterministic, actually rendered scenery probe compares the old and new
production bundles at DPR 2, with no upload batching:

| 120 rendered frames | Before uploads | After uploads | Before draw calls | After draw calls |
| --- | ---: | ---: | ---: | ---: |
| ordinary flags | 240 | 0 | 2880 | 3120 |
| midsummer ribbons | 480 | 0 | 3120 | 3360 |

The change trades texture allocation/rasterization/upload for two additional
native draw calls per scenery frame. It addresses confirmed recurring work, but
does not establish how much Safari frame pacing improves. These are Chromium
154/ANGLE SwiftShader allocation checks, not M1 performance measurements.
[The raw control probe](production-probe.json) identifies both source snapshots
and bundle hashes.

## Validation and reproduction

[The validation summary](validation.json) records all checks and source hashes.
The new [flag regression runner](../../scripts/phaser/check_flag_uploads.py) checks
120 actual render submissions per case. All eight cases pass: ordinary and
midsummer, WebGL and Canvas, DPR 1 and 2. Geometry changes in every case. Each
WebGL case has zero uploads and unchanged texture counts. The preceding bundle
fails the same check with 240 uploads and raster flags; that expected failure is
saved separately from passing checks.

All 460 tests pass, including the 271 original identities in unchanged test files.
All 48 original game-source hashes are unchanged. Lint and both builds pass.

The existing independent Pixi artwork comparisons pass all 564 selected cases,
with 272 additional strict missing-silhouette checks, retaining their recipe, pose,
color, edge and silhouette thresholds across the scenery/arena pages, all seasonal
dates, moon phases and layouts. Production scene/input/controller and resource
restoration checks also pass. These checks cover the changed rendering path;
they do not replace physical controller, audible sound or Safari acceptance.
Review the checked ordinary frame ([Pixi](ordinary-pixi.png), [Phaser](ordinary-phaser.png))
and midsummer ribbons ([Pixi](midsummer-pixi.png), [Phaser](midsummer-phaser.png)).

With the source server on port 5174 and a production candidate on port 4173:

```sh
python scripts/phaser/check_flag_uploads.py \
  --base-url http://127.0.0.1:5174/ \
  --phaser-url http://127.0.0.1:4173/ \
  --output /tmp/phaser-flags-checks
python scripts/phaser/check_artwork.py \
  --base-url http://127.0.0.1:5174/ --pages scenery arena --batch-uploads \
  --output /tmp/phaser-flags-artwork
```

## M1 retest

Update the `phaser` branch, rebuild with `npm run build:phaser`, then start
`npm run preview:phaser` and the separate development server. Use the comparison
instructions in [milestone 7 preparation](../phaser-candidate/README.md), again
with `profiles=ordinary,combined` and the candidate preview URL. Keep the tab
visible and use the same device/browser/power conditions. Save the new JSON and
review ordinary saucer motion and simultaneous-event play by hand. A Chrome run
on the same device remains useful for the browser comparison gate.
