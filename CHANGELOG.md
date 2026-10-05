# Changelog

## Unreleased

- Some easter eggs have been added.
- Fixed: the sound could stop for good after the browser had paused it
  (sleep, switching tabs or apps, a new output device) until the page was
  reloaded.
- Faster and more chaotic: saucers are 12.5% faster, reloading takes 1 s
  instead of 1.5 s, and there are a third more shots per round (24 in a 90 s
  round). Ramming is slightly easier.
- Animals can be grabbed from about 40 px higher, and lifting is about 10%
  quicker. The CPU grabs from varying heights too.
- Bombs that go off in the field throw the cows and lambs near them around,
  on fire. They all survive.
- Animals splat from 220 px instead of 260: a pickup broken off at the very top
  of the beam's reach kills the animal.
- The green man splats in green blood if he falls too far; another one with
  the same power-up parachutes in shortly after.
- Lambs into cows and cows into lambs also burst animals being lifted or
  carried.
- Out of ammo, a saucer flies 10% faster, so ramming speed comes sooner.
- New power-up, parachutes: for 15 s, anything that falls from your beam high
  enough to splat floats down under a parachute instead.
- A green man nobody picks up within 10 s holds his head, says "Oh, no!" and
  explodes, taking his power-up with him. Mystery packages and ammo crates
  wait.
- Power-ups drop a little more often (70% chance at each drop time, was
  60%).
- Two more lambs at the start of each round (4 cows and 7 lambs), to go with
  the faster game.
- The tally at the end of a match shows how many cows and lambs each player
  splatted and how often each was dazed.
- Power-ups take a little longer to beam up (1 s instead of 0.8), and dazes
  last 0.3 s longer.
- A tidier title screen: each player's keys are in their top corner, with
  their saucer idling below, and the menu sits higher.
- Now and then a shooting star crosses the sky on the title screen.
- The title screen shows which version is running, above the title.
- The moon is no longer always full: each visit it is waning, at a quarter,
  waxing or full, the same for the menu and every game.
- Fixed: a golden animal that splatted (or was eaten by the wolf) kept
  glittering where it had been.
- The ammo crate announcement shows how much ammo it actually gave (it said +9
  whatever the round length).

## 1.0.0

First release.

- Two saucers, one keyboard (or two controllers): beam up cows and lambs and
  deliver them to your pen, shoot, ram and steal from each other.
- Single-player against a CPU on Easy, Normal or Hard.
- Rounds of 60, 90 or 120 seconds; best of 1, 3, 5 or 7, with sudden death
  when wins are level.
- Power-ups from little green men and mystery packages: speed, laser, triple
  shot, double steal, homing rocket, twin beam, pen bomb, infinite ammo,
  shield, lambs into cows, cows into lambs and a time bomb.
- Hazards and surprises: the wolf, golden animals, ammo crates, supply drops
  and restocks.
- Momentum and ramming; three hits in a row daze.
- Game controller support, pause menu, settings (sound, full screen, 16:9)
  and a session tally.
- Hardening: error recovery, NaN guard, memory leak fixes, particle, pop-up and
  sound caps, lint and CI.
