// Single-use power-up weapons: the homing rocket, the pen bomb and the time bomb.

import { WIDTH, HEIGHT, ARENA, SAUCER, ANIMALS, POWERUP } from '../config.js';
import { fireDirection } from './projectile.js';
import { penAt, fieldBounds, createAnimal, drop } from './animal.js';
import { spendGolden } from './golden.js';

// ---- homing rocket --------------------------------------------------------

export function createRocket(shooter, target) {
  const dir = fireDirection(shooter, target);
  return {
    owner: shooter.side,
    x: shooter.x + dir * (SAUCER.radius + 12),
    y: shooter.y,
    angle: dir > 0 ? 0 : Math.PI,
    life: POWERUP.rocketLife,
    alive: true,
  };
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Steer toward `target` (limited turn rate) and move.
 * Returns 'hit', 'expired' (burnt out or left the arena) or null. */
export function updateRocket(r, target, dt) {
  const want = Math.atan2(target.y - r.y, target.x - r.x);
  const turn = POWERUP.rocketTurn * dt;
  r.angle = wrapAngle(r.angle + Math.max(-turn, Math.min(turn, wrapAngle(want - r.angle))));
  r.x += Math.cos(r.angle) * POWERUP.rocketSpeed * dt;
  r.y += Math.sin(r.angle) * POWERUP.rocketSpeed * dt;
  r.life -= dt;

  const dx = (r.x - target.x) / (SAUCER.radius + POWERUP.rocketRadius);
  const dy = (r.y - target.y) / (SAUCER.halfHeight + POWERUP.rocketRadius);
  if (dx * dx + dy * dy <= 1) {
    r.alive = false;
    return 'hit';
  }
  if (r.life <= 0 || r.x < 0 || r.x > WIDTH || r.y < ARENA.flightTop || r.y > HEIGHT) {
    r.alive = false;
    return 'expired';
  }
  return null;
}

export function rocketKnockback(r, target) {
  target.vx = Math.cos(r.angle) * POWERUP.rocketKnockback;
  target.vy += Math.sin(r.angle) * POWERUP.rocketKnockback * 0.3;
}

// ---- pen bomb ---------------------------------------------------------------

export function createBomb(s) {
  return {
    owner: s.side,
    x: s.x,
    y: s.y + SAUCER.halfHeight + 8,
    vx: s.vx * 0.5,
    vy: Math.max(0, s.vy) * 0.5,
    alive: true,
  };
}

/** Fall; returns true on the step it hits the ground. */
export function updateBomb(b, dt) {
  b.vy += ANIMALS.gravity * dt;
  b.x = Math.max(0, Math.min(WIDTH, b.x + b.vx * dt));
  b.y += b.vy * dt;
  if (b.y < ARENA.groundY) return false;
  b.y = ARENA.groundY;
  b.alive = false;
  return true;
}

// ---- time bomb --------------------------------------------------------------

/** Dropped from `s` with the fuse lit. It is hooked and carried like an
 * animal (kind 'timebomb'), so it can be moved before it goes off. */
export function createTimeBomb(s, id) {
  const b = createAnimal(id, 'timebomb', s.x);
  b.y = s.y + SAUCER.halfHeight + 8 + ANIMALS.size.timebomb.h;
  b.fuse = POWERUP.timeBombFuse;
  b.lastBy = s.side; // who let go of it last
  drop(b, { by: s.side, vx: s.vx * 0.5, vy: Math.max(0, s.vy) * 0.5 });
  return b;
}

/** Throw `a` out of its pen in an arc that lands safely somewhere in the
 * field. A bomb also sets it on fire (cosmetic). */
export function bounceOut(a, rng, { fire = true } = {}) {
  spendGolden(a);
  a.bonus = false;
  a.pen = null;
  a.hookedBy = null;
  a.droppedBy = null;
  a.state = 'falling';
  a.fallFrom = a.y;
  a.safeFall = true;
  a.onFire = fire; // cosmetic only: it burns until a beam picks it up
  const { min, max } = fieldBounds(a.kind);
  const tx = min + rng() * (max - min);
  const [lo, hi] = POWERUP.bombLaunch;
  a.vy = -(lo + rng() * (hi - lo));
  const flight = (-2 * a.vy) / ANIMALS.gravity;
  a.vx = (tx - a.x) / flight;
}

/** The bomb went off at `x`. If that is in a pen, a random number (at least
 * one) of the animals standing in it are thrown back into the field.
 * Returns { pen, launched }. */
export function blastPen(animals, x, rng) {
  const pen = penAt(x);
  if (!pen) return { pen: null, launched: [] };
  const inPen = animals.filter((a) => a.state === 'penned' && a.pen === pen);
  const count = inPen.length ? 1 + Math.floor(rng() * inPen.length) : 0;
  // Pick `count` of them at random.
  for (let i = inPen.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [inPen[i], inPen[j]] = [inPen[j], inPen[i]];
  }
  const launched = inPen.slice(0, count);
  for (const a of launched) bounceOut(a, rng);
  return { pen, launched };
}
