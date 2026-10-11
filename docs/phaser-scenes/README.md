# Milestone 4: complete scene flow and input integration

`?engine=phaser` now runs the complete game: title, settings, countdown, play,
pause menu, round results, sudden death, and tally. The default URL remains Pixi
until milestone 7. Version remains `2.0.0-dev`.

## Review locally

Run `npm ci` and `npm run dev`, then open the printed URL with `?engine=phaser`.
Dismiss the startup overlay and use the original controls. Select one/two players,
CPU difficulty, round duration, and best-of count from the title menu. P/Esc opens
the pause menu; restart and exit are menu items. Settings and pause both offer sound,
fullscreen, and 16:9. F and double-click also toggle fullscreen. Add
`&renderer=canvas` to review the Canvas fallback or `&date=2026-12-24` for seasonal art.

The earlier previews remain available as `&gallery=calibration`, `primitives`,
and `artwork`; calibration retains its R/T/V test controls.

## Implementation

The five factories in `src/phaser/scenes/` keep the original scene orchestration,
cooldowns, bots, announcements, statistics, per-mode tallies, and sound/event calls.
They construct the milestone 3 artwork through a presentation scope. No Phaser
physics, keyboard, gamepad, or sound manager is enabled. The original simulation,
options/session helpers, audio synthesizer, Pixi graphics/scenes, and tests are intact.

Logical scene disposal removes subscriptions and stops voices. View destruction
releases owned textures. On round completion, the result explicitly adopts the final
playfield's native root; the host destroys an old tree only if it was not adopted.
The result never advances the frozen world or effects. Its layout callback refits
the HUD on resize without rerunning animation or drawing new world poses. Leaving
the result destroys both trees.

Phaser-owned input/fullscreen modules retain the original DOM handlers and public
API, share the unchanged pure `createPadPoller`, and add explicit startup/disposal
hooks. They preserve physical key codes, repeat filtering, pressed/held state,
blur behavior, cheat swallowing, solo key merging, dead zone, stable pad slots,
permission fallback, and rumble routing. Scene menus unregister their keyboard
subscriptions on disposal; title cheat and play fullscreen subscriptions are removed
when their logical scene ends. Host shutdown removes its page service handlers;
Game destruction/HMR handles Phaser's own observers.

Fullscreen selection runs in its originating keyboard event and is consumed once
by the fixed-step menu. Pending direction edges select the same row as the menu
update. Controller confirmation may leave fullscreen but cannot enter it through
activation left over from a keyboard/pointer gesture. Controller polling never
unlocks audio. Existing synthesized sounds remain; listening acceptance is milestone 5.

## Automated verification

`validation.json` records the completed checks and source fingerprints:

- All 460 tests pass in 32 files, including every original test identity in the
  unchanged 30 files (271 original tests). Lint, production build, and the ten-round
  simulator pass. Frozen Pixi artifacts and the original 48 source hashes are intact.
- Chromium WebGL/Canvas at DPR 1/2 completes settings, cheats, solo/two-player matches,
  pause/resume, restart, exit, tied match extension, sudden death, results, tally,
  and play-again retention. Full-duration matches use the shipped fixed-step host;
  controlled final-score poses make tied and decisive outcomes reproducible.
- Keyboard checks cover a tap between steps, held versus pressed state, repeat,
  physical codes, default prevention, blur, solo merging, and one shot in a frame
  with several simulation steps. Controller checks exercise two slots, dead zone,
  disconnect/reconnect, start/pause/resume edges, rumble routing, permission failure,
  fullscreen restrictions, and no audio-context creation from controller-only input.
- Real Chromium keyboard/pointer gestures enter fullscreen through F, menu selection,
  and double-click. Menu selection executes once; unexpected fullscreen exit pauses.
- Twenty repeated play/result/tally/title cycles in each renderer retain constant
  object, texture, GPU-wrapper, input-subscription, and fullscreen-subscription counts.
  Shortened rounds are used only for these lifecycle fixtures. Disposal is idempotent
  and removes keyboard/fullscreen handlers and all owned paint textures.
- Production root and `/martian-vs-martian/` URLs each pass the full scene flow,
  keyboard/controller/fullscreen checks, disposal, and two lifecycle cycles in WebGL
  DPR 1. Development covers both renderers and both pixel densities.
- The real unchanged Pixi play scenes and native Phaser play scenes produce identical
  round state and ordered events for four keyboard traces: two-player plus each CPU
  difficulty. Each trace covers 600 mixed-rate frames and 1,190 fixed steps, including
  multi-step and zero-step frames (2,400 frames / 4,760 steps total).
- Host regressions pass 60 layout cases at DPR 1/2/capped 3 and both renderers.
  Artwork preview controls pass all four renderer/DPR combinations.
- Native scene recovery returns to title, destroys the old playfield, removes its
  subscriptions, and clears pending input. An expired error window resets; four
  errors within five seconds halt the loop. This passes in all four renderer/DPR
  combinations. The harness controls the recovery clock independently of cloud
  software-GPU construction time.

Reproduce with a Vite server running:

```sh
python -m pip install -r scripts/phaser/requirements.txt
python scripts/phaser/check_scenes.py --base-url http://127.0.0.1:5173/
python scripts/phaser/check_scenes.py --base-url http://127.0.0.1:5173/ --recovery-only
python scripts/phaser/check_scene_logic.py --base-url http://127.0.0.1:5173/
python scripts/phaser/check_host.py --base-url http://127.0.0.1:5173/
python scripts/phaser/check_artwork.py --base-url http://127.0.0.1:5173/ --controls-only
```

For production, run `npm run build` and serve `dist/`, then run `check_scenes.py`
against the production URL with `--quick --cycles 2`. Serve it under a subdirectory
and repeat. Reports and images go to temporary directories; frozen references are
never overwritten. Scene tests batch redundant GPU uploads between captures while
retaining real Canvas drawing, scene rendering, and every fixed-step update. Saved
images are drawn normally from final sources. These are correctness and ownership
checks, not frame-rate measurements.

## Manual review still required

Cloud controllers use `navigator.getGamepads` fixtures; physical two-controller and
rumble acceptance cannot be established here. During review, connect two standard
controllers, verify independent movement/shooting, Start pause/resume and menu
navigation, unplug/reconnect one while the other retains its side, and check rumble
on supported hardware. Confirm controller-only startup leaves the sound hint until
a keyboard or pointer gesture. A controller may leave fullscreen but cannot enter it.

Firefox/WebKit and real Safari fullscreen/Keyboard Lock behavior remain unverified
under the existing cloud browser limitation. Audio listening is milestone 5;
physical-GPU performance and long play soaks are milestone 6. Work stops before
milestone 5 for review.
