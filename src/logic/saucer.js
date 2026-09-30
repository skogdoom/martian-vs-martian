// Saucer movement: acceleration, drag, speed cap, flight band, walls and bump.

import { WIDTH, ARENA, SAUCER, BUMP, RAM } from '../config.js';

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
    stun: 0, // seconds left dazed: after a rocket hit, a ram or three shots in a row
    hits: 0, // shot hits in a row (see COMBAT.dazeHits)
    sinceHit: Infinity, // seconds since the last of them
    immune: 0, // seconds left in which shot hits don't count (dazed, and just after)
    heading: null, // input direction held last step, as 'x,y'
    streak: 0, // seconds of momentum built (see steerSaucer)
    runX: 0, // horizontal direction of the run that built it: -1, 0 or 1
  };
}

/** Momentum from flying straight, 0..1. */
export function momentum(s) {
  return Math.max(0, Math.min(1, (s.streak - RAM.delay) / RAM.build));
}

export function speed(s) {
  return Math.hypot(s.vx, s.vy);
}

/** Momentum. It builds while one direction is held at full speed. Once
 * built, it is kept while the saucer goes on straight or turns downward (a
 * dive), as long as it stays fast. Letting go, pressing up, turning back or
 * slowing down loses it. `allowed` false (carrying) keeps it at zero. */
function updateMomentum(s, input, dt, allowed) {
  const hx = Math.sign(input.x);
  const hy = Math.sign(input.y);
  const moving = hx !== 0 || hy !== 0;
  const heading = moving ? `${hx},${hy}` : null;
  const cruise = SAUCER.maxSpeed * RAM.cruise;
  const straight = heading !== null && heading === s.heading;
  const len = Math.hypot(input.x, input.y);
  const alongFast = moving && (s.vx * input.x + s.vy * input.y) / len >= cruise;
  const diving = hy >= 0 && (hx === 0 || s.runX === 0 || hx === s.runX);
  const keep = allowed && moving && ((straight && alongFast) || (s.streak > 0 && speed(s) >= cruise && (straight || diving)));
  if (keep) {
    s.streak += dt;
    if (hx !== 0) s.runX = hx;
  } else {
    s.streak = 0;
    s.runX = hx;
  }
  s.heading = heading;
}

/** Apply player input. Input only accelerates up to the top speed, so
 * knockback can push a saucer faster than it can fly, and drag bleeds it off.
 * The top speed is SAUCER.maxSpeed, raised by momentum (flying straight) or
 * the speed power-up, whichever is more.
 * `accelScale` and `extraDrag` make the saucer heavier while its beam lifts;
 * `speedScale` raises the top speed (speed power-up); `momentum` false stops
 * it building momentum (while carrying). */
export function steerSaucer(s, input, dt, { accelScale = 1, extraDrag = 0, speedScale = 1, momentum: allowed = true } = {}) {
  let dx = input.x;
  let dy = input.y;
  const len = Math.hypot(dx, dy);
  const before = speed(s);
  updateMomentum(s, input, dt, allowed);
  const maxSpeed = SAUCER.maxSpeed * Math.max(speedScale, 1 + (RAM.boost - 1) * momentum(s));
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
  // With momentum, turning (into a dive) redirects the speed instead of losing it.
  if (momentum(s) > 0) {
    const now = speed(s);
    const keep = Math.min(before, maxSpeed);
    if (now > 0 && now < keep) {
      s.vx *= keep / now;
      s.vy *= keep / now;
    }
  }
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
