// One round's simulation state. Pure: no rendering, no DOM.
// `events` collects things that happened during the last step, for audio and particles.

import { HOOK, POWERUP } from '../config.js';
import { createSaucer, steerSaucer, moveSaucer, bumpSaucers } from './saucer.js';
import { createWeapon, tryFire, updateWeapon } from './weapon.js';
import { createProjectile, updateProjectile, applyKnockback, fireDirection } from './projectile.js';
import { createHerd, updateAnimal } from './animal.js';
import { createHook, updateHook, interruptHook, dropCarried } from './hook.js';
import { createDrop, updateDrop, createPowers, grantPower, hasPower, updatePowers, laserBeam } from './powerup.js';
import { createRng } from './rng.js';
import { animalValue } from './scoring.js';

export const SIDES = ['red', 'blue'];

export function opponent(side) {
  return side === 'red' ? 'blue' : 'red';
}

export function createWorld(seed) {
  return {
    saucers: { red: createSaucer('red'), blue: createSaucer('blue') },
    weapons: { red: createWeapon(), blue: createWeapon() },
    hooks: { red: createHook('red'), blue: createHook('blue') },
    animals: createHerd(),
    projectiles: [],
    drop: null, // the green man, once he has dropped
    powers: createPowers(),
    lasers: { red: null, blue: null }, // active laser beams, for hit tests and drawing
    events: [],
    rng: createRng(seed),
  };
}

/** Send in the green man carrying `power`. */
export function spawnDrop(w, power) {
  w.drop = createDrop(power, w.rng);
  w.events.push({ type: 'dropIncoming', power, x: w.drop.x });
}

const NO_INPUT = { x: 0, y: 0, shoot: false, fire: false };

function interrupt(w, side, reason) {
  const hook = w.hooks[side];
  const a = hook.target;
  if (interruptHook(hook)) w.events.push({ type: 'interrupt', side, reason, x: a.x, y: a.y });
}

/** A powered hit (laser, triple shot) can also knock a carried animal loose. */
function knockLoose(w, shooter, targetSide) {
  const powered = hasPower(w.powers, shooter, 'laser') || hasPower(w.powers, shooter, 'triple');
  if (!powered || !POWERUP.knockLoose) return;
  const a = dropCarried(w.hooks[targetSide]);
  if (a) w.events.push({ type: 'knockLoose', side: targetSide, kind: a.kind, x: a.x, y: a.y });
}

function fire(w, side) {
  const s = w.saucers[side];
  const target = w.saucers[opponent(side)];
  const triple = hasPower(w.powers, side, 'triple');
  if (!tryFire(w.weapons[side], triple)) {
    w.events.push({ type: 'dryFire', side });
    return;
  }
  const offsets = triple ? [-POWERUP.tripleSpread, 0, POWERUP.tripleSpread] : [0];
  for (const dy of offsets) w.projectiles.push(createProjectile(s, target, dy));
  const p = w.projectiles.at(-1);
  w.events.push({ type: 'shot', side, x: p.x, y: s.y, triple });
}

/** Holding shoot with the laser power-up: a beam that pushes the opponent. */
function updateLaser(w, side, input, dt) {
  const on = hasPower(w.powers, side, 'laser') && input.fire;
  const was = w.lasers[side] !== null;
  if (!on) {
    w.lasers[side] = null;
    if (was) w.events.push({ type: 'laserOff', side });
    return;
  }
  const s = w.saucers[side];
  const target = w.saucers[opponent(side)];
  const beam = laserBeam(s, target, fireDirection(s, target));
  const hadHit = was && w.lasers[side].hit;
  w.lasers[side] = beam;
  if (!was) w.events.push({ type: 'laserOn', side });
  if (beam.hit) {
    target.vx += beam.dir * POWERUP.laserPush * dt;
    if (!hadHit) w.events.push({ type: 'hit', side: target.side, x: beam.x1, y: beam.y, dir: beam.dir, laser: true });
    interrupt(w, target.side, 'laser');
    knockLoose(w, side, target.side);
  }
}

/** Advance one fixed step. `inputs` is { red, blue } of { x, y, shoot, fire }:
 * `shoot` is a fresh press, `fire` is the key being held (for the laser). */
export function stepWorld(w, inputs, dt) {
  w.events.length = 0;
  const { red, blue } = w.saucers;

  updatePowers(w.powers, dt, w.events);

  for (const side of SIDES) {
    const s = w.saucers[side];
    const input = inputs[side] ?? NO_INPUT;
    const weapon = w.weapons[side];

    if (updateWeapon(weapon, dt, hasPower(w.powers, side, 'triple'))) w.events.push({ type: 'reload', side });
    if (input.shoot && !hasPower(w.powers, side, 'laser')) fire(w, side);

    const opts = {};
    if (w.hooks[side].target) {
      opts.accelScale = HOOK.beamAccel;
      opts.extraDrag = HOOK.beamDrag;
    }
    if (hasPower(w.powers, side, 'speed')) {
      opts.speedScale = POWERUP.speedBoost;
      opts.accelScale = (opts.accelScale ?? 1) * POWERUP.accelBoost;
    }
    steerSaucer(s, input, dt, opts);
    moveSaucer(s, dt);
  }

  if (bumpSaucers(red, blue)) {
    w.events.push({ type: 'bump', x: (red.x + blue.x) / 2, y: (red.y + blue.y) / 2 });
  }

  for (const side of SIDES) updateLaser(w, side, inputs[side] ?? NO_INPUT, dt);

  for (const p of w.projectiles) {
    const target = w.saucers[opponent(p.owner)];
    if (updateProjectile(p, target, dt)) {
      applyKnockback(target, p.dir);
      w.events.push({ type: 'hit', side: target.side, x: p.x, y: p.y, dir: p.dir });
      interrupt(w, target.side, 'shot');
      knockLoose(w, p.owner, target.side);
    }
  }
  w.projectiles = w.projectiles.filter((p) => p.alive);

  const targets = w.drop ? [...w.animals, w.drop] : w.animals;
  for (const side of SIDES) {
    const stealBonus = hasPower(w.powers, side, 'steal');
    updateHook(w.hooks[side], w.saucers[side], targets, dt, w.events, { stealBonus });
  }
  for (const e of w.events) if (e.type === 'powerup') grantPower(w.powers, e.side, e.power);

  if (w.drop) {
    const wasFalling = w.drop.state === 'falling';
    if (updateDrop(w.drop, dt, w.rng) || (wasFalling && w.drop.state !== 'falling')) {
      w.events.push({ type: 'dropLanded', x: w.drop.x, y: w.drop.y });
    }
  }

  for (const a of w.animals) {
    const wasFalling = a.state === 'falling';
    const pen = updateAnimal(a, dt, w.rng);
    if (wasFalling && a.state !== 'falling') {
      const delivered = a.delivering;
      a.delivering = false;
      const value = pen ? animalValue(a, pen) : 0;
      const stolen = pen !== null && a.owner !== pen;
      w.events.push({ type: 'land', kind: a.kind, pen, delivered, value, stolen, bonus: a.bonus, x: a.x, y: a.y });
    }
  }
}
