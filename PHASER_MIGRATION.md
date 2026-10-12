# Phaser migration plan

Prepared on branch `phaser`, against commit `a6b49901ea7279514a960baf15d5141bee04e4f0`.
Implementation status and evidence are recorded below; the default entry remains Pixi until cutover.

## Goal and constraints

Replace PixiJS with Phaser for the browser runtime and presentation while preserving
the game rules, controls, procedural artwork, synthesized sounds, and existing tests.
Keep JavaScript modules, Vite, Vitest, the headless simulator, and relative build paths.
Do not introduce Arcade/Matter physics, a new game design, touch controls, raster asset
downloads, or a TypeScript conversion as part of this migration.

The pinned starting target is **Phaser 4.2.1**, the npm `latest` release checked
during the initial review. Milestone 1 establishes Vite and Chromium WebGL/Canvas
compatibility against that version's package source. Firefox/WebKit remain unverified
because browser downloads are blocked in this cloud environment. Use documentation/source
for the pinned version; record any version change and repeat the compatibility checks.

All **271 existing tests in 30 files** passed during this review under Node 24.19.0.
They must remain intact and pass at every milestone; additional tests increase that
total. Most coverage exercises plain game logic. The suite also covers options,
session/match statistics, cheats, occasions, layout, gamepad polling, and audio
throttling. It does **not** establish browser rendering, scene lifecycle, keyboard
event integration, audible sound, or performance parity. Those need separate checks.

## Findings from the current code

| Area | Current implementation | Migration consequence |
| --- | --- | --- |
| Simulation | `src/logic/` uses plain objects, seeded RNG, `stepWorld` and `stepRound`; no Pixi or DOM dependency. | Preserve these modules and their APIs. Phaser observes world state; it does not own movement, collision, timers, scoring, or bot decisions. |
| Runtime | `src/main.js` owns the Pixi application, fixed-step accumulator, layout, scene switching, startup overlay, global notices, and error recovery. | Replace the host and display tree without changing the order of simulation, input clearing, event delivery, and rendering. |
| Scenes | Five factories in `src/scenes/`: title, settings, play, round end, and tally. `play.js` also coordinates bots, pause, announcements, rumble, statistics, and match transitions. | Keep that orchestration separate from rendering. Reimplement scene ownership and cleanup explicitly. |
| Artwork | Sixteen modules in `src/render/` plus scene labels use Pixi `Container`, `Graphics`, and `Text`. Only the backdrop uses `FillGradient`. | Port drawing recipes, layered animation, text, and transforms. Replacing imports alone will not work. |
| Layout | `layout.js` computes a 1280-wide logical area, 720–1080 logical pixels tall, with extra playable sky; `main.js` writes `ARENA.flightTop`. | Preserve these calculations. A fixed 1280×720 Phaser FIT configuration would change gameplay on tall windows. |
| Input | `input.js` combines DOM keyboard events with `gamepad.js`, which is independently tested. | Preserve physical key codes, edge/held state, stable controller slots, and fixed-step consumption. A framework input rewrite is unnecessary for renderer migration. |
| Audio | `audio.js` synthesizes sounds with Web Audio, including sustained lift/laser voices, panning, compression, gesture unlock, suspension, and throttling. | Retain the synthesizer as a page-level service. Avoid a competing Phaser sound context or sample-based replacement. |
| Resources | Views cache unchanged drawings, pool rockets/bombs, and hide gone entities. Pixi destruction uses `DESTROY_ALL`. | Preserve these optimizations and replace cleanup with Phaser-specific ownership rules; Pixi destroy options cannot be reused. |
| Distribution | Vite uses `base: './'`; CI runs lint, tests, and build on Node 22; GitHub Pages deploys `dist/`. | Preserve subdirectory hosting and verify a production build in a browser, not only the dev server. |

## Target architecture

- One Phaser `Game` and a persistent host scene own the canvas, display resources,
  global notices, resize handling, and frame loop. Initially retain the existing
  `{ view, update(dt), render(), destroy?() }` scene-factory contract. This lets each
  factory migrate without simultaneously rewriting application flow into five
  Phaser Scene lifecycles. Native Phaser Scenes can be considered later, separately.
- Pass a small presentation context to view/scene factories so they can construct
  Phaser objects in the host scene. Use focused helpers for text, shapes, ownership,
  and layout. Avoid implementing a general Pixi compatibility layer.
- Keep `src/logic/`, `config.js`, `session.js`, `options.js`, `cheats.js`,
  `occasion.js`, and `scripts/sim.js` independent of Phaser. Keep their existing
  behavior and imports usable in Node. Renderer code reads state without mutating
  it; the existing layout-to-`ARENA.flightTop` update remains an explicit exception.
- Keep keyboard/gamepad and synthesized audio behind their existing APIs. Phaser
  provides the host lifecycle; the existing input/audio services retain their
  semantics. Disable Phaser's automatic sound manager (`audio.noAudio`) and avoid
  installing a second active keyboard/gamepad handler for the same controls.
- Keep global services alive across scene changes, but give each logical scene an
  explicit disposer for its subscriptions, view tree, transient objects, and voices.

During implementation, retain a separate Pixi entry for comparison until milestone 7.
Select the engine at entry-loading time so only one canvas, loop, input service, and
audio service run on a page. Keep the production default on Pixi until the cutover
gate; compare engines in separate page loads. Do not ship both engines in the final
production bundle.

## Milestones

Milestone 0 is implemented on `phaser`. Review [the preservation baseline](baselines/pixi/README.md)
and [visual overview](baselines/pixi/overview.png): 30 deterministic logic scenarios,
98 static/animation images, the original 271 test identities and source hashes,
and twelve sequential 60-second cloud performance samples are saved. All 303 tests
(271 original plus 32 baseline checks), lint, build, and the ten-round simulator
passed. The image verifier passed all 98 references with the documented bounded
GPU rounding allowance. Performance uses headless Chromium/SwiftShader; physical
GPU acceptance remains milestone 6. At milestone 0, no game source, original tests,
or dependency files changed.

Milestone 1 is implemented: a separate `?engine=phaser` preview loads Phaser 4.2.1
with a persistent host, existing input/audio services, fixed-step scheduling, and
the original layout rules. The 30 baseline scenarios match under five schedules;
all 460 tests pass, including the original 271. Chromium checks cover WebGL and
Canvas, DPR 1/2/capped 3, resize, extra sky, clipping, pause, startup, controller
input, recovery, and disposal. Dev and production root/subdirectory checks pass.
See [the host review notes](docs/phaser-host/README.md) for evidence and limitations.

Milestone 2 is implemented: focused Phaser drawing, text, UI, cached-list, tint,
and resource helpers plus a static `?engine=phaser&gallery=primitives` comparison
gallery. Real, unchanged Pixi factories supply the independent references.
Chromium WebGL/Canvas checks cover all five window shapes, both layout settings,
DPR 1/2, and dev/production root/subdirectory URLs. Disposal/adoption checks show
no object or texture growth after 100 cycles. All 460 tests still pass; hashes of
the original 30 test files and 48 source files are unchanged. See
[the drawing and ownership review notes](docs/phaser-primitives/README.md).

Milestone 3 is implemented: all sixteen procedural rendering modules have native
Phaser implementations and a render-only `?engine=phaser&gallery=artwork` preview.
Chromium WebGL/Canvas at DPR 1/2 pass 816 development artwork/layout cases, 192
longer animation cases, and 232 production cases at each root/subdirectory URL.
Drawing/pose audits preserve geometry, animation formulas, layering, colors and
text; bounded pixel comparisons and separate silhouette checks pass. Four sets of
100 create/render/destroy cycles show no object or texture growth.
Owned paint images retain cached redraws, separate cosmetic RNG, animal/drop caches
and projectile pools. Host and primitive-gallery regressions also pass.
Original game logic, graphics source and 271 test identities are unchanged; all
460 tests, lint, build and the ten-round simulator pass. Review
[the complete artwork notes](docs/phaser-artwork/README.md).

Milestone 4 is implemented: `?engine=phaser` runs the complete five-scene game,
with original menus, cooldowns, bots, pause/restart/exit, cheats, statistics,
sudden death, and per-mode tallies. Results adopt and release the frozen playfield,
and refit its HUD on resize without advancing animation. Phaser-owned DOM input
and fullscreen services preserve the original APIs and add explicit cleanup.
Fullscreen menu entry runs inside the keyboard event; controllers may exit but
cannot enter fullscreen or unlock audio. Chromium WebGL/Canvas at DPR 1/2 pass
full scene/input/controller/fullscreen checks; production root/subdirectory URLs
also pass. Forty repeated completed-match lifecycle fixtures show no object,
texture or subscription growth. Four traces through the real Pixi and Phaser
play scenes match round state and ordered events over 2,400 frames / 4,760 steps.
All 460 tests pass, and all original source/test hashes remain unchanged.
Physical two-controller/rumble acceptance remains a manual review item in this
cloud environment. See [the scene/input review notes](docs/phaser-scenes/README.md).

Milestone 5 implements the synthesized-audio verification harness. The unchanged
34 recipes and page-level Web Audio service remain shared by both engines.
Both pass 62 event/branch expectations and 43 OfflineAudioContext cases; the
captured sound/voice order matches, with bounded native float rounding in the
review PCM samples. Real play-scene gun/laser traces compare every step's events
and audio delivery. Chromium verifies blocked autoplay before user activation,
context replacement, controller-only sound hints, mute/pause/resume, and cleanup
on restart, round end, error recovery and host disposal. Development WebGL/Canvas
and production root/subdirectory lifecycle checks retain one page context and
drain sources after the existing laser modulation tail. All 460 tests, lint,
build and simulator checks pass; original source/test hashes are unchanged.
Review [the audio evidence and listening samples](docs/phaser-audio/README.md).
**Human listening and Firefox/WebKit/Safari acceptance remain pending; the audible
parity exit gate is not closed by automated signal checks.**

Milestone 6 adds sequential production performance measurements, a local M1
MacBook Air comparison runner, a real 30-minute lifecycle soak, and cache/context
restoration checks. Phaser shares identical procedural textures, uses native
WebGL tinting, and draws gameplay effects/fireworks with native WebGL Graphics.
Canvas retains its raster path; snow retains supersampled raster masks in both
renderers. Original drawing recipes, effect caps and simulation remain preserved.
All 460 tests, the original 271 identities/source hashes, lint, build and simulator
checks pass. Browser checks pass 816 development artwork cases and 232 production
cases at each root/subdirectory URL, primitive ownership, four real play traces,
cache lifetimes and active-play context restoration. A real 30-minute production
soak completes 50 matches, 60 rounds and five restarts, with stable listeners and
collected heap and drained sources after disposal. All 36 sequential production
timing windows are saved. Phaser has faster median cloud rAF pacing but higher
p95 CPU cost in every scenario; all six exceed the proposed 10% CPU comparison
allowance, and stress exceeds 16.7 ms p95 CPU. These measured exceptions remain
explicit; implementation completion does not close the performance acceptance gate.
See [the performance evidence and review instructions](docs/phaser-performance/README.md).
**M1 Safari/Chrome performance acceptance remains pending. The cloud runner uses
SwiftShader and cannot establish the physical 60 fps gate. Milestone 7 has not
started; the default entry remains Pixi while these gates are reviewed.**

### 0. Record the preservation baseline

**Deliverables:** a feature/visual checklist, reproducible logic fixtures, and a
performance baseline captured before modifying the renderer.

- Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, and
  `npm run sim -- 10`. Record tool versions and executed test identities as well as
  the count; a green replacement suite with fewer original cases is insufficient.
- Capture title, settings, countdown, active play, pause, round result, and tally.
  Include one/two players, all CPU difficulties, 60/90/120-second rounds, best of
  1/3/5/7, a tied match entering sudden death, and tally retention across matches.
- Create seeded input traces and read-only world-state fixtures for normal play,
  lifting/delivery/theft, knockback/ram/daze, animal transformations/restocks,
  every power-up, wolves, time bombs, ammo crates, and golden scoring. Record
  ordered events, positions, velocities, scores, ammo, round phase, and statistics
  at fixed step numbers. Account for object references/functions when serializing;
  do not compare a naïve JSON dump of the world or rewrite logic for serialization.
- Fix cosmetic RNG and time in the browser capture harness, independently of the
  world/bot RNG. Moon phase is chosen at module load; several animations use
  `Math.random`. Set fixtures before importing either renderer. Use the existing
  `?date=` override for seasonal art and retain unseeded production behavior.
- Capture device/browser/viewport/DPR and performance measurements described below.

**Exit gate:** original 271 tests pass; both static and animated references exist;
logic traces can be replayed deterministically. References and cloud timing data
are recorded in `baselines/pixi/`; physical hardware acceptance remains milestone 6.

### 1. Prove the Phaser host, timing, and layout

**Depends on:** 0. **Primary files:** new Phaser entry/host, `main.js`, `layout.js`,
`index.html`, package manifest/lockfile when implementation begins.

- Install the pinned Phaser version alongside Pixi temporarily. Prove Vite ESM
  imports, dev startup, production build, and supported browser/WebGL operation.
  Test Canvas fallback if offered by the target build; record any unsupported path
  instead of silently changing the browser support policy.
- Configure a resizable canvas and reproduce the current logical-to-screen
  transform, clipping, black bars, and antialiasing. Test DPR 1 and 2 and the current
  DPR cap of 2. Do not assume Pixi `resolution`/`autoDensity` maps to a Phaser game
  option: verify backing-store size, CSS size, camera/container scale, and text
  resolution against the pinned API without applying DPR scaling twice.
- Keep `fitWindow`, `sceneShift`, and `menuLift`. Use their results for root/arena
  positioning, top-anchored HUD, clipping, and `ARENA.flightTop = -layout.extra`.
  Prove 16:9, 16:10, 4:3, ultrawide, capped portrait, resize, and the 16:9 toggle.
- Port the accumulator with `STEP = 1 / 60`, seconds conversion, and a 0.25-second
  frame cap. Check Phaser delta smoothing and visibility behavior explicitly.
  Each fixed step must poll pads, update the logical scene, consume its events
  once, then clear pressed edges. Render once after stepping. Do not also call
  `stepRound` from another Scene update, physics loop, tween, or timer.
- Match and document actual Pixi tab-hide/return behavior before configuring
  Phaser visibility hooks. Preserve pause-menu input while simulation and effects
  are frozen; pausing the entire host would prevent the menu from working.
- Preserve the gesture-consuming startup overlay and error recovery: clear input
  edges/accumulator, stop voices, return to title, and stop after repeated errors.

**Implementation notes:** `src/entry.js` imports only the selected engine.
`src/phaser/main.js` owns one persistent host Scene; `preview.js` exercises existing
`stepRound` using calibration markers rather than porting artwork early. Physics,
Phaser keyboard/gamepad/mouse/touch handlers, and Phaser audio are disabled. The
existing DOM input and Web Audio synthesizer remain the page services.

Phaser 4.2.1 has no Pixi-style renderer `resolution` option. The backing canvas is
window pixels times capped DPR; Scale.NONE zoom gives CSS dimensions; a top-left
camera applies `fitWindow().scale * DPR` once and clips to the logical field.
`sceneShift` positions the arena, `menuLift` positions menu text, and HUD/notices
remain top/bottom anchored. Text uses verified resolution-2 textures. Identical
refits avoid clearing the Canvas backing store unnecessarily.

Timing inspection found Pixi's default `ticker.minFPS = 10` already limits the
delta delivered to `main.js` to **100ms**, inside its 250ms frame cap. The Phaser
loop retains both caps and the original floating-point accumulator. It uses RAF
timestamps because Phaser resets delta on focus/visibility return; smoothing is
disabled. Pixi adds no visibility pause: when the browser stops RAF, the next frame
receives at most 100ms, with no full hidden-time catch-up. The host preserves this
behavior and resumes audio on visibility return. A pause freezes round time and
effects at the logical-scene level while the host keeps polling menu input.

The startup gesture clears pressed edges and the accumulator. Recovery clears both,
stops voices, restores the preview title, and halts after four errors in five seconds.
Host subscriptions are removed on Scene shutdown/destruction. Vite changes to the
Phaser host reload the page after disposal to clear Phaser's global visibility hooks.

**Exit gate:** a minimal host draws and resizes correctly; replayed traces produce
the baseline state and event order with 30/60/120/144 Hz frame schedules and frame
stalls. Pause consumes no simulation time. No double stepping or lost input edges.

### 2. Prove drawing primitives and resource ownership

**Depends on:** 1. **Primary files:** presentation helpers, `render/text.js`,
`render/uiLayer.js`, `render/listView.js`, and representative backdrop/saucer shapes.

- Map shapes deliberately: Pixi ellipse arguments are radii, whereas Phaser
  `fillEllipse` takes width/height. Translate polygon coordinates, rounded
  rectangles, star points, Bézier/quadratic curves, line widths/caps, stroke/fill
  order, per-shape alpha, rotations, negative scales, and object/container origins.
  Use sampled curve paths or procedural Canvas drawing where native Graphics
  cannot reproduce a recipe; verify quality before porting every shape.
- Recreate the sky's three-stop gradient, including the stop at 0.55. Phaser's
  four-corner Graphics gradient is not a direct equivalent. Prefer a procedural
  Canvas texture for the static sky. In the inspected package,
  `Graphics.generateTexture` uses Canvas and cannot bake `fillGradientStyle`;
  explicitly generate the gradient with Canvas APIs instead.
- Keep monospace labels, original sizes/colors/boldness/alignment, multiline text,
  anchors (Phaser origins), Unicode glyphs, and resolution 2. Test tint/alpha
  semantics rather than assuming Pixi's setters behave the same way.
- Verify nested containers, child order, reparenting, parent alpha/tint, and root
  mask/viewport behavior in each supported renderer. Avoid registering a child in
  both a scene display list and a container so it renders twice.
- Define ownership for generated texture keys, text textures, graphics, masks,
  and pooled objects. Destroy scene-owned resources once; retain shared generated
  textures until the host is disposed. Test reparenting without destruction.

**Exit gate:** a comparison gallery matches representative saucer, cow, lamb,
parachute, wolf curves, transparent glow, gradient, and text at all target scales.
Repeated construction/destruction does not accumulate objects or texture keys.

### 3. Port the complete procedural graphics

**Depends on:** 2. **Primary files:** all remaining `src/render/` modules.

Port in this order, keeping each view's `sync`, `tick`, and effect APIs recognizable:

1. `backdrop`, `text`, `uiLayer`, `menu`, and `hud`: sky, stars, every moon phase,
   hills, ground, pens, flags, score/wins/ammo/reload/power bars, notices and banners.
2. `saucerView` and `animalView`: pilot eyes/blink, glass/hull/lights, tilt, shields,
   shock fronts, carried weapons, dizzy stars, walking/dangling legs, owner collars,
   golden badges/glitter, nervous warnings, fire, parachutes, and twin beams.
3. `powerupView`, `listView`, `wolfView`, `timeBombView`, `projectileView`: every
   power icon, green man/package/crate, wolf states, bomb countdown, pooled
   rockets/bombs, projectile trails and laser glow/hit indication.
4. `effects`, `festive`, `shootingStars`, `tieFlyby`: particles, confetti, rings,
   stains, popups, hit/deflect flashes, world-only shake, title sky animations,
   Christmas snow/hat, New Year's fireworks, midsummer poles/ribbons, May 4
   station/fighters, Halloween moon/bats/lanterns.

Preserve child order, including cows behind lambs, beams behind animals, and HUD
above the shaking world. Preserve animation formulas and fixed-step effect updates
first. Keep cosmetic randomness separate from world/bot RNG. The render pass must
not advance gameplay or consume logic RNG. Do not replace recognizable artwork with
generic Phaser assets or substitute unrelated particle presets.

Keep cached drawings and existing pools. Bake static components into generated
textures where measured benefits justify it; retain independently moving parts.
Large padded scenery needs explicit bounds and offsets when baked, including
negative coordinates, to avoid clipping the extra sky or ground. Do not redraw a
static sky or rebuild text textures every frame.

**Exit gate:** every visual item has a checked reference in normal and seasonal
modes. Fixed-time animation samples preserve pose, layering, timing, colors, and
legibility. Allow documented edge-only antialiasing differences across engines;
missing shapes, altered silhouettes, spacing, effects, or gradient stops fail.

### 4. Complete scene flow and input integration

**Depends on:** 3. **Primary files:** all five `src/scenes/` factories, host scene
switching, `input.js`, `gamepad.js`, `fullscreen.js`, session/options integration.

- Port title/settings/play/result/tally construction to the presentation context.
  Keep menu cooldowns, settings persistence, cheat filtering, CPU input,
  announcements, scoring/statistics updates, sudden death, and per-mode tallies.
- Preserve the result screen's frozen final field. Today `game.go` invokes the
  old scene's logical disposer, while its display tree can be adopted by the next
  scene. Transfer that tree explicitly without destroying it; dispose it after
  the result ends. Recompute layout on resize without resuming its simulation or
  effects. Test restart/exit and result transitions for leaks and double counting.
- Keep DOM `KeyboardEvent.code`, repeat filtering, game-key `preventDefault`,
  held state versus pressed edges, blur clearing, cheat-swallowed keys, and solo
  merging of both key sets. A tap between steps must register once; a press during
  a frame with several fixed steps must not fire once per step. Do not replace
  these semantics with render-frame `JustDown` checks.
- Keep `createPadPoller`, dead zone 0.4, digital axes, button mappings, stable
  red/blue slot assignment, reconnect behavior, permission-failure fallback, and
  optional rumble. Verify controller confirmation/pause/directions do not trigger
  forbidden sound/fullscreen actions or skip screens unexpectedly.
- Preserve fullscreen from F/double click/settings, gesture requirements,
  Keyboard Lock for Escape where available, prefixed Safari support, and pause on
  unexpected fullscreen exit. Current menu-triggered fullscreen runs through a
  fixed-step callback; test whether browsers honor its activation and, if needed,
  dispatch that action directly from the originating trusted event while retaining
  the same selection behavior. Do not rely on a controller button as activation.
- Remove scene subscriptions on shutdown (notably title cheat filters and play
  fullscreen listeners); unregister global listeners on host destruction/HMR.

**Exit gate:** a browser completes a solo and two-player match, restart, exit,
settings round trip, pause/resume, sudden death, and play-again/tally flow. Keyboard
edge tests, mocked gamepad integration, and real two-controller checks pass.
Original gamepad/layout/cheat/options/session tests remain unchanged and green.

### 5. Validate synthesized audio parity

**Depends on:** 4; audio retention starts in 1. **Primary files:** `audio.js` and
host/play scene lifecycle hooks.

- Keep the existing `SOUNDS` recipes and Web Audio service instead of moving them
  to Phaser sample playback. Confirm Phaser creates no competing audio context.
- Deliver round events once per simulation step to effects, announcements, rumble,
  and `handleEvents`, including intermediate events in multi-step frames. Keep
  lift/laser start-stop order, side-dependent shots, delivery/golden chimes,
  countdown, result jingle, stereo pan, gain smoothing, and compression.
- Preserve first keyboard/pointer gesture unlock, controller-only sound hint,
  context replacement/recovery, mute, pause suspension, visibility resume, and
  `stopVoices` on restart, exit, round end, and error recovery. Do not close the
  page-level context during every scene transition or suspend menu input with it.
- Retain limits of three identical starts per 0.08 seconds and 24 starts per
  0.25 seconds. Check throttling after a context clock reset. Use the existing
  recipes with OfflineAudioContext for meaningful envelope/duration/pan checks;
  noise-based sounds need controlled noise or tolerance, not byte equality.
- Listen in supported browsers for sustained voices, overlapping bursts, pause,
  mute, tab return, and blocked autoplay. Instrument context/voice/node lifetimes
  to investigate growth before proposing unrelated synthesizer changes.

**Exit gate:** the existing three throttle tests pass unchanged, event-to-sound
integration checks pass, one page-level audio service remains, and audible parity
and pause/unlock behavior are verified. Throttle tests alone do not close this gate.

### 6. Verify performance and soak behavior

**Depends on:** 4 and 5. **Deliverables:** repeatable comparison harness, measurements,
and narrowly scoped optimizations that retain graphics and game behavior.

- Compare separate Pixi and Phaser builds on the same device/browser, viewport,
  DPR, seed, input trace, sound settings, and warmup. Use an ordinary round,
  crowded/restocked pens, dual lasers, animal rain/fire/splats, golden glitter,
  rocket trails, and snow/fireworks. Include a lower-powered laptop/iGPU.
- Record actual displayed frame intervals and p50/p95/p99 update/render CPU time,
  long frames, draw calls, active objects/particles, texture count/GPU memory where
  available, JS heap, startup time, and production bytes transferred. Separate
  compile/warmup from a 60-second measurement window and repeat three times.
- Proposed gate: sustain 60 fps on the reference hardware in ordinary play, with
  p95 CPU update/render work below 16.7 ms and no more than a 10% regression from
  the equivalent Pixi sample. Stress-scene stalls must not regress beyond that
  comparison allowance. These are acceptance targets, not measured results;
  adjust and document the device-specific budget after milestone 0 measurements.
- Preserve caps of 1500 gameplay particles, 12 popups, 220 default snowflakes,
  and 700 fireworks sparks. Pool transient views; retain dirty redraws for saucer
  eyes/lights and HUD pips. Consider baked static graphics, batched particles,
  fewer nested containers, and cached unchanged text before removing effects.
  Any emitter optimization must preserve fixed-step lifetime/pause semantics.
- Run at least 50 menu/play/result/restart cycles and a 30-minute session. After
  collection and warmup, heap, texture keys, audio resources, and listeners must
  plateau rather than grow per cycle. World arrays retain gone entities during
  a round; release view maps with the round, without altering logic cleanup rules.
- Investigate Phaser context loss/recovery and confirm generated art can be
  restored or the existing error/reload path gives a usable outcome.

**Exit gate:** measured budgets and lifecycle checks pass; all preserved visual
features remain present. Record any exception explicitly before cutover rather
than hiding a regression by reducing quality, changing rules, or skipping checks.

### 7. Cut over and remove Pixi

**Depends on:** all earlier gates. **Primary files:** `main.js`, package manifest and
lockfile, temporary comparison entry, documentation, and CI browser checks.

- Switch the normal entry to Phaser, remove the temporary engine selector/Pixi
  entry and all Pixi imports, then remove `pixi.js` from manifest/lockfile. Remove
  `DESTROY_ALL` and other Pixi-only helpers; retain the migration references needed
  for future regression comparisons. Verify the built bundle contains one engine.
- Run a clean `npm ci`, lint, all original 271 tests plus new integration checks,
  build, and the simulator. Replay the baseline seeded traces; compare results,
  ordered events, and match statistics, not random aggregate win rates alone.
- Serve the production build at both root and `/martian-vs-martian/`; test loading
  generated graphics, playable flow, and browser console failures. Preserve
  `base: './'` and GitHub Pages deployment. Run Node 22 CI checks as well as the
  cloud runtime checks, and verify browser checks execute actual test cases.
- Complete Chromium/Firefox/WebKit coverage, plus manual Safari/fullscreen,
  real-controller/rumble, audible sound, and keyboard-ghosting checks where
  automation cannot faithfully cover them. Keep the keyboard/controller-required
  touch notice. Report unsupported capabilities separately from failed checks.
- Update README runtime/architecture information and development commands as
  needed. Keep graphics procedural and sounds synthesized; add no runtime CDN or
  external service dependency. Retain `window.__game` debugging access or document
  its deliberate replacement.

**Exit gate:** Phaser-only build; all original tests retained and passing; logic,
visual, control, audio, browser, performance, lifecycle, and hosting gates passed.
No skipped required gate can be described as parity. Migration work can be split
into one reviewable commit/PR per milestone; publishing remains a separate action.

## Validation policy and unresolved decisions

Run lint, the full existing test suite, and build after each implementation milestone.
Add targeted tests for the new boundaries: accumulator scheduling/event delivery,
input integration, resource adoption/cleanup, audio lifecycle, and browser rendering.
Keep browser-dependent Phaser imports out of the Node test dependency graph. Do not
change assertions, remove tests, add skips, or mock away original simulation behavior
to accommodate the new engine.

Phaser version/browser compatibility, exact DPI/clipping configuration, curve/stroke
rendering, reference hardware, and comparison tolerances are decisions for milestones
0–2. The default choices above let work begin without a redesign. Record evidence
and decisions in this document as the milestones complete. If a gate fails, keep the
Pixi entry available, fix that boundary, and rerun its checks before advancing.

References: [Phaser 4.2.1 package](https://www.npmjs.com/package/phaser/v/4.2.1),
[Phaser source](https://github.com/phaserjs/phaser), existing `PLAN.md` for rules,
and `.github/workflows/ci.yml` for the repository's required checks.
