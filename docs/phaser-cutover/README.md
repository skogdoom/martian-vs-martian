# Milestone 7: Phaser becomes the normal runtime

> Historical migration evidence: the instructions, test counts, runtime defaults
> and pending checks below describe this milestone at its recorded commit.
> The current game uses Phaser with cartoon/classic graphics; see the
> [current README](../../README.md), [playtest](../phaser-playtest/README.md)
> and [merge validation](../phaser-merge-validation/README.md).

The `phaser` branch now uses Phaser for the normal game. The standard entry imports
only `src/phaser/main.js`; the temporary engine selector and active Pixi host,
input/fullscreen, scenes and drawing files are retired. `npm ci` installs no Pixi
package in the root dependency tree. Version remains `2.0.0-dev`.

## Run and build

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Open the URL printed by Vite. No engine parameter is needed. Old `engine=phaser`
and `engine=pixi` links both run Phaser. WebGL/Canvas, procedural graphics, sound,
controls, scene flow, seasonal dates, calibration and review galleries retain the
accepted candidate's behavior. `build:phaser` and `preview:phaser` remain compatible
aliases for the standard commands, including argument forwarding; both use `dist/`.

The normal production config enforces a Phaser-only module graph and emits
`engine-build.json`. Its 71 modules contain zero Pixi/reference modules. The
GitHub Pages workflow still builds and publishes `dist/` at its existing target;
its relative asset paths and subdirectory hosting are preserved. This work is on
the review branch; no deployment was performed by this task.

## Preservation

All 40 Phaser source files and the 24 shared original logic/service files have
unchanged hashes. No rendering, physics, scoring, input semantics, audio recipes,
fixed-step timing, interpolation, particle limits or accepted performance fixes
change in this milestone.

All six generated production files, including HTML, entry/main bundles, manifest
and public images, are byte-for-byte identical to the pre-cutover Phaser candidate
built from `208f3d5`. The immutable control was captured before retiring files or
changing dependencies. The normal artifact therefore adopts the already accepted
candidate rather than introducing a new renderer implementation.

The 24 retired Pixi files are preserved unchanged in
[the optional reference package](../../references/pixi/README.md), alongside an
explicit path/hash manifest and a separate lockfile containing Pixi 8.21.0 and
its exact pre-cutover dependency versions. Shared source stays canonical, avoiding
duplicate simulation/layout/audio modules. The frozen baseline captures, test
identities and original test files remain unchanged. Preservation validation checks
all 48 original source hashes across the active and archived locations; shared
files cannot silently fall back to an archived copy.

Normal development, tests, production builds and deployment do not install or load
that reference package. It has a separate comparison-server config. Browser-injected
legacy module URLs re-export the canonical archived module, keeping input state
and listeners single-instance. All original archived game files retain their bytes.

## Final validation

The [validation summary](validation.json) records artifact/source fingerprints,
executed test preservation and limitations. Under Node 22.23.3:

- A clean root `npm ci`, lint, all **460 tests** in 32 files, the standard build,
  `build:phaser` alias and ten-round simulator pass. Every original executed test
  name and passing status matches the original **271 identities in 30 unchanged
  files**. Root installation has no Pixi package; retained lockfile records are
  unchanged and eleven Pixi-only dependency records are removed.
- [Production checks](production.json) pass six default/deprecated-selector routing
  cases at root and `/martian-vs-martian/`, eight complete scene/input cases across
  WebGL/Canvas and DPR 1/2, and 80 completed-match ownership cycles. Settings,
  pause/restart/exit, solo/two-player flow, sudden death, results/tallies, resize,
  controller mocks and disposal retain their behavior.
- Twelve independently seeded production comparisons have zero RGB difference
  against the captured pre-cutover candidate: three actual gameplay poses for
  WebGL/Canvas and DPR 1/2. Comparison thresholds are unchanged. CI can run the
  production flow/routing checks without that optional external control; it then
  records no pixel-control cases rather than claiming an independent comparison.
- [Four archived-Pixi/Phaser play traces](scene-logic.json) match round state and
  every fixed step's ordered events over 2,400 frames and 4,760 fixed steps.
- [Forty-one reference artwork cases](artwork.json) pass unchanged recipe/pose,
  color/edge and strict missing-silhouette policies, using the optional reference
  server and normal Phaser dev server. This is the selected normal-date, DPR 1
  regression set, not another full seasonal/browser sweep.
- An [actual negative-control build](negative-control.json) importing the optional
  Pixi API is rejected by the production module-graph guard. This is an expected
  failure, separate from passing production checks.
- Actual dev and `preview:phaser` pages route to Phaser without a selector and with
  a legacy Pixi selector. The updated developer benchmark rejects a missing
  `pixi-url` and completes one-second samples with optional reference Pixi and
  production Phaser. Its [smoke report](benchmark-smoke.json) establishes wiring,
  not a new performance measurement or acceptance result.

The initial archived-reference replay exposed duplicate input state through a
browser-injected old URL after moving source files. The reference-server re-export
fix resolves that defect; the final unchanged-assertion traces pass. Failed
intermediate runs were not used as passing evidence.

## Acceptance and remaining follow-ups

The user accepted smooth ordinary/busy Safari gameplay on the M1 MacBook Air,
normal sound, and two-controller gameplay/rumble. The accepted performance budget
retains approximately 60 fps in ordinary play and p95 frame work below 16.7 ms;
the original proposed 10% relative CPU allowance is waived with a documented
exception. The approximately 1 ms p95 overhead, rare 576 ms callback gap and
245 ms renderer-submission stall remain unresolved follow-ups. This milestone
claims neither CPU parity nor elimination of every benchmark stall.

Browser compatibility, controller edge cases and keyboard combinations are
advisory by user decision. The Chromium/Firefox/WebKit CI matrix continues to run
with visible reports and job-level `continue-on-error`; core lint/test/build checks
remain required. Local production checks use Chromium 154/ANGLE SwiftShader.
Firefox/WebKit are not installed here, previous browser downloads were blocked,
and GitHub API access to current CI results returned `Forbidden`; their results
are not claimed by this local evidence. No new physical-device test or long soak
ran for this cutover. Earlier manual acceptance and soak evidence retain their
recorded scope; the shipped bytes are identical to the accepted Phaser candidate.
