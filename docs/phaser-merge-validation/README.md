# Phaser merge validation

Validation of the reconciled `phaser` branch completed on October 13, 2026.
The input commit is `ce680f9`; `master` through `cd89ae1` is already an ancestor.
The version remains `2.0.0-dev`, with Phaser 4.2.1 and no root Pixi dependency.
This update changes documentation, changelog and validation records only. The
application, original tests, atlas assets, manifest and lockfile retain their bytes.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Clean root installation | `npm ci` passes under Node 22.23.3 | [Summary](summary.json) |
| Tests | 467 tests in 33 files pass, retaining the original 271 identities and all 48 original source hashes | [Test log](test.log), preservation records in the browser reports |
| Lint and build | ESLint/Prettier and production build pass; the existing non-fatal chunk-size warning remains | [Lint log](lint.log), [build log](build.log) |
| Simulator | Ten bot rounds pass with the unchanged game logic | [Simulator log](sim.log) |
| Production hosting and scenes | Six root/Pages-subdirectory routing cases, eight renderer/DPR flow cases and 80 completed-match ownership cycles pass | [production.json](production.json) |
| Artwork and settings | 28 gallery cases, 12 seasonal cases and 25 paused style switches per renderer pass; the saved preference survives reload | [sprites.json](sprites.json) |
| Production resources | WebGL/Canvas at DPR 1/2 pass cache sharing, independent repaint/tint/alpha and scoped cleanup; real WebGL loss/recovery restores artwork without changing resource counts | [resources.json](resources.json) |
| GitHub Actions input commit | Required `check` and Chromium/Firefox/WebKit production jobs succeed for `ce680f9` | [CI record](ci.json), [run](https://github.com/skogdoom/martian-vs-martian/actions/runs/38386189362) |

The resource probes use the compiled production host's public presentation scope
and DOM input. They import no alternate renderer or presentation implementation.
Production reports retain build-artifact and runtime-source hashes. Resource
restoration compares rendered pixels before/after actual context loss and checks
the full ownership snapshot. The original test files and frozen references are
unchanged. Lint also checks the final formatted documentation evidence files.

GitHub's API returned `Forbidden`; the publicly accessible Actions run and job
pages supplied the successful statuses, including each browser's production
step. The documentation commit triggers a separate CI run. Browser jobs remain
advisory; their success verifies the configured production suite, not complete
cross-browser artwork, audio or physical-device parity.

## Acceptance and follow-ups

The [production playtest](../phaser-playtest/README.md) records the user's smooth
M1 Safari confirmation for cartoon/classic ordinary and busy play, including
paused switching. Earlier listening and two-controller/rumble acceptances remain
valid. Broader browser fullscreen/audio checks, controller reconnects and keyboard
combinations remain advisory. The accepted CPU exception and rare benchmark
stalls remain documented follow-ups; this run makes no CPU-parity or zero-stall
claim. Physical-device timing is established by its recorded scope rather than
Chromium/SwiftShader measurements.

These browser/audio, controller reconnect, keyboard-combination and rare-stall
follow-ups are now scheduled for review
[before the next non-dev release](../../PLAN.md#before-the-next-non-dev-release).
They remain advisory for the merge and development builds.

The migration's required local validation is complete. Merging into `master` and
publishing remain separate actions; a push to `master` runs the Pages workflow.
`CHANGELOG.md` keeps the 1.0.0/1.1.0 release history and records the Phaser/cartoon
changes under **Unreleased**, without tagging a 2.0 release.

## Repeat the repository checks

```sh
npm ci
npm test
npm run lint
npm run build
npm run sim -- 10
python scripts/phaser/check_production.py --browser-executable /usr/bin/chromium --software-gpu
npm run preview -- --host 127.0.0.1 --port 5202 --strictPort
python scripts/phaser/check_sprites.py --base-url http://127.0.0.1:5202/
```

The first Python command serves its own immutable production copy at both root
and subdirectory paths. Keep the preview running in another terminal for the
sprite checks. These commands require the repository's documented Python/browser
dependencies. The saved resource report additionally records the compiled-host
cache and context-loss probes described above.
