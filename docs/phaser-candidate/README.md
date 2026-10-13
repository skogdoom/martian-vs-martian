# Milestone 7 preparation: Phaser-only review artifact

> Historical migration evidence: the instructions, test counts, runtime defaults
> and pending checks below describe this milestone at its recorded commit.
> The current game uses Phaser with cartoon/classic graphics; see the
> [current README](../../README.md), [playtest](../phaser-playtest/README.md)
> and [merge validation](../phaser-merge-validation/README.md).

The subsequent [final cutover](../phaser-cutover/README.md) makes Phaser the normal
runtime. The initial preparation evidence and instructions below describe the
retained-comparison stage; use the final notes for current commands and optional
Pixi reference setup.

The user chose to keep Pixi available until acceptance passes. This implements the
review build and automated cutover checks while retaining Pixi as the normal
runtime. Final cutover and Pixi removal are deferred. The original game entry,
logic, drawing code, inputs, audio, dependency versions and lockfile are unchanged.

## Build and play

```sh
npm ci
npm run build:phaser
npm run preview:phaser
```

Open the preview URL printed by Vite. It runs Phaser without an engine parameter;
`?engine=pixi` also runs Phaser in this candidate. Existing renderer/gallery/date
parameters still work. This is a local review artifact, with normal controls and
sound, not a deployment.

`npm run build:phaser` writes **dist-phaser/**. Its entry is replaced at build time
with the same awaited Phaser import used by the existing selector. A build plugin
rejects Pixi runtime modules and emits `engine-build.json` from the actual output
module graph. No source copies, compatibility shims or alternate game rules are
introduced. The checked candidate graph contains 71 modules and zero Pixi modules.
The usual Vite large-chunk warning remains; this is not a bundle-size optimization.

`npm run dev`, `npm run build` and `npm run preview` continue to use the existing
Pixi-default selector, with `?engine=phaser` available for comparison. Normal builds
still write **dist/**. The GitHub Pages workflow still builds/deploys dist/, so
building the candidate does not change the published game or select it for Pages.
Both dependency packages remain installed while this comparison workflow is needed.

## Checks and evidence

The archived preparation checks below describe commit `443a163`. The later
[native flag follow-up](../phaser-flags/README.md) changes rendering and includes
refreshed candidate checks. The subsequent Safari playtest and sound acceptance
are recorded in the current table below.

A clean `npm ci`, lint, all **460 tests**, both production builds and the ten-round
simulator pass under **Node 22.23.3**. All 271 original executed test identities in
30 test files remain unchanged, as do all 48 original game-source hashes.
All Phaser game-source hashes also match the preceding shader-warmup commit;
only build, validation and review tooling change.

The standalone [candidate runner](../../scripts/phaser/check_candidate.py) serves
immutable production files. Chromium 154/ANGLE SwiftShader checks:

- Six routing cases verify normal Pixi default, normal selected Phaser, and the
  Phaser-only candidate with no selector and with `engine=pixi`, at root and
  `/martian-vs-martian/`. Every page has one canvas and loads production resources
  from its corresponding base path.
- Twelve independently seeded pixel comparisons have zero RGB difference between
  the normal selected-Phaser build and the candidate: three real gameplay poses
  in WebGL/Canvas at DPR 1/2. These are unchanged comparison thresholds, not new
  images declared correct by a candidate-only test.
- Eight full scene/input cases cover both renderer choices and DPRs at each URL.
  They exercise settings/persistence, physical key codes, edge/held semantics,
  pause/restart/exit, solo/two-player matches, sudden death, frozen results,
  resizing and tally retention. Separate mocked-controller checks cover two
  slots, reconnect, dead zone, rumble dispatch and fullscreen/activation policy.
- Ten completed-match ownership cycles per case (80 total) retain stable object,
  texture, program, VAO and listener counts; disposal drains the host resources.
- The normal comparison artifact is rejected as a Phaser-only candidate because
  it lacks the required module-graph manifest. The build also rejects inclusion
  of legacy runtime modules. Actual default-page execution checks the manifest's
  engine claim against the loaded runtime.

The ownership loops use the existing shortened-duration lifecycle fixture. They
are not timed soaks; no additional 30-minute soak ran for this candidate. Earlier
soak evidence remains tied to its recorded source fingerprints.

See [the completed browser report](chromium.json), [candidate module graph](engine-build.json)
and [validation summary](validation.json). The preview command was also started
and checked through its actual default page. The browser benchmark can load the
production candidate from that preview, alongside Pixi from the development
server. Its saved [one-second smoke](benchmark-smoke.json) verifies wiring only;
it is **not** a performance comparison or an acceptance result.

For reproduction, build both artifacts first and use the pinned Python browser
requirements from `scripts/phaser/requirements.txt`:

```sh
npm run build
npm run build:phaser
python scripts/phaser/check_candidate.py \
  --browser-executable /usr/bin/chromium --software-gpu \
  --output /tmp/phaser-candidate-checks
```

Omit `--browser-executable` to use an installed Playwright browser. Select
`--browser-engine firefox` or `--browser-engine webkit` for the other engines.
The runner requires eight scene cases, twelve pixel comparisons and six routing
cases before marking the report complete; failures exit nonzero and preserve a
partial report. Auto-renderer results record whether WebGL was actually available;
auto Canvas fallback is not described as a successful WebGL test.

## Browser CI and open acceptance

CI now runs on `phaser` pushes as well as master/PRs. Node 22 builds both artifacts.
A Playwright matrix installs Chromium, Firefox and WebKit and runs the candidate
checks, retaining reports and images as job artifacts. The user has made browser
compatibility advisory rather than a cutover gate. The browser job now uses
job-level `continue-on-error`: failed checks remain failures in their logs/reports,
but do not fail the overall workflow. The core lint/test/build job remains required.
Assertions and required case counts remain enforced; zero-case runs do not pass.

Firefox 153 and WebKit 26.5 downloads were attempted here and rejected with
HTTP 403 **Domain forbidden** from the official Playwright download hosts. Those
browsers did not execute in this cloud runner. The CI matrix is configured, but
its remote results are not claimed by the saved local report. This runner covers
production flow/input and within-engine pixel stability; it does not replace the
full cross-browser artwork/audio checks or physical acceptance. The latest saved
Chromium candidate report still matches all current game-source hashes. Firefox
and WebKit are not installed here; a current attempt to retrieve GitHub Actions
results returned `Forbidden`, so their CI outcomes remain unverified here.

The pre-cutover acceptance items are resolved. The [final cutover](../phaser-cutover/README.md)
and its core validation are now implemented on the review branch:

| Gate | Evidence and remaining checks | Status |
| --- | --- | --- |
| M1 MacBook Air performance | The user accepted the budget review below: approximately 60 fps in ordinary play, p95 frame work below 16.7 ms, and smooth ordinary/busy gameplay. The 10% relative CPU allowance is waived with a documented exception; isolated benchmark stalls and matched production comparisons remain follow-ups. rAF is callback timing, not physical scanout. | Passed under the user-accepted budget and exceptions |
| Audible sound | The user confirmed that sounds seem OK during play. Automated signal/lifecycle checks remain available; broader browser and audio edge-case checks are recommended. | Passed: user listening acceptance |
| Physical controls | The user confirmed successful gameplay with two physical controllers and working rumble. | Passed: two-controller gameplay and rumble |
| Controller edge cases and keyboard combinations | Disconnect/reconnect and intended keyboard combinations remain unconfirmed; keep them as recommended follow-up checks. Existing automated regression assertions remain intact. | Advisory; not a cutover gate, by user decision |
| Browser compatibility | Chromium automation and the user's Safari playtest provide coverage. Review Firefox/WebKit CI results, browser fullscreen/activation behavior and broader browser artwork/audio checks when available; a Chrome comparison is also useful. Unverified checks remain documented. | Recommended; not a cutover gate, by user decision |
| Final production cutover | Switch the normal entry and remove Pixi code/dependency. Keep regression references needed for future checks and run the final core validation. | Implemented and validated; ready for review |

## Accepted performance budget review

The user accepted this proposal. The performance gate is closed under the criteria
and documented exceptions below; this accepts the M1 experience without claiming
CPU parity or elimination of every benchmark stall.

The current M1 performance is accepted with a documented exception to the original
10% CPU comparison allowance. The budget retains approximately 60 fps in ordinary play, p95
frame work below 16.7 ms, and smooth ordinary/busy gameplay as the practical
acceptance criteria. The latest report averages 59.93 fps ordinary and 59.55 fps
combined, with median p95 CPU of 4/6 ms and p99 of 5/8 ms. The user has confirmed
that both ordinary movement and busy moments now feel smooth.

Phaser still uses about 1 ms more p95 frame work than Pixi. That difference is
documented; it is not evidence of CPU parity. The current comparison uses
development Pixi versus production Phaser, with CPU timing quantized around 1 ms
and differing combined-play event histories. Those limits make a strict 10%
relative cutoff a poor release criterion for these reports. A matched production
comparison would strengthen future measurements, but is now a follow-up rather
than a requirement for cutover.

Keep the 576 ms callback gap and 245 ms renderer-submission stall as unresolved
performance follow-ups. Their cause is unknown, and averages/percentiles do not
erase them. Investigate if a visible or repeatable slowdown recurs, without
claiming that every stall has been eliminated. Core tests, build checks, preserved
graphics and lifecycle validation remain required.

## Compare the candidate on the M1

These are the historical pre-cutover comparison instructions. For the current
optional-reference comparison, use [the reference package guide](../../references/pixi/README.md).

Keep the candidate preview running and start `npm run dev` in another terminal.
Open the development server's benchmark with the candidate preview base URL:

```text
/scripts/phaser/benchmark.html?profiles=ordinary,combined&seconds=60&repeats=3&phaser-url=http://localhost:4173/
```

Use the actual preview port and a base URL ending in `/`. The runner verifies the
candidate manifest and loads its production assets for Phaser; Pixi uses the dev
server. Save the JSON with the tab visible. This is useful for a local review, but
it compares development Pixi with production Phaser and must be labeled that way.
A formal parity budget needs equivalent production builds and matching settings;
the Python production runner can use each immutable build separately with a frozen
fixture server, as documented in the preceding performance notes.

Normal play uses sound; only the graphics benchmark disables it. Continue the
ordinary/busy-play visual retest alongside timing data before accepting cutover.
