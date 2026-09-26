// Power-ups. Some rounds, halfway through, a little green man parachutes into
// the field carrying one power-up. He is hooked like an animal; when fully
// lifted he vanishes into the ship and the power-up starts.

import { WIDTH, ARENA, SAUCER, POWERUP } from '../config.js';
import { createAnimal, fieldBounds, updateAnimal } from './animal.js';

/** Decide at the start of a round whether (and which) power-up will drop. */
export function planDrop(rng) {
  if (rng() >= POWERUP.chance) return null;
  return POWERUP.types[Math.floor(rng() * POWERUP.types.length)];
}

export function createDrop(power, rng) {
  const { min, max } = fieldBounds('greenman');
  const margin = (max - min) * POWERUP.dropMargin;
  const x = min + margin + rng() * (max - min - 2 * margin);
  const d = createAnimal('drop', 'greenman', x);
  d.power = power;
  d.state = 'descending';
  d.y = -20;
  return d;
}

/** Advance the green man. Returns true on the step he touches down. */
export function updateDrop(d, dt, rng) {
  if (d.state === 'descending') {
    d.y += POWERUP.fallSpeed * dt;
    if (d.y < ARENA.groundY) return false;
    d.y = ARENA.groundY;
    d.state = 'field';
    return true;
  }
  if (d.state !== 'gone') updateAnimal(d, dt, rng);
  return false;
}

export function createPowers() {
  return { red: null, blue: null };
}

export function grantPower(powers, side, type) {
  powers[side] = { type, timeLeft: POWERUP.duration };
}

export function hasPower(powers, side, type) {
  return powers[side]?.type === type;
}

/** Count down active power-ups; pushes a `powerEnd` event when one runs out. */
export function updatePowers(powers, dt, events) {
  for (const side of ['red', 'blue']) {
    const p = powers[side];
    if (!p) continue;
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
