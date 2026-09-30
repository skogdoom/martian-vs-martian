// Cows and lambs: wandering, falling and landing in pens.
//
// States:
//   field    wandering between the pen fences
//   penned   standing still in a pen
//   lifting  frozen in a tractor beam (see hook.js)
//   carried  attached under a saucer
//   falling  dropped from a beam or a delivery
//   gone     burst after falling too far (see SPLAT), out of the round
//
// Drops from the sky (the green man, golden animals) start out
//   descending  floating down under a parachute
// and the green man ends as
//   gone        climbed into a saucer
//
// `y` is the animal's feet. `pen` is the pen it counts toward, `owner` the
// player who first delivered it.

import { WIDTH, ARENA, ANIMALS, POWERUP, SPLAT } from '../config.js';

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
    droppedBy: null, // the player who let go of it (a delivery if it lands in their pen)
    fallFrom: 0, // y it started falling from
    safeFall: false, // thrown by a bomb: lands safely whatever the height
    onFire: false, // cosmetic: set by a bomb blast, put out when picked up
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

/** Start `a` floating down from above the arena under a parachute. */
export function parachute(a) {
  a.state = 'descending';
  a.y = -20;
}

/** Advance one step. Returns the pen it landed in (or null) on the step it
 * lands from a fall, and 'touchdown' when a parachute lands; otherwise null. */
export function updateAnimal(a, dt, rng) {
  if (a.state === 'descending') {
    a.y += POWERUP.fallSpeed * dt;
    if (a.y < ARENA.groundY) return null;
    a.y = ARENA.groundY;
    // Parachuted into a pen (cow rain / lamb rain): it stays there.
    a.state = a.pen ? 'penned' : 'field';
    a.wanderTimer = 0;
    return 'touchdown';
  }

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
    a.x += a.vx * dt; // thrown from a moving saucer, or out of a pen by a bomb
    a.y += a.vy * dt;
    a.fallFrom = Math.min(a.fallFrom, a.y); // a throw upward falls from its highest point
    const half = ANIMALS.size[a.kind].w / 2;
    if (a.x < half || a.x > WIDTH - half) {
      a.x = Math.max(half, Math.min(WIDTH - half, a.x));
      a.vx = 0; // hit the wall
    }
    if (a.y >= ARENA.groundY) return land(a);
  }
  return null;
}

/** How far `a` would fall from where it is now. */
export function fallHeight(a) {
  return ARENA.groundY - a.y;
}

/** Touch down. Returns the pen it landed in, null for the field, or 'splat'
 * if a cow or lamb fell too far. */
function land(a) {
  const fell = ARENA.groundY - a.fallFrom;
  const safe = a.safeFall || (a.kind !== 'cow' && a.kind !== 'lamb');
  a.safeFall = false;
  a.y = ARENA.groundY;
  a.vy = 0;
  a.vx = 0;
  if (!safe && fell > SPLAT.height) {
    a.state = 'gone';
    a.pen = null;
    return 'splat';
  }
  const side = penAt(a.x);
  if (side) {
    a.x = clampToPen(a.x, a.kind, side);
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

/** Let `a` fall from where it is. `by` is the player letting go on purpose
 * (null for a pickup broken off or knocked loose); `vx`, `vy` its starting
 * velocity, e.g. the saucer's when thrown. */
export function drop(a, { by = null, vx = 0, vy = 0 } = {}) {
  a.state = 'falling';
  a.hookedBy = null;
  a.droppedBy = by;
  a.vx = vx;
  a.vy = vy;
  a.fallFrom = a.y;
}
