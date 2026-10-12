# Milestone 5: synthesized audio validation

The complete Phaser game keeps the original `src/audio.js` page service and all
34 sound recipes. Milestone 4 already connected the host and play scenes to that
service; this milestone adds reproducible browser verification and listening
artifacts. No runtime, simulation, graphics, dependency, or original test file
changed. The default entry remains Pixi and the version remains `2.0.0-dev`.

## Review locally

Run `npm ci` and `npm run dev`, then open the printed URL with `?engine=phaser`.
Use headphones to check Red/Blue shot direction, animal delivery, golden payouts,
countdown/result sounds, and interrupted lifts. Type `idkfa` on the title screen to
try both sustained lasers; hold the two shoot keys together and release them.
P/Esc pauses sound and opens the menu; Enter resumes. Check M and the sound menu,
restart, exit, and tab return. Repeat in the default Pixi game in a separate page.

The independently captured event sequences have offline listening samples:

- [Pixi event sample](pixi-events.wav)
- [Phaser event sample](phaser-events.wav)

Both are 12-second stereo WAV files at 48 kHz, rendered from the unchanged recipes
using real Chromium OfflineAudioContext. They use deterministic noise, the original
0.55 master gain, stereo pan, and one shared compressor (threshold −14, ratio 4).
They reproduce the event calls captured from each engine's page service; they are
review artifacts rather than recordings from physical speakers. The game continues
to synthesize sounds at runtime and loads no WAV assets.

| Time (seconds) | Event |
| --- | --- |
| 0.1 / 0.6 | Countdown / GO |
| 1.0 / 1.4 | Red left / Blue right shots |
| 1.8 / 2.4 | Cow lift / interrupted lift |
| 3.0 / 3.7 | Both lasers start / stop |
| 4.3 | Nine simultaneous bursts, limited to three starts |
| 5.0 / 6.0 | Normal delivery / golden delivery |
| 8.5 | Round-end cleanup and result jingle |

## Automated checks

`validation.json` records the complete browser report, source and artifact hashes,
and required repository checks.

- Each engine passes 62 independent event/branch expectations. These include both
  shot sides and triple shots, hook kinds, ordered lift/laser interruptions,
  shielded hits, stolen/golden delivery, urgent ticks, countdown/GO, overlapping
  sustained voices, and round-end cleanup. Unknown sounds/events stay silent.
- Each engine passes 43 OfflineAudioContext cases covering all 34 recipes plus
  side, urgency, full/stolen, explosion size, GO, early interruption, stereo, and
  mute variants. Checks measure nonzero finite output, attack and tail timing,
  amplitude, RMS, zero crossings, interruption duration, and opposite pan energy.
- Captured event calls and voice start/stop order match exactly. Offline comparisons
  allow at most `0.000002` absolute float-sample error and `0.00000001` RMS error,
  accounting for native floating-point rounding. Noise is seeded only in the
  fixture. Raw float hashes are retained; byte equality is not claimed.
- Two traces run the real Pixi and Phaser play scenes through mixed 30/60/120/144 Hz
  and multi-step frames: ordinary guns and dual lasers. Round state, every step's
  ordered events, and actual recipe/voice calls match. Independent checks count
  countdown, GO, shots, and laser starts across intermediate steps, so matching
  engine traces alone cannot conceal duplicated or lost calls.
- Playback retains the original limits of three identical starts in 0.08 seconds
  and 24 total starts in 0.25 seconds; expiry and a reset audio clock are checked.
  All three original throttle tests remain unchanged.
- A genuinely untrusted browser attempt creates a suspended context with no user
  activation. The 500 ms construction grace prevents immediate replacement. A real
  key press closes that old context and starts one replacement. This fixture runs
  before any Playwright evaluation, which would otherwise grant DevTools activation.
- Controller-only play, pause and sound-menu toggles create no context even with
  residual DevTools activation. The sound hint remains until a pointer gesture.
  Missing Web Audio APIs leave the game playable. A visibility notification resumes
  a suspended context; physical tab/device interruptions remain in manual review.
- Development WebGL and Canvas and production root/subdirectory hosts each complete
  six play/pause/mute/resume/exit cycles on one context. Real keys cannot wake or
  replace a paused context. Mute uses the existing 20 ms gain smoothing. Restart,
  round end, error recovery, and active host disposal stop laser carriers and retain
  the page context. The round-end fixture shortens only the final test round.
- Native source `ended` events and scheduled-stop checks verify drainage after cleanup.
  Chromium can collect a source wrapper before delivering its `ended` callback;
  the observer counts it as finished only after its scheduled stop has passed and
  its weak reference is gone. Collection alone cannot pass an unscheduled carrier.
  Both completion counts are recorded. Laser
  carrier oscillators stop promptly, while their existing silent modulation nodes
  retain their scheduled 30-second lifetime. Weak references and forced collection
  measure remaining JavaScript node wrappers after this tail; these do not measure
  browser-native memory. Phaser's sound manager has no context or sounds.
- All 460 tests in 32 files, lint, production build, and the ten-round simulator pass.
  Original 271 test identities, all 30 original test files, 48 original source hashes,
  and frozen Pixi artifacts remain intact.

Reproduce with a Vite server and optionally a server for the production build:

```sh
python -m pip install -r scripts/phaser/requirements.txt
python scripts/phaser/check_audio.py --base-url http://127.0.0.1:5173/
```

After `npm run build`, serve `dist/` at root and a subdirectory, then include those
URLs to run the same lifecycle checks against built code:

```sh
python scripts/phaser/check_audio.py \
  --base-url http://127.0.0.1:5173/ \
  --phaser-url http://127.0.0.1:5175/ \
  --phaser-url http://127.0.0.1:5175/martian-vs-martian/
```

The script uses installed Chromium and the existing Playwright dependencies.
Reports, raw PCM and WAV files go to a new temporary directory unless `--output`
is provided. Frozen references cannot be overwritten. Native source drainage can
require roughly 30 seconds after the last laser start. Scene trace tests control
the audio clock to make throttling deterministic; lifecycle/unlock checks use real
context time and state. Instrumentation is loaded only by the harness.

## Manual acceptance and recommended follow-ups

The user subsequently confirmed that sounds seem OK during play. **Manual sound
acceptance has passed.** Cloud automation establishes signals and lifecycle
behavior; the listening checklist remains useful for broader verification.
Listen for retained timbre, clean sustained-voice
interruptions, overlapping bursts, mute/pause transitions, and tab/device return.
Check controller-only startup in a fresh browser session with no prior gesture,
then unlock with a key or click. Check Safari's interrupted-context recovery and
Firefox/WebKit behavior; those browsers remain unverified under the existing cloud
limitation. Browser compatibility is now recommended rather than a cutover gate,
by user decision. Two-controller gameplay and rumble have also passed the user's
manual playtest. Further controller edge cases and keyboard combinations remain
unconfirmed, but are advisory rather than cutover gates by user decision.

The automated evidence above describes milestone 5. Subsequent performance,
lifecycle and candidate work is recorded in the [migration plan](../../PHASER_MIGRATION.md)
and [current acceptance table](../phaser-candidate/README.md). Pixi remains the
default pending cutover; browser compatibility no longer blocks that step.
