# Simultaneous-event stutter follow-up

The report after the texture-allocation fix was minor slowdowns in Safari on an
M1 MacBook Air when animals arrived, shooting and pickups overlapped, a wolf was
present, and power-ups were falling. This patch addresses a separate verified
cause: shader compilation during active play. Physical Safari acceptance remains
pending; the cloud runner cannot establish elimination of all visible stutters.

## Cause and change

Phaser 4.2.1 specializes its quad shader for the number of textures in each batch.
New arrivals and intervening Graphics batches can introduce a previously unused
count. Phaser then synchronously compiles/links a new program and creates its VAO.
CPU profiling traced long render-submission frames into `getCurrentProgramSuite`,
`createShaderProgram` and `getProgramParameter`. Preparing static artwork alone
cannot prepare every batch composition.

The host now prepares each count from 1 through the native batch limit at startup,
after installing the existing sampler-ID correction. It also prepares the flat
Graphics program. This uses Phaser's own shader and VAO caches and restores the
previous shader additions. The tested renderer has a limit of 16 texture counts;
the program and VAO sets plateau at 17. Canvas skips this operation. Phaser owns
WebGL context restoration and final resource disposal.

Only host startup and shader preparation change in game code. Artwork factories,
geometry, particles, input, audio, physics, simulation timing and interpolation
are unchanged. Preparation moves bounded work to startup and retains the prepared
programs; it does not make compilation free. No dependency/version/cutover changes
are included. The default entry remains Pixi.

## Evidence

The new `combined` benchmark repeatedly triggers four parachuting animals, two
power-up drops, a wolf and an ammo crate every four simulated seconds. Both
saucers perform real pickups while the fixture pulses both shoot buttons. Arrival
counts and real shot, hit, pickup and wolf-eating events are recorded. This is a
repeatable synthetic workload rather than a human play trace. Populations and
fixed-step counts can differ with callback pacing; neither engine logic nor the
fixture is changed between the saved before and after builds.

Three sequential 45-second production samples per build follow five seconds of
warmup, using the same frozen helper, seed, inputs, browser, viewport, DPR and
sound-disabled graphics configuration. Heavy checks did not run during the
measurement windows. The baseline build is `f9a7e28`; its source snapshot matches
the previous follow-up's final fingerprint. The after report matches this patch.

| Combined workload | Before | After |
| --- | ---: | ---: |
| CPU frame p95, median of three sample percentiles | 15.6 ms | 11.2 ms |
| CPU frame p99, median of three sample percentiles | 108.8 ms | 27.9 ms |
| Largest measured CPU frame across three samples | 228.7 ms | 45.6 ms |
| New programs during play, including benchmark warmup | 11 / 11 / 11 | 0 / 0 / 0 |

This is Chromium/ANGLE SwiftShader at 1280×720, DPR 1. The p95 improvement is about
28%; p99 improves about 74%. Callback FPS remains about 8.3 on this software
runner, so these figures do not establish the M1's 60 fps gate. Residual spikes
remain. Texture uploads, object creation, garbage collection, deferred driver
work and audio can still contribute to slowdowns on a physical browser.

Median page readiness was 617 ms before and 644 ms after in these samples. That
includes boot and resource loading, is sensitive to caches, and is not an isolated
measurement of compilation cost or a prediction of Safari startup time.

## Validation

- All 460 tests pass, including the 271 original executed identities. All 30
  original test files and 48 original source files retain their baseline hashes.
- A real-renderer regression check draws every supported texture count twice.
  The old production build creates 13 more programs/VAOs and fails the check.
  The new production build creates zero, retaining 17 programs and 17 VAOs.
- All 12 independent before/after production pixel comparisons have zero RGB
  difference, covering three busy gameplay poses at WebGL/Canvas and DPR 1/2.
  The control uses the previous production bundle, without substituting a fake
  renderer or changing the image comparison threshold.
- Resource/cache checks pass on the final source host in all four combinations.
  Actual WebGL context loss/restoration at both DPRs preserves pixels and resource
  counts, including prepared programs and VAOs. The native all-count shader check
  also passes in those WebGL runs; Canvas correctly records it as inapplicable.
- Production scene, keyboard, controller and fullscreen checks pass in all four
  combinations. Twenty completed-match ownership cycles at each DPR-1 renderer
  return objects, textures, listeners, programs and VAOs to the title baseline.
- Four real Pixi/Phaser play traces preserve round states and ordered events over
  2,400 frames / 4,760 fixed steps. Lint and the production build pass.

See the saved [before](before.json), [after](after.json), [resource](resources.json),
[pixel](pixels.json), [scene](scenes.json), [logic](logic.json) and
[validation](validation.json) reports. This patch has not had another 30-minute
soak; earlier migration/follow-up evidence belongs to its recorded source hashes.

## Retest and reproduction

Pull `phaser`, run `npm ci` and `npm run dev`, and play `/?engine=phaser` in Safari.
Try the reported combination of arrivals, shots, pickups, wolves and falling
power-ups. This retest should use normal sound as well as normal controls.

For saved graphics diagnostics, use the printed Vite URL with:

```text
/scripts/phaser/benchmark.html?profiles=combined&seconds=45&repeats=3
```

Run the comparison with the tab visible and save the JSON; allow several minutes.
This runner compares both engines. Sound is disabled only in the benchmark.
Reports now include shader-compilation counts and the slowest measured frames.

For a production cloud sample, serve each immutable build separately and use a
frozen fixture server containing `scripts/phaser/performance.js` and unchanged
`src/logic` dependencies, with CORS when it has a separate origin:

```sh
python scripts/phaser/check_performance.py \
  --base-url http://127.0.0.1:5194/ --fixture-url http://127.0.0.1:5193/ \
  --software-gpu --engines phaser --profiles combined --seconds 45 --repeats 3 \
  --output /tmp/combined-after
```

When sampling an older build, `--runtime-source-dir /path/to/source-snapshot`
records its corresponding source hashes instead of the current checkout. Keep
helpers and builds unchanged during timing. The resource runner uses Vite because
its temporary presentation store must share the host's module identity; loading a
second unbundled copy beside a production bundle collides with texture prefixes.
The production shader regression control and pixel checks use the shipped bundles.
