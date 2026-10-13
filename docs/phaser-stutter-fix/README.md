# Safari movement stutter follow-up

> Historical migration evidence: the instructions, test counts, runtime defaults
> and pending checks below describe this milestone at its recorded commit.
> The current game uses Phaser with cartoon/classic graphics; see the
> [current README](../../README.md), [playtest](../phaser-playtest/README.md)
> and [merge validation](../phaser-merge-validation/README.md).

The later [simultaneous-event follow-up](../phaser-shader-warmup/README.md) prepares
shader variants at startup. The reports below remain evidence for this earlier
implementation and its recorded source fingerprints.

The report was ordinary-play micro stutters, most visible on moving saucers in
Safari on an M1 MacBook Air. This patch removes verified rendering/allocation
bursts. Cloud measurements show improvement, but do not establish complete
stutter elimination on that device. The default entry remains Pixi; cutover has
not started. Version remains `2.0.0-dev`.

## What changed

- Immutable cached/shared canvases use Phaser's normal canvas-backed Texture
  source. `CanvasTexture` eagerly creates an ImageData/pixel-array copy that these
  images never use. Mutable private bitmaps retain their existing repaint API.
- Unused animation recipes remain available across frames in a least recently
  used cache, limited to 64 entries and 4 MiB of canvas RGBA surfaces. This avoids
  rebuilding blink shapes. Oversized recipes are discarded, and scope destruction
  clears unused entries. The budget is for unused recipes; it excludes live
  prewarmed artwork, GPU mipmaps and driver allocations.
- WebGL draws tractor beams, animal flames, projectiles and laser hits with native
  Graphics. Original coordinates, colors, alpha, geometry and animation formulas
  remain unchanged. Canvas retains raster drawing. Native ellipses retain the
  previously verified quality of 64; snow, particle caps and fonts are preserved.
- A hidden scene-owned root prepares static wolf, crate, package, green man,
  power-icon, time-bomb and ordnance recipes before active play. Actual arriving
  sprites share those textures, avoiding a large first-appearance upload burst.
  Warmup uses existing artwork factories and its own constant cosmetic RNG;
  actual sprite phases and simulation randomness are unchanged. The warm root
  follows the playfield into the frozen result and is released with it.

The simulation stays at 60 Hz with the existing input, accumulator, delta caps,
physics and event delivery. Movement interpolation is not included, so this patch
adds no interpolation delay. Audible/browser/controller and physical performance
acceptance gates from the migration plan remain open.

## Measured results

The [before](before.json) and [after](after.json) reports contain three sequential
60-second samples per scenario, each after five seconds of warmup. Both use the
same timing helper, seed, viewport, input fixture, browser and disabled-audio
settings. The baseline is the shipped milestone 6 production build; the final
report uses the complete fix. Tests and other heavy jobs do not run during these
measurement windows. The environment is Chromium/ANGLE SwiftShader, 1280×720,
DPR 1; these are not M1 measurements.

| Scenario | CPU p95 before → after | CPU p99 before → after | Peak uploads before → after | Peak pixel readbacks before → after |
| --- | ---: | ---: | ---: | ---: |
| Ordinary moving/shooting | 7.4 → 5.4 ms | 19.7 → 18.0 ms | 50 → 10 | 44 → 2 |
| Repeated two-player lifting | 88.3 → 4.4 ms | 106.4 → 15.0 ms | 62 → 7 | 56 → 1 |

CPU values are medians of each repeat's percentile; burst counts are the maximum
single-frame counts across all three repeats. Ordinary p95 work improves 27%,
but p99 improves only about 9%. The patch does not demonstrate elimination of all
long frames. Lifting p95 improves about 95%. rAF pacing remains limited by this
software runner and is not physical scanout. Remaining small readbacks include
native text allocation; timing counters do not expose GPU-native memory or waits.

An initial patch improved p95 without reliably improving ordinary p99, so the
final implementation also prewarms first-appearance textures. The final data above
includes that warmup; intermediate measurements are not represented as final.

## Preservation and cleanup

All 460 tests pass, including all 271 original executed identities in 30 unchanged
files. All 48 original source hashes remain unchanged. Lint, build and the
10-round simulator pass.

- 360 targeted saucer, animal, weapon and arena image/pose cases pass across
  WebGL/Canvas and DPR 1/2, including 68 strict missing-shape checks. The original
  pixel policy is unchanged. These checks and full primitives ran before adding
  warmup; their rendering-module hashes match the final code.
- An independent no-warmup control removes only the warmup call from the real play
  factory. Seeded play with new drops, wolves, crates and a golden animal has
  **zero differing RGB pixels** at all four renderer/DPR combinations. This verifies
  that hidden templates neither draw nor change visible cosmetic random phases.
- Final production scene/input/fullscreen/controller checks pass in all four
  combinations, with 50 completed-match ownership cycles per mode (200 total).
  Title object, texture and subscription counts return to their baseline.
- All four actual Pixi/Phaser play traces preserve every round state and ordered
  step event over 2,400 frames / 4,760 fixed steps.
- Cache checks verify cross-frame reuse, count/byte limits, immutable pixel-copy
  avoidance, inherited tint, mutable-repaint rejection and complete disposal.
  Actual WebGL loss/restoration during play preserves pixels and resources at
  both DPRs, including the scene's prewarmed textures.

See [validation.json](validation.json) and the separate saved reports. This fix
has repeated scene/resource lifecycle checks; the earlier milestone 6 30-minute
soak belongs to its archived code and is not claimed as a soak of this patch.

## Retest on the M1

Pull `phaser`, run `npm ci` and `npm run dev`, and play the usual
`/?engine=phaser` URL in Safari. Keep the tab visible and compare ordinary saucer
movement and pickup/delivery against Pixi under the same conditions.

For saved diagnostics, open the printed Vite URL with:

```text
/scripts/phaser/benchmark.html?profiles=ordinary,abduction&seconds=60&repeats=3
```

Run comparison and save the JSON. Allow about 15 minutes. The abduction fixture
uses real pickups/carrying, moves both saucers vertically, and resets the test
animals between repeated pickups. It is measurement-only code, absent from the
normal game entry. Sound is disabled only in this graphics benchmark.

The Python runners accept `--profiles ordinary abduction --engines phaser` for a
matching production check. Serve a production build at one URL and provide Vite's
URL via `--fixture-url`; see the milestone 6 reproduction commands. Do not edit
loaded helpers during a run because Vite may reload the measurement page.
