// A round: 3-2-1 countdown with everything frozen, then the timed play phase.

import { ROUND, POWERUP, GOLDEN, AMMO_CRATE, SUPPLY, WOLF } from '../config.js';
import { createWorld, stepWorld, spawnDrop, spawnGolden, spawnCrate, spawnWolf, crateInPlay, dropInPlay, fieldEmpty, SIDES } from './world.js';
import { planDrop, hasPower } from './powerup.js';
import { shouldDropGolden } from './golden.js';
import { scores } from './scoring.js';

export function createRound(seed) {
  const world = createWorld(seed);
  return {
    world,
    // Green-man drops planned for this round: { at, power, mystery, done }.
    drops: POWERUP.dropTimes.map((at) => ({
      at,
      power: planDrop(world.rng),
      mystery: world.rng() < POWERUP.mysteryChance,
      done: false,
    })),
    goldenChecked: false,
    wolfAt: planWolf(world.rng), // share of the round when the wolf drops, or null
    crates: { red: false, blue: false }, // has this player's crate dropped yet
    stalemate: 0, // seconds the field has been empty with someone out of shots
    supplied: false, // a supply drop already came while the field has been empty
    phase: 'countdown', // 'countdown' | 'play' | 'over'
    countdown: ROUND.countdown,
    shown: null, // last countdown number announced
    timeLeft: ROUND.length,
    events: [],
  };
}

function planWolf(rng) {
  const [lo, hi] = WOLF.window;
  const at = lo + rng() * (hi - lo);
  return rng() < WOLF.chance ? at : null;
}

/** Out of ammo, with no power-up that shoots for free. */
function outOfShots(w, side) {
  if (w.weapons[side].ammo > 0) return false;
  return !['triple', 'laser', 'unlimited'].some((type) => hasPower(w.powers, side, type));
}

/** Every animal abducted and someone out of shots: after a moment, an ammo
 * crate or a power-up drops. Once each time the field empties. */
function supplyDrop(r, dt) {
  const w = r.world;
  if (!fieldEmpty(w)) {
    r.stalemate = 0;
    r.supplied = false;
    return;
  }
  const out = SIDES.filter((side) => outOfShots(w, side));
  if (r.supplied || !out.length || dropInPlay(w)) {
    r.stalemate = 0;
    return;
  }
  r.stalemate += dt;
  if (r.stalemate < SUPPLY.after) return;
  r.stalemate = 0;
  r.supplied = true;
  if (w.rng() < SUPPLY.crateChance) {
    spawnCrate(w, out[Math.floor(w.rng() * out.length)]);
  } else {
    const power = POWERUP.types[Math.floor(w.rng() * POWERUP.types.length)];
    spawnDrop(w, power, w.rng() < POWERUP.mysteryChance);
  }
  r.events.push(w.events.at(-1));
}

/** Whole seconds left on the countdown, as shown on screen (3, 2, 1). */
export function countdownNumber(r) {
  return Math.ceil(r.countdown - 1e-9);
}

export function stepRound(r, inputs, dt) {
  r.events.length = 0;

  if (r.phase === 'countdown') {
    const n = countdownNumber(r);
    if (n !== r.shown) {
      r.shown = n;
      r.events.push({ type: 'countdown', n });
    }
    r.countdown = Math.max(0, r.countdown - dt);
    if (countdownNumber(r) === 0) {
      r.countdown = 0;
      r.phase = 'play';
      r.events.push({ type: 'go' });
    }
    return;
  }

  if (r.phase === 'play') {
    stepWorld(r.world, inputs, dt);
    r.events.push(...r.world.events);
    for (const d of r.drops) {
      if (d.done || !d.power || ROUND.length - r.timeLeft < ROUND.length * d.at) continue;
      d.done = true;
      spawnDrop(r.world, d.power, d.mystery);
      r.events.push(r.world.events.at(-1));
    }
    // Out of ammo early: one crate per player per round, one at a time.
    if (ROUND.length - r.timeLeft < ROUND.length * AMMO_CRATE.before) {
      for (const side of SIDES) {
        if (r.world.weapons[side].ammo > 0 || r.crates[side] || crateInPlay(r.world)) continue;
        r.crates[side] = true;
        spawnCrate(r.world, side);
        r.events.push(r.world.events.at(-1));
      }
    }
    supplyDrop(r, dt);
    if (r.wolfAt !== null && ROUND.length - r.timeLeft >= ROUND.length * r.wolfAt) {
      r.wolfAt = null;
      spawnWolf(r.world);
      r.events.push(r.world.events.at(-1));
    }
    if (!r.goldenChecked && ROUND.length - r.timeLeft >= ROUND.length * GOLDEN.checkAt) {
      r.goldenChecked = true;
      const points = scores(r.world.animals);
      if (shouldDropGolden(points, r.world.rng)) {
        spawnGolden(r.world, points.red < points.blue ? 'red' : 'blue');
        r.events.push(r.world.events.at(-1));
      }
    }
    r.timeLeft = Math.max(0, r.timeLeft - dt);
    if (r.timeLeft < 1e-9) {
      r.timeLeft = 0;
      r.phase = 'over';
      r.events.push({ type: 'roundEnd' });
    }
  }
}
