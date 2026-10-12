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
16:9, exit to the main menu); the same settings are on the title screen under
Settings. **M** toggles sound and **F** toggles full screen. In
single-player you fly Red with either set of keys.

Two players on one keyboard need a keyboard that registers several keys at
once. Cheap keyboards can ghost (drop a key press when many are held), which
is a hardware limit; if a key seems dead, try another key combination or a
game controller. A keyboard or controller is required: it doesn't work with
touch alone.

## Running it

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev      # start a dev server, then open the printed URL
npm run build    # production build in dist/
npm test         # unit tests
npm run sim      # simulate bot matches and print balance stats
```

Built with [PixiJS](https://pixijs.com/) and [Vite](https://vite.dev/). All
graphics are drawn in code and all sounds are synthesized; there are no asset
files. `PLAN.md` has the full rules and design notes.

### Phaser migration preview

On the `phaser` branch, run `npm ci` and `npm run dev`, then open
`http://localhost:5173/?engine=phaser` (use the port printed by Vite). The default
URL still runs the complete Pixi game. Each page loads only its selected engine.

The Phaser version now runs the full title/settings/play/result/tally flow,
including bots, pause, restart, sudden death, cheats, and session tallies.
Dismiss the startup overlay, choose a mode, and press Space/Enter to start.
Use the usual move/shoot keys and P/Esc for the pause menu; restart, exit, sound,
fullscreen, and 16:9 are menu items. F or double-click also toggles fullscreen.
Add `&renderer=canvas` to check Canvas instead of automatic WebGL.

The milestone 1 calibration round is now at
`http://localhost:5173/?engine=phaser&gallery=calibration`; it retains R/T/V controls.

Open `http://localhost:5173/?engine=phaser&gallery=primitives` to review the
milestone 2 drawing gallery: representative saucers, animals, wolf, parachute,
curves, transparency, gradient, text, and nested tint. Dismiss the startup overlay;
V toggles 16:9. This gallery is static.

Open `http://localhost:5173/?engine=phaser&gallery=artwork` for milestone 3:
complete procedural graphics, animations, HUD, powers, animals, weapons and effects.
Left/right changes pages; P freezes, R restarts, and V toggles 16:9. Add
`&date=2026-12-24` (or another special date) to inspect seasonal scenery.
This remains a render-only artwork preview.

See [the migration plan](PHASER_MIGRATION.md) and the review notes for
[milestone 1](docs/phaser-host/README.md),
[milestone 2](docs/phaser-primitives/README.md),
[milestone 3](docs/phaser-artwork/README.md),
[milestone 4](docs/phaser-scenes/README.md),
[milestone 5](docs/phaser-audio/README.md), including audio checks and listening samples, and
[milestone 6](docs/phaser-performance/README.md), including the M1 MacBook Air
performance comparison at `/scripts/phaser/benchmark.html`.
The [Safari stutter follow-up](docs/phaser-stutter-fix/README.md) documents the
rendering fixes, before/after measurements, and M1 retest instructions.

## About this project

This project is mostly vibe coded: most of the code was written by an AI
coding assistant from short feature requests, with playtesting and
simulation rather than careful line-by-line review. It is a hobby project.
Use it at your own risk.

## License

Released under the MIT License. Copyright (c) 2026 David Andréasson. See
[LICENSE](LICENSE) for the full text.
