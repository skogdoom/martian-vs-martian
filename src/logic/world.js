// One round's simulation state. Pure: no rendering, no DOM.
// `events` collects things that happened during the last step, for audio and particles.

import { createSaucer, steerSaucer, moveSaucer, bumpSaucers } from './saucer.js';
import { createWeapon, tryFire, updateWeapon } from './weapon.js';
import { createProjectile, updateProjectile, applyKnockback } from './projectile.js';

export const SIDES = ['red', 'blue'];

export function opponent(side) {
  return side === 'red' ? 'blue' : 'red';
}

export function createWorld() {
  return {
    saucers: { red: createSaucer('red'), blue: createSaucer('blue') },
    weapons: { red: createWeapon(), blue: createWeapon() },
    projectiles: [],
    events: [],
  };
}

const NO_INPUT = { x: 0, y: 0, shoot: false };

/** Advance one fixed step. `inputs` is { red, blue } of { x, y, shoot }. */
export function stepWorld(w, inputs, dt) {
  w.events.length = 0;
  const { red, blue } = w.saucers;

  for (const side of SIDES) {
    const s = w.saucers[side];
    const input = inputs[side] ?? NO_INPUT;
    const weapon = w.weapons[side];

    if (updateWeapon(weapon, dt)) w.events.push({ type: 'reload', side });
    if (input.shoot) {
      if (tryFire(weapon)) {
        const p = createProjectile(s, w.saucers[opponent(side)]);
        w.projectiles.push(p);
        w.events.push({ type: 'shot', side, x: p.x, y: p.y });
      } else {
        w.events.push({ type: 'dryFire', side });
      }
    }

    steerSaucer(s, input, dt);
    moveSaucer(s, dt);
  }

  if (bumpSaucers(red, blue)) {
    w.events.push({ type: 'bump', x: (red.x + blue.x) / 2, y: (red.y + blue.y) / 2 });
  }

  for (const p of w.projectiles) {
    const target = w.saucers[opponent(p.owner)];
    if (updateProjectile(p, target, dt)) {
      applyKnockback(target, p.dir);
      w.events.push({ type: 'hit', side: target.side, x: p.x, y: p.y, dir: p.dir });
    }
  }
  w.projectiles = w.projectiles.filter((p) => p.alive);
}
