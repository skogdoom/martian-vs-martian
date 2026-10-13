# M1 Safari report and native flag rendering

> Historical migration evidence: the instructions, test counts, runtime defaults
> and pending checks below describe this milestone at its recorded commit.
> The current game uses Phaser with cartoon/classic graphics; see the
> [current README](../../README.md), [playtest](../phaser-playtest/README.md)
> and [merge validation](../phaser-merge-validation/README.md).

The saved [M1 Safari report](m1-safari-before.json) confirms that shader preparation
removed new program compilation during these runs, but frame pacing still trails
Pixi. These are **before-fix** physical-device results. The
[latest Safari retest](#latest-m1-safari-retest) shows fewer long frames and removal
of the recurring uploads, with isolated stalls remaining. Pixi remains the default
pending the final cutover implementation and validation.

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

## Latest M1 Safari retest

The second supplied [Safari report](m1-safari-retest.json) is complete and has the
same reported browser, GPU, viewport, DPR, build mode, profiles and sampling
settings. Both reports contain three 60-second runs per engine/profile after
five-second warmups. The [retest summary](m1-retest-summary.json) records aggregates
and upload/archive hashes; archived JSON formatting is normalized without changing
the supplied data. The manifest still lacks bundle hashes, so the exact tested
commit cannot be verified. The upload and resource changes match the flag fix.

| Metric | Previous Phaser | Retest Phaser | Retest Pixi |
| --- | ---: | ---: | ---: |
| Ordinary mean rAF fps | 59.77 | 59.93 | 60.00 |
| Ordinary callbacks >33.34 ms, across three runs | 22 | 3 | 1 |
| Ordinary median p95 CPU ms | 4 | 4 | 3 |
| Combined mean rAF fps | 58.82 | 59.55 | 59.81 |
| Combined callbacks >33.34 ms, across three runs | 44 | 14 | 12 |
| Combined median p95 CPU ms | 6 | 6 | 5 |
| Median uploads per callback, both profiles | 2 | 0 | 0 |

The recurring uploads are gone in all six Phaser runs: ordinary p50/p95 uploads
are zero, while combined p50 is zero and p95 is 1–2. Ordinary callbacks over
33.34 ms fall by about 86%, and combined callbacks by about 68%. Phaser's measured
view p95 falls from 2 ms to approximately 1 ms in both profiles. Its frame p95
remains 4/6 ms, and p99 remains 5/8 ms. All Phaser runs record zero new shader
programs. These are observed differences between sessions, not a controlled proof
that every timing change comes from the patch.

Ordinary Phaser runs 1 and 2 each reach approximately 60 fps with zero callbacks
over 33.34 ms. Run 3 reaches 59.80 fps with three such callbacks and a maximum gap
of 176 ms. Combined runs reach 59.93, 59.13 and 59.58 fps, with 2, 7 and 5 long
callbacks respectively. The improvements do not establish elimination of stalls.

Combined Phaser run 2 contains a measured frame of approximately 248 ms, including
245 ms inside renderer submission, with zero texture uploads, pixel readbacks or
new shader programs in that frame. Its recorded update and view work are about
1 ms each. The same run has a largest callback gap of 576 ms. The slowest-frame
array is sorted by frame duration, so it does not establish the ordering of those
events or show that the 245 ms submission fully explains the gap. These timers
measure elapsed time inside calls: blocking, garbage collection or descheduling
can contribute, alongside JavaScript and driver work. They do not measure physical
GPU execution or identify a particular WebGL call.

The renderer-submission stall remains a diagnostic target if slowdowns recur or
the quantitative budget review needs more evidence. A Safari performance
trace during a busy-play slowdown, or a separate diagnostic capture of unusually
slow WebGL calls and their enclosing renderer stages, would help distinguish
renderer JavaScript from blocking driver/browser work. Profiling should be kept
separate from the normal comparison because instrumentation adds overhead. This
report alone does not justify a speculative rendering change.

The user subsequently confirmed that ordinary saucer movement and busy moments
now feel smooth in Safari on the M1 MacBook Air. **The manual Safari gameplay
smoothness check has passed.** This confirms the perceived improvement during
play; the recorded benchmark exceptions remain available for budget review.

The user subsequently accepted the [performance budget review](../phaser-candidate/README.md#accepted-performance-budget-review),
closing performance acceptance with a documented exception to the original 10%
relative CPU allowance. Approximately 60 fps in ordinary play, p95 frame work
below 16.7 ms and smooth ordinary/busy gameplay are the accepted criteria. The
benchmark's occasional gaps, higher typical CPU cost and comparison limitations
remain documented; matched production measurements and the unresolved stalls
are follow-ups rather than cutover blockers. Browser compatibility, controller
edge cases and keyboard combinations are advisory by user decision. Two-controller
gameplay, rumble and manual sound acceptance have passed in the
[current gate table](../phaser-candidate/README.md).

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
the cloud probe does not measure the Safari pacing improvements reported above.
These are Chromium
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
