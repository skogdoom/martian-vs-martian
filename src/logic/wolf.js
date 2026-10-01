// The wolf: some rounds it parachutes into the field and eats every lamb it
// can reach. In the field that means lambs in the field (they run from it);
// dropped into a pen, the lambs in that pen. It is hooked and carried like an
// animal, but is never let go of automatically: the shoot key drops it. When
// there has been nothing to eat for a while it gets bored and runs off.
//
// States: as an animal (descending, field, penned, lifting, carried, falling),
// plus
//   leaving  running off the edge of the screen; then gone

import { WIDTH, WOLF } from '../config.js';
import { createAnimal, parachute, updateAnimal, fieldBounds, clampToPen, fallHeight } from './animal.js';
import { dropSpot } from './powerup.js';

export function createWolf(rng) {
  const w = createAnimal('wolf', 'wolf', dropSpot('wolf', rng));
  w.eating = 0; // seconds left on the current lamb
  w.bored = 0; // seconds with nothing in reach
  parachute(w);
  return w;
}

/** The lambs it can get at from where it stands. */
export function reachableLambs(wolf, animals) {
  if (wolf.state === 'field') return animals.filter((a) => a.kind === 'lamb' && a.state === 'field' && a.hookedBy === null);
  if (wolf.state === 'penned') return animals.filter((a) => a.kind === 'lamb' && a.state === 'penned' && a.pen === wolf.pen);
  return [];
}

function nearest(wolf, lambs) {
  let best = null;
  for (const a of lambs) if (!best || Math.abs(a.x - wolf.x) < Math.abs(best.x - wolf.x)) best = a;
  return best;
}

/** Lambs in the field run from a wolf in the field. */
function scare(wolf, animals) {
  if (wolf.state !== 'field') return;
  for (const a of animals) {
    if (a.kind !== 'lamb' || a.state !== 'field' || a.hookedBy !== null) continue;
    const dx = a.x - wolf.x;
    if (Math.abs(dx) > WOLF.scareRange) continue;
    a.vx = (Math.sign(dx) || 1) * WOLF.fleeSpeed;
    a.wanderTimer = 0.5;
  }
}

function leave(wolf, events) {
  wolf.state = 'leaving';
  wolf.vx = (wolf.x < WIDTH / 2 ? -1 : 1) * WOLF.leaveSpeed;
  wolf.pen = null;
  events.push({ type: 'wolfLeaves', x: wolf.x, y: wolf.y });
}

/** Advance one step; pushes events into `events`. */
export function updateWolf(wolf, animals, dt, rng, events) {
  const { state } = wolf;
  if (state === 'descending' || state === 'falling') {
    // Dropped from up high: a parachute opens on the way down.
    if (state === 'falling' && !wolf.chute && fallHeight(wolf) > WOLF.chuteHeight) {
      wolf.chute = true;
      events.push({ type: 'wolfChute', x: wolf.x, y: wolf.y });
    }
    const result = updateAnimal(wolf, dt, rng);
    if (result === 'touchdown') events.push({ type: 'dropLanded', x: wolf.x, y: wolf.y });
    else if (state === 'falling' && wolf.state !== 'falling') {
      events.push({ type: 'wolfLand', pen: wolf.pen, by: wolf.droppedBy, x: wolf.x, y: wolf.y });
      wolf.droppedBy = null;
      wolf.bored = 0;
    }
    return;
  }
  if (state === 'leaving') {
    wolf.x += wolf.vx * dt;
    if (wolf.x < -60 || wolf.x > WIDTH + 60) {
      wolf.state = 'gone';
      wolf.vx = 0;
    }
    return;
  }
  if (state !== 'field' && state !== 'penned') return; // lifted or carried: harmless

  scare(wolf, animals);
  if (wolf.eating > 0) {
    wolf.eating = Math.max(0, wolf.eating - dt);
    wolf.vx = 0;
    return;
  }
  const prey = nearest(wolf, reachableLambs(wolf, animals));
  if (!prey) {
    wolf.bored += dt;
    if (wolf.bored >= WOLF.boredAfter) leave(wolf, events);
    else if (state === 'field')
      updateAnimal(wolf, dt, rng); // pace about
    else wolf.vx = 0;
    return;
  }
  wolf.bored = 0;
  const dx = prey.x - wolf.x;
  if (Math.abs(dx) <= WOLF.bite) {
    events.push({ type: 'wolfEat', pen: prey.pen, golden: Boolean(prey.golden), x: prey.x, y: prey.y });
    prey.state = 'gone';
    prey.pen = null;
    wolf.eating = WOLF.eatTime;
    wolf.vx = 0;
    return;
  }
  wolf.vx = Math.sign(dx) * WOLF.speed;
  const x = wolf.x + wolf.vx * dt;
  // Don't overshoot the lamb.
  wolf.x = Math.abs(x - prey.x) < Math.abs(dx) ? x : prey.x;
  if (state === 'field') {
    const { min, max } = fieldBounds('wolf');
    wolf.x = Math.max(min, Math.min(max, wolf.x));
  } else {
    wolf.x = clampToPen(wolf.x, 'wolf', wolf.pen);
  }
}
