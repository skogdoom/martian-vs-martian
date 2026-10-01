# Plan: Martian vs Martian

A two-player, same-keyboard browser game. Two flying saucers compete to abduct cows and lambs and drop them in their own pen. Shots knock the opponent away, interrupt their pickups and knock loose the animal they carry. The game is shown in 2D from the side on one shared screen.

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
- **Momentum:** holding one direction at full speed builds momentum. After 0.2 s the top speed starts to climb, reaching 1.5× (480 px/s) after another 1 s. From a standstill it takes about 1.1 s and 330 px to reach ramming speed. Once built it is kept while the saucer flies on straight or turns downward (a dive, down alone, or back to level); the turn redirects the speed instead of losing it. Pressing up, turning back, letting go, being stopped by a wall or slowed below 80% of normal speed loses it. It doesn't build while carrying anything. A shot (or the laser) that knocks the saucer more than 30° off its course costs the momentum; a shot from behind that pushes it on its way doesn't. Speed lines show it building; a shock front ahead of the saucer shows it is fast enough to ram. The speed power-up doesn't stack with it: the higher of the two counts.

### Bump
- When saucers overlap, both get a small impulse pushing them apart.
- The effect is minor compared to a shot.
- **Ram:** a saucer that hits the other at 400 px/s or more (along the line between them) rams it. The rammed saucer is knocked back, drops everything it carries (it falls like a knocked-loose animal, so from high up it splats), loses any pickup in progress and is dazed for 1.5 s: no steering, lifting or shooting. The rammer loses its momentum. A saucer carrying anything can't ram, not even with the speed power-up. Head on, both can be dazed. A shield stops a ram. Values are in `RAM` in `config.js`.

### Shooting
- Projectiles travel horizontally at the shooter's height, always toward the opponent's side (the sign of the x difference). Shots can miss.
- A hit applies a strong horizontal knockback to the opponent.
- **Dazed:** three shot hits in a row, each within 2 s of the last, daze the saucer for 1.5 s (no steering, lifting or shooting). Shots landing at once (triple shot) count as one hit; shots that bounce off a shield don't count. Hits while dazed and for 1 s after don't count toward the next daze, so nobody can be kept dazed. Values are `dazeHits`, `dazeWindow`, `dazeTime` and `dazeGrace` in `COMBAT`.
- Each clip holds 3 shots and reloads automatically in 1.5 s when empty.
- Each player has 18 shots per round. The cap resets every round.
- **Ammo crate:** if a player runs out before halfway (45 s), a crate parachutes into the field. It is hooked like the green man and climbs aboard when lifted, giving +9 shots (up to the cap); an empty gun reloads at once. Either player can grab it. At most one crate at a time, and one per player per round. Values are in `AMMO_CRATE` in `config.js`.
- **Supply drop:** if every animal has been abducted (none left in the field) and a player is out of shots, then after 3 s either an ammo crate (for that player) or a green man with a random power-up parachutes in, 50/50. Once each time the field empties, and not while another drop is in play. Values are in `SUPPLY` in `config.js`.

### Hook
- Lowers automatically when the saucer is nearly still above an animal and within hook reach. The reach is about 200 px, so the saucer must fly low to reach the ground.
- Lift time is 1.0 s for a lamb and 1.6 s for a cow.
- The pickup is interrupted if the saucer drifts more than 40 px sideways from the animal, gets more than 60 px beyond hook reach above it, or is shot. Flying up or down during a pickup is fine: the animal rises with the beam. The animal then drops back to the ground.
- A fully lifted animal stays attached when the saucer is bumped, but a hit knocks it loose and it falls where it is (`COMBAT.knockLoose`).
- A saucer carries one animal at a time.
- A player can't hook animals in their own pen.

### Delivery
- A carried animal is released automatically when the saucer is over its own pen and low enough for a safe landing (a fall of at most 260 px). Higher up, it stays on until you come down.
- **Dropping and throwing by hand:** while carrying, the shoot key lets go of the (lowest) animal instead of firing. It keeps the saucer's speed, so it can be lobbed; whether it's a delivery is decided by where it lands (your own pen). Animals knocked loose by a hit also fly off with the saucer's speed from before the hit.
- **Restock:** if every cow and lamb has splatted, 3 new ones (random kinds) parachute into the field; if the field has stood empty for 10 s, 2 do (`RESTOCK` in `config.js`).
- **Spooked pens:** a saucer hovering over its own pen for more than 3 s spooks the animals in it: they get nervous (a "!"), then one jumps the fence into the field every 2 s, landing safely (`SPOOK` in `config.js`). Stops pen camping.
- **Splat:** a cow or lamb that falls more than 260 px (measured from the top of its arc) (dropped by hand, knocked loose by a shot, or dropped mid-lift) bursts in a cartoon cloud of blood and is out of the round: no points for anyone. Animals thrown out of a pen by a bomb land safely. `SPLAT.height` in `config.js`.
- The animal drops into the pen, stays there and stops wandering.

### Animals
- Each round starts with a fixed set of 4 cows and 5 lambs, placed in the field (13 points in all).
- They wander the field and freeze while being hooked.

### Stealing
- Animals in the opponent's pen can be hooked like any other animal.
- Each animal remembers who first delivered it. It is worth full value (cow 2, lamb 1) in that player's pen and half value in the other pen (cow 1, lamb 0.5).

### The wolf
- In about one round in three, at a random time between 25% and 70% of the round, a wolf parachutes into the field.
- In the field it chases the nearest lamb in the field and eats it (1 s per lamb). Lambs within 220 px run away from it, but it is faster. It ignores cows, lambs in pens and lambs in a beam.
- It is hooked and carried like an animal (lift 1.3 s), but is never let go of automatically: the shoot key drops it. It always lands on its feet, whatever the height.
- Dropped into a pen, it eats the lambs in that pen, which takes them off that player's score. Either player can lift it out of any pen, including their own.
- After 6 s with nothing in reach it howls, gets bored and runs off the screen for good.
- Values are in `WOLF` in `config.js`.
- The CPU lifts a wolf out of its own pen and drops any wolf it carries into the opponent's pen. On Normal and Hard it also fetches the wolf from the field when the opponent has 2+ lambs penned.

### Power-ups
- Twice per round (at 30% and 60% of the round) there is a 60% chance that a little green man parachutes into the field carrying one power-up. About one drop in five is a **mystery package** instead: a wrapped box with a question mark that stays put; its power-up is revealed only when grabbed. Its icon is shown on his parachute and over his head.
- He wanders like an animal and is hooked the same way (lift 0.8 s; shots and drift break the pickup). A saucer carrying an animal can't grab him.
- Fully lifted, he climbs into the saucer and the power-up starts. It lasts 15 s.
- The power-ups:
  - **Speed boost:** 60% faster top speed, 50% more thrust.
  - **Laser cannon:** hold shoot for a continuous beam that pushes the opponent away and breaks their pickups. Uses no ammo.
  - **Triple shot:** three shots per press, spread vertically. Shots are free while it lasts and an empty gun reloads.
  - **Double steal:** animals stolen from the opponent's pen while it's active are worth double full value (cow 4, lamb 2) once delivered, until they are lifted out again.
- Like any hit, laser and triple-shot hits also knock a carried animal loose.
- More power-ups, drawn at random with the rest:
  - **Homing rocket** (single use, kept until fired): the next shoot press launches one rocket that steers toward the opponent (limited turn rate, burns out after 4.5 s). A hit gives strong knockback, breaks a pickup, knocks a carried animal loose and stuns the saucer for 2 s: no steering, lifting or shooting.
  - **Twin beam** (15 s): the beam can carry a second animal, hanging under the first. Both are delivered together; a hit knocks the lower one loose.
  - **Pen bomb** (single use): the shoot key drops it. If it lands in a pen, a random number (at least one) of the animals in it are thrown back into the field; they keep their original owner. It hits whichever pen it lands in, including your own. The animals it throws out catch fire (cosmetic only) until a beam picks them up, which puts the fire out in a puff of steam.
  - **Infinite ammo** (15 s): shots cost no ammo and the clip never needs reloading. Works with an empty gun; the free shots go when it ends.
  - **Shield** (15 s): a bubble around the saucer. Shots, laser and rockets bounce off: no knockback, no stun, no broken pickup, nothing knocked loose. Bumps don't move it either; the other saucer takes the whole bounce.
  - **Lambs → cows** (instant): every lamb standing in the field or in a pen bursts, and a cow parachutes down in its place. One replacing a penned lamb lands in the same pen, keeps its owner and steal bonus, and counts for that pen from the moment it appears. Lambs being lifted or carried, and golden animals, are left alone.
  - **Cows → lambs** (instant): the same, the other way round.
  - **Time bomb** (single use): the shoot key drops it and lights an 8 s fuse, with the seconds shown over it and a tick each second. On the ground it can be lifted (0.8 s), carried and dropped again by either player, even out of their own pen; like the wolf it is never let go of automatically. When the fuse runs out on the ground it works like the pen bomb on the pen it lies in (nothing in the field). If it goes off in a beam, that saucer is dazed for 2 s and drops what else it carries. 8 s is enough to fetch it out of your pen from mid-field, but tight to send it all the way back.
- Instant power-ups happen the moment they are grabbed; a power-up already held is kept.
- Single-use power-ups show in the HUD without a timer, and the item hangs under the saucer until used.
- Values are in `POWERUP` in `config.js`; the duration was tuned with `npm run sim` so a power-up can turn a round.

### Golden animals
- A rare comeback drop. At the 2/3 mark of a round (60 s), if one player leads by 3 or more points, there is a 50% chance that a golden cow or golden lamb parachutes into the field.
- It is hooked, carried and delivered like any animal. Both players can race for it.
- Delivered by the trailing player, it is worth exactly the deficit at that moment, so the score is tied, but never less than its normal value.
- Delivered by the leader, it is an ordinary cow or lamb.
- Once it has paid out, lifting it out of that pen makes it ordinary again.
- Values are in `GOLDEN` in `config.js`. In simulation it drops in about 1 round in 20.

### Score
- The live sum of the values of the animals in a player's pen.
- The round ends only when the timer runs out, since animals can still be stolen until then.

## Round and match flow

1. **Title screen:** choose 1 player (against the CPU, with a difficulty) or 2 players, and start. The first keypress also unlocks audio; every key press or click wakes it up again if the browser suspended it.
2. **Round:** a 3-2-1 countdown, then 90 seconds of play.
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
| Round length      | 90 s           |
| Clip size         | 3              |
| Reload time       | 1.5 s          |
| Ammo per round    | 18             |
| Hook reach        | 200 px         |
| Lamb lift time    | 1.0 s          |
| Cow lift time     | 1.6 s          |
| Hook drift limit  | 30 px          |
| Animals per round | 4 cows, 5 lambs|

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
- [x] **3. Combat**
  - Projectiles, knockback, clips, reload and the ammo cap.
  - HUD for ammo and reload.
  - Unit tests for ammo and reload.
  - Done when: shots fire toward the opponent's side, hits knock them back, and ammo runs out correctly.
- [x] **4. Animals and hook**
  - Wandering, hooking, interrupts, carrying, delivery, pens, live score and stealing.
  - Unit tests for hook interrupts and scoring, including stolen values.
  - Done when: a full pickup-and-deliver cycle works, a shot interrupts a pickup, and stealing gives half value.
- [x] **5. Match flow**
  - Countdown, timer, round end, tie extension, match end, tally screen and play again.
  - Unit tests for the match rules, including ties and early finish.
  - Done when: a full match can be played from the title screen to the tally and replayed.
- [x] **6. Art**
  - Saucers with red and blue Martians in domes, cows and lambs, a tractor-beam hook, a starry sky and hills, fences for the pens.
  - Particles for hits and deliveries.
- [x] **7. Sound**
  - Shot zap, hit thud, bump boing, reload click, rising pickup tone, synthesized moo and baa, delivery chime, countdown beeps and a round-end jingle.
- [ ] **8. Tuning pass**
  - Playtest and adjust the values in `config.js`.
  - Simulated pass done: `npm run sim` plays bot rounds with the real logic and reports pickups, interrupts, steals, ammo, bumps, lead changes and ties. Try values with e.g. `npm run sim -- 500 COMBAT.ammoPerRound=15`.
    - Pickups broke in 40% of lifts when the player let go of the keys a moment after the beam grabbed. The beam now makes a lifting saucer heavier (`HOOK.beamAccel`, `HOOK.beamDrag`): 1% now, and flying away on purpose still breaks it in about 0.4 s.
    - Saucers pressed together fired ~24 bump events per round, mostly repeats. A bump now re-arms only after they separate by `BUMP.rearm` px: ~7 per round.
  - Still to do: a human playtest. (Resolved later: ammo raised to 18, plus ammo crates.) Earlier question: `COMBAT.ammoPerRound`. With 12, bots are out of shots by ~17 s, before the stealing phase (the field is empty by ~23 s). 15 lasts to ~23 s, 18 to ~30 s, at the cost of more pickups shot down (6.7 → 8.5 → 10 per round). Ties are 11–15% of rounds.
- [x] **Power-ups** (added after milestone 8)
  - Green man drop, the four power-ups, HUD timer, announcements, art and sound.
  - Unit tests for the drop, each power-up, knock-loose and the steal bonus.
  - Tuned with the simulator. With 15 s of power, a trailing grabber wins 7–23% of rounds, depending on the power-up, against 2% without. The laser and triple shot only turned rounds once their hits could knock a carried animal loose.
- [x] **Golden animals and 90 s rounds**
  - Golden drop, value rules, art (gold tint, glow, parachute, sparkles), announcements and sound.
  - Unit tests for when it drops and what it is worth.
  - Simulator: with a 3-point lead at 60 s in 9% of rounds, it drops in about 4.5%. When it drops, the leader delivers it first 59% of the time. When the trailing player delivers it, they go on to win 19% and tie 22% of those rounds; trailing by 3+ without it wins about 1%.
- [x] **More ammo and ammo crates**
  - Ammo per round 12 → 18. An ammo crate drops for a player who runs out before 45 s.
  - Crate art, announcements and sound. Unit tests for when it drops, the refill and who can take it.
  - Simulator (trigger-happy bots): shots run out at ~28 s instead of ~16 s; a crate drops in almost every round, about 27 s in. Players who shoot less will see fewer.
- [x] **Single player**
  - The title menu picks 1 or 2 players and, for 1 player, the CPU difficulty (Easy, Normal, Hard). ESC returns to the menu from a round or the tally.
  - In 1 player, you fly Red with either key set and the CPU flies Blue. The HUD and messages call it CPU.
  - The CPU is the simulator's bot (`src/logic/bot.js`), with skill presets in `BOT` in `config.js`: reaction time, steering, aim, aggression, how often it fumbles a lift, and whether it raids your pen when behind.
  - Each mode and difficulty keeps its own tally.
  - Simulator (`npm run sim -- 1500 RED=easy BLUE=hard`): Normal beats Easy 98% of rounds, Hard beats Normal 86%, Hard vs Hard is even.
- [x] **Every hit knocks a carried animal loose** (after playtesting)
  - Before, only laser and triple-shot hits did. Shots still break lifts in progress, and bumps still don't drop anything.
  - Simulator: rounds swing more (lead changes 2.5 → 2.9 per round; the player trailing at 51 s wins 14% instead of 4%). A trailing power-up grabber wins 32% (laser 41%, speed 31%, triple 29%, steal 24%).
- [x] **Homing rocket, twin beam and pen bomb**
  - Logic, CPU use, art (rocket with smoke trail, bomb, held items, spin-out stars, explosions), announcements and sound. Unit tests for each.
  - Simulator, trailing grabber wins: bomb 60%, twin 47%, laser 37%, triple 31%, steal 29%, speed 27%, rocket 18% (the rocket's stun was added because a single knock-loose barely mattered).
- [x] **Bigger herd, more drops, dropping animals, splats**
  - 4 cows and 5 lambs; two green-man drop times per round.
  - Shoot while carrying drops the animal; automatic release only when low; falls over 220 px splat (cloud of blood, stain, "SPLAT!", sound).
  - The CPU never drops by hand, comes down low to deliver and, on Normal and Hard, flies home low so a hit doesn't splat its animal.
  - Simulator: about 1.2 green men grabbed per round, 0.6 splats per round, ties 7%.
- [x] **Mystery packages and restocking**
  - About 1 in 5 power-up drops is a mystery package; 3 fresh animals parachute in when the whole herd has splatted.
  - A drop within reach of the beam is grabbed before a nearer animal.
  - Fixed: hooking a package crashed the game loop (no voice for it in the sound code); unknown sounds are now ignored.
- [x] **Against pen camping; throwing; higher splat height**
  - Field restock after 10 s empty; spooked pens after 3 s of hovering; the CPU waits mid-field.
  - Throwing with the saucer's momentum; splat height 220 → 260 px.
  - Simulator: lead changes 2.75 → 3.1 per round; about 1.6 field restocks and 0.05 splats per round.
- [x] **Full screen**
  - F (or double-click) toggles full screen; ESC or F leaves it. The arena stays letterboxed at 16:9 and the mouse cursor is hidden.
  - F and M never skip a result screen.
- [x] **Infinite ammo, shield, lambs → cows, cows → lambs; supply drops**
  - Logic, CPU use (it doesn't waste shots on a shield), icons, shield bubble, bursts, announcements and sound. Unit tests for each, and for the supply drop.
  - Simulator, trailing grabber wins: unlimited 26%, shield 15%, lambs → cows 19%, cows → lambs 15%. The two swaps change the field for both players rather than help the grabber. The CPU gets little out of the shield, since shots rarely decide its rounds.
- [x] **The wolf**
  - Logic (`src/logic/wolf.js`), art (`src/render/wolfView.js`: parachute, running, eating, howling), announcements, "CHOMP!", howl, growl and chomp sounds, CPU handling. Unit tests.
  - Simulator (Hard vs Hard): a wolf in 33% of rounds; it eats about 0.6 lambs in the field and 2.9 in pens per wolf round, since the bots keep dropping it back into each other's pens; it leaves before the end in about half of them.
- [x] **Momentum and ramming**
  - Logic, speed lines and shock front, "RAM!" impact, announcement and sound. Unit tests.
  - The CPU rams only when out of shots, at a carrier that is close and level. Letting it chase carriers across the field, or floor it on every long flight, cost it deliveries (14.2 → 12.2 per round) and doubled bumps.
  - Simulator: about 0.2 rams per round between bots, other numbers close to before (deliveries 13.7, lead changes 3.1). Players who hold a direction will ram more.
- [x] **Time bomb**
  - Logic, CPU use (drops it on the opponent's pen, fetches it out of its own if there is time, lets go before it blows in the beam), art (bomb with countdown and glow, clock-face icon), ticks, announcements. Unit tests.
  - Simulator: with a 10 s fuse the bots sent it back 34% of the time and it hit the target pen 9%; the grabber, when behind, won 21%. With 8 s: 34% hit the target pen, 14% came back, 40% were dropped in the field, and the grabber won 33% when behind.
- [x] **Tweaks after playtesting**
  - Ramming needs a shorter run: momentum starts after 0.2 s (was 0.3) and is full after 1 s more (was 1.2), so ramming speed comes after ~330 px instead of ~405 px.
  - Pickups: flying up or down no longer risks the grip as long as the saucer stays within reach + 60 px of the animal; the sideways limit is 40 px (was 30), since a stray diagonal key while climbing easily drifted 30 px.
  - Fixed: sound could stay off for the rest of the game. Audio was only unlocked by key presses on the title screen, so if the browser suspended it later (tab switch, sleep, new output device) nothing woke it up. Every key press and click now resumes it, and so does coming back to the tab.
- [x] **Dives keep momentum; no ramming while carrying**
  - Momentum is kept through a dive and the speed carries over into the new direction. It doesn't build while carrying, and a carrier can't ram.
  - Simulator: rams 0.30 → 0.34 per round; deliveries and lead changes unchanged.
- [x] **Shots cost momentum**
  - A hit that turns a saucer more than 30° off its course (`RAM.jolt`) clears its momentum, with a puff as the shock front breaks up. The laser usually slows it below cruising speed first, which clears it as well.
- [x] **Animal swaps reach the pens**
  - Lambs → cows and cows → lambs now also swap penned animals; the replacement parachutes into the same pen and counts at once.
- [x] **Dazed by three hits in a row**
  - Logic, "DAZED!" pop-up, announcement and sound; unit tests.
  - Simulator: the trigger-happy bots (27 shots each, 63% hits) daze each other 2.6 times per round in total; lead changes 3.1 → 2.9. Players who shoot less will see fewer.
- [x] **9. Controller support**
  - "Keypad" read as game controllers (Gamepad API). Plain numeric-keypad keys for Blue would be a small extra, if wanted.
  - Input layer: `input.js` polls pads once per fixed step and merges them with the keys, so `playerInput(side)` stays the one source for scenes and the bot. Presses are edge-detected per step, like keys.
  - Mapping (standard layout): left stick or d-pad to move, A or right trigger to shoot (and drop), Start to start or confirm, B/Back for the menu. The stick is turned into -1/0/1 with a dead zone, so momentum works as with keys (analog noise would keep changing the heading).
  - Assignment: the first pad flies Red, the second Blue; keys keep working alongside. In 1 player, any pad flies Red. Plugging in or unplugging mid-game shows a short notice; a pad lost mid-round leaves that saucer idle until it is back.
  - Browsers don't count pad buttons as a user gesture, so audio and full screen can't start from a pad. The title screen shows "press any key or click for sound" until audio runs.
  - Optional: a short rumble on hits, rams and dazes where the pad supports it.
  - The title screen shows the pad controls next to the keys once a pad is seen.
  - Tests: the pad-to-input mapping, with fake pad states (dead zone, d-pad and stick together, button edges).
  - Done when: a match can be played start to finish with two pads and no keyboard (apart from the sound unlock).
  - As built: `src/gamepad.js` (pure: `readPad`, `createPadPoller`) and `pollPads()` in `input.js`, called once per fixed step. Pad buttons appear in the `pressed` set as pseudo codes (`PadConfirm`, `PadBack`, `PadUp/Down/Left/Right`, `PadShoot:red/blue`), so the scenes only had to learn those names. Stick flicks never count as "any key" on the result screens.
  - A pad keeps its slot while connected: if Red's pad drops out, Blue's does not become Red. A new pad takes the free slot. In 1 player, every input steers Red.
  - Rumble (where the pad supports it) on hits, rams, dazes and a time bomb going off in the beam. A "controller connected / disconnected" notice shows at the bottom for 3 s.
  - A pad can't quit a round or go back to the main menu, and has no button for the sound (M) or full screen (F); the sound can be switched from the pause menu. Browsers don't allow starting sound or full screen from a pad button anyway.
  - **Pause:** P or Esc on the keyboard, Start on a pad (Start still begins the game on the title screen). The round freezes, the sound is suspended and nothing wakes it while paused. A menu comes up: Resume, Restart the game (a new match; the tally is kept, rounds not finished aren't counted), Sound on/off, Exit to main menu. Up/down and Enter/Space (or d-pad and A). A pad can resume, restart and switch the sound; exit is keyboard-only. Esc, P or Start resume. Esc no longer quits a round at once; it opens this menu.
  - Checked with a fake pad in the browser (menu, start, steering, shooting, unplugging, B to the menu) and 10 unit tests. Not tried with a real pad.

- [ ] **10. Round length and number of rounds**
  - Title menu: up/down moves between rows (mode, CPU difficulty, round length, rounds); left/right changes the value. Enter or Space starts; 1/2 stay as shortcuts.
    - Round length: 60, 90 (default) or 120 s.
    - Rounds: best of 1, 3 (default), 5 or 7.
  - The choice is kept for the session and remembered in localStorage (read and written in try/catch; defaults if unavailable).
  - Match rules for best of N: first to win a majority, early finish when the other can't catch up (as now). Level after N rounds: sudden death, one round at a time, instead of two more. That is a change for best of 3; the alternative is to keep +2 for N ≥ 3 and +1 for N = 1.
  - Round length becomes a match setting instead of the global `ROUND.length` (used in `round.js`, `bot.js`, `play.js` and `sim.js`). Timed events are already shares of the round and scale by themselves: green-man drops, the early ammo crate, the golden check, the wolf window.
  - To tune with the simulator (`LENGTH=` and `ROUNDS=` arguments): ammo scaled to the length (12 / 18 / 24?), a third green-man drop in 120 s rounds, restock timing in 60 s rounds.
  - HUD, round-end and tally screens show the chosen "best of N". The tally stays per mode and difficulty.
  - Tests: match logic for 1, 3, 5 and 7 rounds (early finish, ties, sudden death), rounds of each length, ammo scaling.

- [ ] **11. Hardening, performance and code review**
  - Done after milestone 10, so the review covers the finished feature set.
  - Code review of every module: dead code, naming, comments that no longer match, config values vs `PLAN.md`, duplicated logic (the hazard kinds, the drop views, the helpers repeated across tests).
  - Robustness:
    - An exception in one frame must not freeze the game: catch it in the loop, log it, and show an error notice instead of a dead screen.
    - Guard against NaN and runaway positions.
    - Cap the herd: restocks and animal swaps can grow it without limit.
    - Round end with things in flight (a carried wolf, a falling time bomb, a lit laser): nothing leaks into the next round.
  - Leaks over a long session (10+ matches):
    - Views, Text objects and key listeners are destroyed on scene changes.
    - Audio voices are stopped on Esc.
    - Memory and object counts stay flat.
  - Tests for interactions not yet covered: both saucers dazed at once, a ram while carrying the time bomb, the wolf plus an animal swap, a supply drop during a restock.
  - Performance, profiled in Chrome with CPU throttling and in 4K full screen:
    - Stop rebuilding static `Graphics` every frame (lights, eyes, beams, sparks); only redraw what changes.
    - Cap and pool particles and pop-up texts.
    - Cap the number of sounds playing at once.
    - Cap the render resolution at 2× device pixels.
    - Check bundle size.
    - Target: a steady 60 fps on a mid-range laptop.
  - Tooling: ESLint and Prettier (`npm run lint`), and a GitHub Actions workflow that runs lint, tests and the build on every pull request.

- [ ] **12. Release**
  - Version 1.0.0 in `package.json`, and a `CHANGELOG.md`.
  - Deploy to GitHub Pages with a GitHub Actions workflow on pushes to `master` (Vite `base` set for the repository path). The README gets a "Play it here" link.
  - Polish:
    - A real favicon (the page has an empty one).
    - Page description and an Open Graph screenshot.
    - A "click or press any key" start overlay, which also unlocks audio and gives the page focus.
    - A notice on touch-only devices that the game needs a keyboard or a controller.
  - Browser check: Chrome, Firefox, Safari, Edge. Note in the README that some keyboards can't register many keys at once (ghosting), a hardware limit with two players on one keyboard.
  - Final playtest with a checklist (both modes, all difficulties, all round options, controllers), then tag `v1.0.0` and publish a GitHub release with notes and a zip of `dist/` (also usable for itch.io).

- [ ] **Later (low priority)**
  - Player names and a persistent tally stored in localStorage.
