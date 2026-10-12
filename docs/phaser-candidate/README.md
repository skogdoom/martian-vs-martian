# Milestone 7 preparation: Phaser-only review artifact

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
refreshed candidate checks; its physical Safari retest remains pending.

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
checks, retaining reports and images as job artifacts. Jobs fail when checks fail;
there is no continue-on-error or passing zero-case fallback.

Firefox 153 and WebKit 26.5 downloads were attempted here and rejected with
HTTP 403 **Domain forbidden** from the official Playwright download hosts. Those
browsers did not execute in this cloud runner. The CI matrix is configured, but
its remote results are not claimed by the saved local report. This runner covers
production flow/input and within-engine pixel stability; it does not replace the
full cross-browser artwork/audio and physical acceptance gates.

The cutover remains deferred until these items are reviewed:

| Gate | Evidence and remaining checks | Status |
| --- | --- | --- |
| M1 MacBook Air performance | The user confirmed that ordinary and busy Safari gameplay now feel smooth. The [Safari retest](../phaser-flags/README.md#latest-m1-safari-retest) removes recurring uploads and reduces long frames; isolated benchmark stalls and higher typical CPU cost remain for quantitative budget review. Matched production measurements and Chrome comparison remain open against the plan's 60 fps / 16.7 ms p95 / 10% regression targets. rAF is callback timing, not physical scanout. | Partially passed: manual Safari gameplay smoothness passed |
| Audible sound | Human listening for overlapping shots/effects, sustained lift/laser voices, unlock, mute, pause and tab return in supported browsers. | Open |
| Physical controls | The user confirmed successful gameplay with two physical controllers and working rumble. Reconnect, Safari fullscreen behavior and intended keyboard combinations still need confirmation. | Partially passed: two-controller gameplay and rumble passed |
| Browser compatibility | Review Firefox/WebKit CI results and complete supported-browser artwork/audio checks and manual Safari checks. | Open |
| Final production cutover | Switch the normal entry and remove Pixi code/dependency after earlier gates pass. Keep regression references needed for future checks. | Deferred by user decision |

## Compare the candidate on the M1

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
