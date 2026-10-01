# Martian vs Martian

A two-player couch game for the browser. Two flying saucers share one keyboard
and race to abduct cows and lambs into their own pen. Shoot, ram and steal
from each other; grab power-ups dropped by little green men. Rounds of
60, 90 or 120 seconds, best of 1, 3, 5 or 7 (ties go to sudden death).
There is also a single-player mode against the CPU.

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

## About this project

This project is mostly vibe coded: most of the code was written by an AI
coding assistant from short feature requests, with playtesting and
simulation rather than careful line-by-line review. It is a hobby project.
Use it at your own risk.

## License

Released under the MIT License. Copyright (c) 2026 David Andréasson. See
[LICENSE](LICENSE) for the full text.
