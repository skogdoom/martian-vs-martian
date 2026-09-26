// Cows and lambs: wandering, falling and landing in pens.
//
// States:
//   field    wandering between the pen fences
//   penned   standing still in a pen
//   lifting  frozen in a tractor beam (see hook.js)
//   carried  attached under a saucer
//   falling  dropped from a beam or a delivery
//
// The green man (power-up drop) reuses this with kind 'greenman' and two
// extra states: descending (parachute) and gone (climbed into a saucer).
//
// `y` is the animal's feet. `pen` is the pen it counts toward, `owner` the
// player who first delivered it.

import { ARENA, ANIMALS } from '../config.js';

export function penAt(x) {
  for (const [side, pen] of Object.entries(ARENA.pens)) {
    if (x >= pen.left && x <= pen.right) return side;
  }
  return null;
}

export function fieldBounds(kind) {
  const half = ANIMALS.size[kind].w / 2;
  return {
    min: ARENA.pens.red.right + ANIMALS.fieldMargin + half,
    max: ARENA.pens.blue.left - ANIMALS.fieldMargin - half,
  };
}

/** Keep an animal fully inside a pen. */
export function clampToPen(x, kind, side) {
  const pen = ARENA.pens[side];
  const half = ANIMALS.size[kind].w / 2 + 16; // room for the head
  return Math.min(pen.right - half, Math.max(pen.left + half, x));
}

export function createAnimal(id, kind, x) {
  return {
    id,
    kind,
    x,
    y: ARENA.groundY,
    vx: 0,
    vy: 0,
    state: 'field',
    pen: null,
    owner: null,
    hookedBy: null,
    delivering: false, // falling from a delivery rather than a dropped pickup
    bonus: false, // stolen during a steal power-up: worth extra in its pen
    wanderTimer: 0,
  };
}

/** The fixed starting herd: lambs and cows alternating, symmetric about the centre. */
export function createHerd() {
  const left = { cow: ANIMALS.cows, lamb: ANIMALS.lambs };
  const other = (k) => (k === 'cow' ? 'lamb' : 'cow');
  // Alternate, starting with whichever is more numerous, so the layout mirrors.
  let next = left.lamb >= left.cow ? 'lamb' : 'cow';
  const kinds = [];
  while (left.cow + left.lamb > 0) {
    const kind = left[next] > 0 ? next : other(next);
    kinds.push(kind);
    left[kind]--;
    next = other(kind);
  }
  const { min, max } = fieldBounds('cow');
  const gap = (max - min) / (kinds.length + 1);
  return kinds.map((kind, i) => createAnimal(i, kind, min + gap * (i + 1)));
}

export function updateAnimal(a, dt, rng) {
  if (a.state === 'field') {
    a.wanderTimer -= dt;
    if (a.wanderTimer <= 0) {
      const [lo, hi] = ANIMALS.wanderTime;
      a.wanderTimer = lo + rng() * (hi - lo);
      a.vx = rng() < ANIMALS.idleChance ? 0 : (rng() < 0.5 ? -1 : 1) * ANIMALS.wanderSpeed[a.kind];
    }
    a.x += a.vx * dt;
    const { min, max } = fieldBounds(a.kind);
    if (a.x < min) {
      a.x = min;
      a.vx = Math.abs(a.vx);
    } else if (a.x > max) {
      a.x = max;
      a.vx = -Math.abs(a.vx);
    }
    return null;
  }

  if (a.state === 'falling') {
    a.vy += ANIMALS.gravity * dt;
    a.y += a.vy * dt;
    if (a.y >= ARENA.groundY) return land(a);
  }
  return null;
}

/** Touch down. Returns the pen it landed in, or null for the field. */
function land(a) {
  a.y = ARENA.groundY;
  a.vy = 0;
  a.vx = 0;
  const side = penAt(a.x);
  if (side) {
    a.state = 'penned';
    a.pen = side;
    a.owner ??= side;
  } else {
    a.state = 'field';
    a.pen = null;
    a.wanderTimer = 0;
  }
  return side;
}

export function drop(a, delivering = false) {
  a.state = 'falling';
  a.hookedBy = null;
  a.delivering = delivering;
  a.vy = 0;
}
