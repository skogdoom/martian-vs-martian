# Plan: Red Alien vs Blue Alien

A two-player, same-keyboard browser game. Two flying saucers compete to abduct cows and lambs and drop them in their own pen. Shots knock the opponent away and interrupt their pickups. The game is shown in 2D from the side on one shared screen.

## Tech

- Vite, PixiJS v8, plain JavaScript (ES modules), Vitest for logic tests.
- No physics engine. Movement uses a custom fixed-timestep loop at 60 Hz.
- All graphics are drawn in code with `PIXI.Graphics`, and all sounds are synthesized with the Web Audio API. No asset files.
- Fixed logical resolution of 1280×720, scaled to fit the window with letterboxing.
- Game logic (`src/logic/`) is pure and has no Pixi imports, so it can be unit tested. Rendering only reads the logic state.

## Arena

- One shared screen enclosed by walls on all four sides.
- **Flight band:** saucers can only fly in the top two-thirds of the screen (y 0–480).
- **Ground:** at y ≈ 660. Animals walk on it.
- **Pens:** Red's pen is on the left (x 0–180), Blue's on the right (x 1100–1280). Fences keep field animals from wandering into the pens.
- Red starts on the left, Blue on the right.

## Controls

| Player | Move    | Shoot |
|--------|---------|-------|
| Red    | WASD    | Space |
| Blue   | Arrows  | Enter |

- Key bindings live in `config.js`.
- Check for keyboard ghosting early, with both players holding diagonals while shooting.

## Mechanics

### Movement
- Free 2D movement with acceleration, drag and a max speed.
- Saucers are clamped to the flight band and the walls.

### Bump
- When saucers overlap, both get a small impulse pushing them apart.
- The effect is minor compared to a shot.

### Shooting
- Projectiles travel horizontally at the shooter's height, always toward the opponent's side (the sign of the x difference). Shots can miss.
- A hit applies a strong horizontal knockback to the opponent.
- Each clip holds 3 shots and reloads automatically in 1.5 s when empty.
- Each player has 12 shots per round. The cap resets every round.

### Hook
- Lowers automatically when the saucer is nearly still above an animal and within hook reach. The reach is about 200 px, so the saucer must fly low to reach the ground.
- Lift time is 1.0 s for a lamb and 1.6 s for a cow.
- The pickup is interrupted if the saucer drifts more than about 30 px horizontally from the animal, or is shot. The animal then drops back to the ground.
- A fully lifted animal stays attached, even when the saucer is shot or bumped.
- A saucer carries one animal at a time.
- A player can't hook animals in their own pen.

### Delivery
- A carried animal is released automatically when the saucer is over its own pen.
- The animal drops into the pen, stays there and stops wandering.

### Animals
- Each round starts with a fixed set of 3 cows and 4 lambs, placed in the field.
- They wander the field and freeze while being hooked.

### Stealing
- Animals in the opponent's pen can be hooked like any other animal.
- Each animal remembers who first delivered it. It is worth full value (cow 2, lamb 1) in that player's pen and half value in the other pen (cow 1, lamb 0.5).

### Score
- The live sum of the values of the animals in a player's pen.
- The round ends only when the timer runs out, since animals can still be stolen until then.

## Round and match flow

1. **Title screen:** press any key to start. The keypress also unlocks audio.
2. **Round:** a 3-2-1 countdown, then 60 seconds of play.
3. **Round result:** shows the scores and the winner, or a tie, then moves to the next round.
4. **Match rules:**
   - A match starts as best of 3.
   - A tied round gives no one a win.
   - The match ends early as soon as one player can't be caught (their wins exceed the opponent's wins plus the remaining rounds).
   - If round wins are level after the scheduled rounds, two more rounds are added (best of 3 → 5 → 7, and so on).
5. **Tally screen:** shows each player's match wins, total cows and total lambs.
   - Totals count the animals in each pen at the end of every round, including stolen ones.
6. **Play again:** starts a new match and keeps the tally. Reloading the page resets it.

## HUD

- Each player's score.
- The round timer.
- Round wins for each player.
- The shots left in the current clip, the total ammo remaining, and a reload indicator.

## Code structure

```
index.html
src/main.js            boot, scaling, fixed-step loop, scene manager
src/config.js          all tuning constants and key bindings
src/input.js           keyboard state
src/audio.js           synthesized sound effects
src/logic/             pure logic: saucer, projectile, hook, animal, scoring, match, tally
src/render/            Pixi drawing per entity, HUD, backdrop, particles
src/scenes/            title, play, roundEnd, tally
tests/                 Vitest unit tests for the logic
```

## Starting values (`config.js`)

| Constant          | Value          |
|-------------------|----------------|
| Round length      | 60 s           |
| Clip size         | 3              |
| Reload time       | 1.5 s          |
| Ammo per round    | 12             |
| Hook reach        | 200 px         |
| Lamb lift time    | 1.0 s          |
| Cow lift time     | 1.6 s          |
| Hook drift limit  | 30 px          |
| Animals per round | 3 cows, 4 lambs|

Also in `config.js`: projectile speed, knockback strength, bump strength, saucer acceleration, drag and max speed, and animal wander speed.

## Milestones

Work one milestone at a time. Each should be playable or testable before moving on.

- [x] **1. Scaffold**
  - Vite and Pixi set up, the scaled canvas, the fixed-step loop and input handling.
  - The arena drawn with placeholder shapes.
  - Done when: the canvas scales correctly and key presses are detected for both players.
- [x] **2. Saucers**
  - Movement, flight band, walls and bump.
  - Done when: both saucers fly independently, stay inside the flight band, and push apart on contact.
- [ ] **3. Combat**
  - Projectiles, knockback, clips, reload and the ammo cap.
  - HUD for ammo and reload.
  - Unit tests for ammo and reload.
  - Done when: shots fire toward the opponent's side, hits knock them back, and ammo runs out correctly.
- [ ] **4. Animals and hook**
  - Wandering, hooking, interrupts, carrying, delivery, pens, live score and stealing.
  - Unit tests for hook interrupts and scoring, including stolen values.
  - Done when: a full pickup-and-deliver cycle works, a shot interrupts a pickup, and stealing gives half value.
- [ ] **5. Match flow**
  - Countdown, timer, round end, tie extension, match end, tally screen and play again.
  - Unit tests for the match rules, including ties and early finish.
  - Done when: a full match can be played from the title screen to the tally and replayed.
- [ ] **6. Art**
  - Saucers with red and blue aliens in domes, cows and lambs, a tractor-beam hook, a starry sky and hills, fences for the pens.
  - Particles for hits and deliveries.
- [ ] **7. Sound**
  - Shot zap, hit thud, bump boing, reload click, rising pickup tone, synthesized moo and baa, delivery chime, countdown beeps and a round-end jingle.
- [ ] **8. Tuning pass**
  - Playtest and adjust the values in `config.js`.
- [ ] **9. Later (low priority)**
  - Player names and a persistent tally stored in localStorage.
