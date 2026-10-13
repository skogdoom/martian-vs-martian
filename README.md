# Martian vs Martian

A two-player couch game for the browser. Two flying saucers share one keyboard
and race to abduct cows and lambs into their own pen. Shoot, ram and steal
from each other; grab power-ups dropped by little green men. Rounds of
60, 90 or 120 seconds, best of 1, 3, 5 or 7 (ties go to sudden death).
There is also a single-player mode against the CPU.

**[Play it here](https://skogdoom.github.io/martian-vs-martian/)**

## Controls

|            | Red          | Blue           |
| ---------- | ------------ | -------------- |
| Move       | W A S D      | Arrow keys     |
| Shoot      | Space        | Enter          |

Game controllers work too: the first one flies Red and the second Blue
(stick or d-pad to move, A or a trigger to shoot, Start to begin or pause).
Browsers only allow sound after a key press or click, so with a controller
only, press any key or click the page once to switch the sound on.

Shooting while carrying an animal drops it. Hover low and still over an animal
to beam it up. **P** or **Esc** pauses and opens a menu (resume, restart, sound, full screen,
16:9, classic graphics, exit to the main menu); the same settings are on the title screen under
Settings. **M** toggles sound and **F** toggles full screen. In
single-player you fly Red with either set of keys.

Two players on one keyboard need a keyboard that registers several keys at
once. Cheap keyboards can ghost (drop a key press when many are held), which
is a hardware limit; if a key seems dead, try another key combination or a
game controller. A keyboard or controller is required: it doesn't work with
touch alone.

## Running it

Requires Node.js 20.19+ or 22.12+; validation and CI use Node 22.

```sh
npm ci
npm run dev      # start a dev server, then open the printed URL
npm run build    # production build in dist/
npm run preview  # serve that production build
npm test         # unit tests
npm run sim      # simulate bot matches and print balance stats
```

Built with [Phaser](https://phaser.io/) and [Vite](https://vite.dev/). Cartoon
graphics use sprite atlases inspired by the supplied concept art. Turn
**Classic graphics: ON** in Settings or the pause menu to use the original
procedural artwork; the choice is saved between visits. All sounds are synthesized.
`PLAN.md` has the full rules and design notes, and the
[sprite review notes](docs/phaser-sprites/README.md) describe the artwork and validation.

### Rendering and review tools

Phaser is the default in development and production. Open the URL printed by
`npm run dev` or `npm run preview`; no engine parameter is needed. Old
`?engine=phaser` and `?engine=pixi` links both run Phaser. `npm run build:phaser`
and `npm run preview:phaser` remain aliases for the normal commands and use `dist/`.
The production build enforces a Phaser-only module graph in `engine-build.json`.

Automatic WebGL and Canvas fallback remain available; add `?renderer=canvas` to
check Canvas explicitly. The render-only galleries remain available at
`?gallery=primitives` and `?gallery=artwork`. Dismiss the startup overlay. In the
artwork gallery, left/right changes pages, P freezes, R restarts and V toggles
16:9. Add `&date=2026-12-24` or another special date for seasonal scenery.
The earlier calibration round remains at `?gallery=calibration`.

For artwork review, `?graphics=cartoon` and `?graphics=classic` select a style
for that visit without changing the saved choice. The artwork gallery retains
the classic audit by default; add `&graphics=cartoon` to review the new sprites.

The [migration plan](PHASER_MIGRATION.md) and [final cutover notes](docs/phaser-cutover/README.md)
record preservation checks, the accepted M1 performance budget and unresolved
benchmark outliers. Sound, smooth Safari gameplay and two-controller/rumble
playtests passed. Browser compatibility, controller edge cases and keyboard
combinations remain advisory.
The [production playtest](docs/phaser-playtest/README.md) records smooth M1 Safari
play in both graphics styles. The [merge validation](docs/phaser-merge-validation/README.md)
records the clean-install, regression, production-hosting and resource checks
after reconciling `master`, while retaining version `2.0.0-dev`.

Pixi is absent from the root dependency tree and the shipped game. Original Pixi
source and comparison tools are retained in an [optional reference package](references/pixi/README.md).
Its dependencies are installed separately when running historical comparisons;
normal development, tests, builds and deployment do not need that installation.
The original test suite and frozen references remain available for regression work.

## About this project

This project is mostly vibe coded: most of the code was written by an AI
coding assistant from short feature requests, with playtesting and
simulation rather than careful line-by-line review. It is a hobby project.
Use it at your own risk.

## License

Released under the MIT License. Copyright (c) 2026 David Andréasson. See
[LICENSE](LICENSE) for the full text.
