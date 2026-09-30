// Saucer movement: acceleration, drag, speed cap, flight band, walls and bump.

import { WIDTH, ARENA, SAUCER, BUMP } from '../config.js';

// Saucers are wide and flat, so collisions use an ellipse. Vertical
// distances are stretched by this factor to turn it into a circle test.
const SQUASH = SAUCER.radius / SAUCER.halfHeight;

export function createSaucer(side) {
  return {
    side,
    x: SAUCER.startX[side],
    y: SAUCER.startY,
    vx: 0,
    vy: 0,
    stun: 0, // seconds left spinning out after a rocket hit
  };
}

export function speed(s) {
  return Math.hypot(s.vx, s.vy);
}

/** Apply player input. Input only accelerates up to maxSpeed, so knockback
 * can push a saucer faster than it can fly, and drag bleeds it off.
 * `accelScale` and `extraDrag` make the saucer heavier while its beam lifts;
 * `speedScale` raises the top speed (speed power-up). */
export function steerSaucer(s, input, dt, { accelScale = 1, extraDrag = 0, speedScale = 1 } = {}) {
  const maxSpeed = SAUCER.maxSpeed * speedScale;
  let dx = input.x;
  let dy = input.y;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
    const along = s.vx * dx + s.vy * dy;
    if (along < maxSpeed) {
      const add = Math.min(SAUCER.accel * accelScale * dt, maxSpeed - along);
      s.vx += dx * add;
      s.vy += dy * add;
    }
  }
  const damp = Math.exp(-(SAUCER.drag + extraDrag) * dt);
  s.vx *= damp;
  s.vy *= damp;
}

export function moveSaucer(s, dt) {
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  clampSaucer(s);
}

export function clampSaucer(s) {
  const minX = SAUCER.radius;
  const maxX = WIDTH - SAUCER.radius;
  const minY = ARENA.flightTop + SAUCER.top;
  const maxY = ARENA.flightBottom;
  if (s.x < minX) {
    s.x = minX;
    if (s.vx < 0) s.vx = 0;
  } else if (s.x > maxX) {
    s.x = maxX;
    if (s.vx > 0) s.vx = 0;
  }
  if (s.y < minY) {
    s.y = minY;
    if (s.vy < 0) s.vy = 0;
  } else if (s.y > maxY) {
    s.y = maxY;
    if (s.vy > 0) s.vy = 0;
  }
}

/** Push overlapping saucers apart. Returns true on a new contact: saucers
 * that stay close count as one contact until they separate by `BUMP.rearm`.
 * A `fixed` saucer (shield power-up) isn't moved: the other takes it all. */
export function bumpSaucers(a, b, { aFixed = false, bFixed = false } = {}) {
  let dx = b.x - a.x;
  let dy = (b.y - a.y) * SQUASH;
  let dist = Math.hypot(dx, dy);
  const minDist = SAUCER.radius * 2;
  if (dist >= minDist) {
    if (dist >= minDist + BUMP.rearm) a.touching = b.touching = false;
    return false;
  }
  if (dist < 1e-6) {
    dx = 1;
    dy = 0;
    dist = 1;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  // Separate positions (back into real space for y).
  // Each saucer's share of the push and the impulse.
  const onlyOne = aFixed !== bFixed;
  const ka = onlyOne ? (aFixed ? 0 : 2) : 1;
  const kb = onlyOne ? (bFixed ? 0 : 2) : 1;
  const push = (minDist - dist) / 2;
  a.x -= nx * push * ka;
  b.x += nx * push * kb;
  a.y -= (ny * push * ka) / SQUASH;
  b.y += (ny * push * kb) / SQUASH;
  // Impulse along the normal, only if they are closing.
  const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  const fresh = !a.touching;
  if (closing < 0 || fresh) {
    a.vx -= nx * BUMP.strength * ka;
    a.vy -= ny * BUMP.strength * ka;
    b.vx += nx * BUMP.strength * kb;
    b.vy += ny * BUMP.strength * kb;
  }
  clampSaucer(a);
  clampSaucer(b);
  a.touching = b.touching = true;
  return fresh;
}
