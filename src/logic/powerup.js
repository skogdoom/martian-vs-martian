// Drops from the sky that climb aboard when lifted, instead of being carried home:
// - Power-ups. Some rounds, halfway through, a little green man parachutes
//   into the field carrying one power-up. Fully lifted, he vanishes into the
//   ship and the power-up starts.
//   About one drop in five is a mystery package instead: the power-up inside
//   is only revealed when it is grabbed.
// - Ammo crates, when a player runs out of shots early (see round.js).

import { WIDTH, SAUCER, POWERUP } from '../config.js';
import { createAnimal, fieldBounds, parachute } from './animal.js';

export function createCrate(rng) {
  const c = createAnimal('crate', 'crate', dropSpot('crate', rng));
  parachute(c);
  return c;
}

/** Decide at the start of a round whether (and which) power-up will drop. */
export function planDrop(rng) {
  if (rng() >= POWERUP.chance) return null;
  return POWERUP.types[Math.floor(rng() * POWERUP.types.length)];
}

/** A random landing spot in the middle part of the field. */
export function dropSpot(kind, rng) {
  const { min, max } = fieldBounds(kind);
  const margin = (max - min) * POWERUP.dropMargin;
  return min + margin + rng() * (max - min - 2 * margin);
}

/** A green man carrying `power`, or, if `mystery`, a package that hides it. */
export function createDrop(power, rng, mystery = false) {
  const kind = mystery ? 'package' : 'greenman';
  const d = createAnimal('drop', kind, dropSpot(kind, rng));
  d.power = power;
  parachute(d);
  return d;
}

export function createPowers() {
  return { red: null, blue: null };
}

/** Timed power-ups count down; single-use ones (timeLeft null) wait to be used. */
export function grantPower(powers, side, type) {
  powers[side] = { type, timeLeft: POWERUP.singleUse.includes(type) ? null : POWERUP.duration };
}

export function hasPower(powers, side, type) {
  return powers[side]?.type === type;
}

/** Count down active power-ups; pushes a `powerEnd` event when one runs out. */
export function updatePowers(powers, dt, events) {
  for (const side of ['red', 'blue']) {
    const p = powers[side];
    if (!p || p.timeLeft === null) continue;
    p.timeLeft -= dt;
    if (p.timeLeft <= 1e-9) {
      powers[side] = null;
      events.push({ type: 'powerEnd', side, power: p.type });
    }
  }
}

/** Where a laser beam from `s` ends, and whether it hits `target`. */
export function laserBeam(s, target, dir) {
  const x0 = s.x + dir * SAUCER.radius * 0.8;
  const ahead = (target.x - s.x) * dir > 0;
  const level = Math.abs(target.y - s.y) <= SAUCER.halfHeight + POWERUP.laserHalfWidth;
  if (ahead && level) return { x0, x1: target.x - dir * SAUCER.radius * 0.7, y: s.y, dir, hit: true };
  return { x0, x1: dir > 0 ? WIDTH : 0, y: s.y, dir, hit: false };
}
