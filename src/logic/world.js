// One round's simulation state. Pure: no rendering, no DOM.
// `events` collects things that happened during the last step, for audio and particles.

import { HOOK, COMBAT, POWERUP, AMMO_CRATE, RESTOCK, SPOOK } from '../config.js';
import { createSaucer, steerSaucer, moveSaucer, bumpSaucers } from './saucer.js';
import { createWeapon, tryFire, updateWeapon, addAmmo } from './weapon.js';
import { createProjectile, updateProjectile, applyKnockback, fireDirection } from './projectile.js';
import { createHerd, updateAnimal, fallHeight, createAnimal, parachute, fieldBounds } from './animal.js';
import { createHook, updateHook, interruptHook, dropCarried, releaseCarried, isOverOwnPen } from './hook.js';
import { createDrop, createCrate, dropSpot, createPowers, grantPower, hasPower, updatePowers, laserBeam } from './powerup.js';
import { createRng } from './rng.js';
import { animalValue } from './scoring.js';
import { createRocket, updateRocket, rocketKnockback, createBomb, updateBomb, blastPen, bounceOut } from './ordnance.js';
import { createGolden, settleGolden } from './golden.js';
import { createWolf, updateWolf } from './wolf.js';

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
    rockets: [], // homing rockets in flight
    bombs: [], // pen bombs falling
    drops: [], // things that parachuted in and climb aboard: the green man, ammo crates
    wolves: [], // hooked and carried like animals, but they eat lambs (wolf.js)
    powers: createPowers(),
    lasers: { red: null, blue: null }, // active laser beams, for hit tests and drawing
    fieldEmptyFor: 0, // seconds the field has had no animals in it
    spook: { red: 0, blue: 0 }, // seconds each saucer has hovered over its own pen
    spookNext: { red: 0, blue: 0 }, // countdown to the next animal jumping out
    events: [],
    rng: createRng(seed),
  };
}

/** Send in a golden cow or lamb for `trailing`, the player who is behind. */
export function spawnGolden(w, trailing) {
  const a = createGolden(w.rng);
  w.animals.push(a);
  w.events.push({ type: 'goldenIncoming', kind: a.kind, side: trailing, x: a.x });
}

/** Send in the wolf. */
export function spawnWolf(w) {
  const wolf = createWolf(w.rng);
  w.wolves.push(wolf);
  w.events.push({ type: 'wolfIncoming', x: wolf.x });
}

/** Send in the green man carrying `power` (or a mystery package hiding it). */
export function spawnDrop(w, power, mystery = false) {
  const d = createDrop(power, w.rng, mystery);
  w.drops.push(d);
  w.events.push({ type: 'dropIncoming', power: mystery ? null : power, mystery, x: d.x });
}

function parachuteAnimals(w, count, reason) {
  for (let i = 0; i < count; i++) {
    const kind = w.rng() < 0.5 ? 'cow' : 'lamb';
    const a = createAnimal(`restock-${w.animals.length}`, kind, dropSpot(kind, w.rng));
    parachute(a);
    w.animals.push(a);
  }
  w.events.push({ type: 'restock', count, reason });
}

/** Fresh animals when every one has splatted, or the field has stood empty too long. */
function restock(w, dt) {
  const alive = w.animals.filter((a) => a.state !== 'gone').length;
  if (alive <= RESTOCK.aliveAtMost) {
    parachuteAnimals(w, RESTOCK.count, 'dead');
    return;
  }
  const inField = w.animals.some((a) => a.state === 'field' || a.state === 'descending');
  w.fieldEmptyFor = inField ? 0 : w.fieldEmptyFor + dt;
  if (w.fieldEmptyFor >= RESTOCK.emptyFieldAfter) {
    w.fieldEmptyFor = 0;
    parachuteAnimals(w, RESTOCK.emptyFieldCount, 'emptyField');
  }
}

/** Hovering over your own pen too long spooks the animals in it out into the field. */
function spookPens(w, dt) {
  for (const side of SIDES) {
    if (!isOverOwnPen(w.saucers[side])) {
      w.spook[side] = 0;
      w.spookNext[side] = 0;
      continue;
    }
    w.spook[side] += dt;
    if (w.spook[side] < SPOOK.after) continue;
    w.spookNext[side] -= dt;
    if (w.spookNext[side] > 0) continue;
    w.spookNext[side] = SPOOK.every;
    const penned = w.animals.filter((a) => a.state === 'penned' && a.pen === side);
    if (!penned.length) continue;
    const a = penned[Math.floor(w.rng() * penned.length)];
    const from = { x: a.x, y: a.y };
    bounceOut(a, w.rng, { fire: false });
    w.events.push({ type: 'spooked', side, kind: a.kind, ...from });
  }
}

/** Send in an ammo crate because `side` ran out. */
export function spawnCrate(w, side) {
  const c = createCrate(w.rng);
  w.drops.push(c);
  w.events.push({ type: 'crateIncoming', side, x: c.x });
}

export function crateInPlay(w) {
  return w.drops.some((d) => d.kind === 'crate' && d.state !== 'gone');
}

export function dropInPlay(w) {
  return w.drops.some((d) => d.state !== 'gone');
}

/** No cows or lambs left in the field (or on their way down to it). */
export function fieldEmpty(w) {
  return !w.animals.some((a) => a.state === 'field' || a.state === 'descending');
}

/** Cow rain / lamb rain: every animal of one kind standing in the field
 * bursts, and one of the other kind parachutes down in its place. */
function animalRain(w, side, power) {
  const [from, to] = power === 'cowRain' ? ['lamb', 'cow'] : ['cow', 'lamb'];
  const victims = w.animals.filter((a) => a.kind === from && a.state === 'field' && !a.golden);
  const { min, max } = fieldBounds(to);
  for (const a of victims) {
    a.state = 'gone';
    a.onFire = false;
    w.events.push({ type: 'burst', kind: from, x: a.x, y: a.y });
    const b = createAnimal(`rain-${w.animals.length}`, to, Math.max(min, Math.min(max, a.x)));
    parachute(b);
    w.animals.push(b);
  }
  w.events.push({ type: 'animalRain', side, from, to, count: victims.length });
}

const shielded = (w, side) => hasPower(w.powers, side, 'shield');

const NO_INPUT = { x: 0, y: 0, shoot: false, fire: false };

function interrupt(w, side, reason) {
  const hook = w.hooks[side];
  const a = hook.target;
  if (interruptHook(hook)) w.events.push({ type: 'interrupt', side, reason, x: a.x, y: a.y });
}

/** A hit knocks a carried animal loose; it flies off with the saucer's
 * speed from just before the hit. */
function knockLoose(w, targetSide) {
  if (!COMBAT.knockLoose) return;
  const a = dropCarried(w.hooks[targetSide], w.saucers[targetSide]);
  if (a) w.events.push({ type: 'knockLoose', side: targetSide, kind: a.kind, x: a.x, y: a.y });
}

function fire(w, side) {
  const s = w.saucers[side];
  const target = w.saucers[opponent(side)];
  // While carrying, the shoot key lets go of an animal instead.
  const released = releaseCarried(w.hooks[side], s);
  if (released) {
    w.events.push({ type: 'release', side, kind: released.kind, x: released.x, y: released.y, height: fallHeight(released) });
    return;
  }
  // Single-use power-ups take the place of the next shot.
  if (hasPower(w.powers, side, 'rocket')) {
    const r = createRocket(s, target);
    w.rockets.push(r);
    w.powers[side] = null;
    w.events.push({ type: 'rocketLaunch', side, x: r.x, y: r.y });
    return;
  }
  if (hasPower(w.powers, side, 'bomb')) {
    w.bombs.push(createBomb(s));
    w.powers[side] = null;
    w.events.push({ type: 'bombDrop', side, x: s.x, y: s.y });
    return;
  }
  const triple = hasPower(w.powers, side, 'triple');
  if (!tryFire(w.weapons[side], triple, hasPower(w.powers, side, 'unlimited'))) {
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
    const shield = shielded(w, target.side);
    if (!hadHit) w.events.push({ type: 'hit', side: target.side, x: beam.x1, y: beam.y, dir: beam.dir, laser: true, shielded: shield });
    if (shield) return;
    target.vx += beam.dir * POWERUP.laserPush * dt;
    interrupt(w, target.side, 'laser');
    knockLoose(w, target.side);
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
    // A stunned saucer spins out: its controls do nothing.
    s.stun = Math.max(0, s.stun - dt);
    const input = s.stun > 0 ? NO_INPUT : (inputs[side] ?? NO_INPUT);
    const weapon = w.weapons[side];

    const endless = hasPower(w.powers, side, 'unlimited');
    if (updateWeapon(weapon, dt, hasPower(w.powers, side, 'triple'), endless)) w.events.push({ type: 'reload', side });
    const carrying = w.hooks[side].carrying !== null;
    if (input.shoot && (carrying || !hasPower(w.powers, side, 'laser'))) fire(w, side);

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

  if (bumpSaucers(red, blue, { aFixed: shielded(w, 'red'), bFixed: shielded(w, 'blue') })) {
    w.events.push({ type: 'bump', x: (red.x + blue.x) / 2, y: (red.y + blue.y) / 2 });
  }

  for (const side of SIDES) updateLaser(w, side, w.saucers[side].stun > 0 ? NO_INPUT : (inputs[side] ?? NO_INPUT), dt);

  for (const p of w.projectiles) {
    const target = w.saucers[opponent(p.owner)];
    if (updateProjectile(p, target, dt)) {
      if (shielded(w, target.side)) {
        w.events.push({ type: 'hit', side: target.side, x: p.x, y: p.y, dir: p.dir, shielded: true });
        continue;
      }
      knockLoose(w, target.side); // before the knockback: it keeps the saucer's own speed
      applyKnockback(target, p.dir);
      w.events.push({ type: 'hit', side: target.side, x: p.x, y: p.y, dir: p.dir });
      interrupt(w, target.side, 'shot');
    }
  }
  w.projectiles = w.projectiles.filter((p) => p.alive);

  for (const r of w.rockets) {
    const target = w.saucers[opponent(r.owner)];
    const result = updateRocket(r, target, dt);
    if (result === 'hit' && shielded(w, target.side)) {
      w.events.push({ type: 'hit', side: target.side, x: r.x, y: r.y, dir: Math.sign(Math.cos(r.angle)) || 1, rocket: true, shielded: true });
    } else if (result === 'hit') {
      knockLoose(w, target.side);
      rocketKnockback(r, target);
      target.stun = POWERUP.rocketStun;
      w.events.push({ type: 'hit', side: target.side, x: r.x, y: r.y, dir: Math.sign(Math.cos(r.angle)) || 1, rocket: true });
      interrupt(w, target.side, 'rocket');
    }
    if (result) w.events.push({ type: 'explosion', x: r.x, y: r.y, big: result === 'hit' });
  }
  w.rockets = w.rockets.filter((r) => r.alive);

  for (const b of w.bombs) {
    if (!updateBomb(b, dt)) continue;
    const { pen, launched } = blastPen(w.animals, b.x, w.rng);
    w.events.push({ type: 'explosion', x: b.x, y: b.y, big: true });
    w.events.push({ type: 'bombBlast', side: b.owner, pen, count: launched.length, x: b.x, y: b.y });
  }
  w.bombs = w.bombs.filter((b) => b.alive);

  const targets = w.drops.length || w.wolves.length ? [...w.animals, ...w.drops, ...w.wolves] : w.animals;
  for (const side of SIDES) {
    const stealBonus = hasPower(w.powers, side, 'steal');
    const twin = hasPower(w.powers, side, 'twin');
    const stunned = w.saucers[side].stun > 0;
    updateHook(w.hooks[side], w.saucers[side], targets, dt, w.events, { stealBonus, twin, stunned });
  }
  for (const e of [...w.events]) {
    if (e.type === 'powerup' && POWERUP.instant.includes(e.power)) animalRain(w, e.side, e.power);
    else if (e.type === 'powerup') grantPower(w.powers, e.side, e.power);
    if (e.type === 'ammoCrate') addAmmo(w.weapons[e.side], AMMO_CRATE.refill);
  }

  for (const d of w.drops) {
    if (d.state === 'gone') continue;
    const wasFalling = d.state === 'falling';
    if (updateAnimal(d, dt, w.rng) === 'touchdown' || (wasFalling && d.state !== 'falling')) {
      w.events.push({ type: 'dropLanded', x: d.x, y: d.y });
    }
  }

  for (const wolf of w.wolves) updateWolf(wolf, w.animals, dt, w.rng, w.events);

  for (const a of w.animals) {
    const wasFalling = a.state === 'falling';
    const result = updateAnimal(a, dt, w.rng);
    if (result === 'touchdown') w.events.push({ type: 'dropLanded', x: a.x, y: a.y });
    if (result === 'splat') {
      w.events.push({ type: 'splat', id: a.id, kind: a.kind, golden: Boolean(a.golden), x: a.x, y: a.y });
      a.droppedBy = null;
    } else if (wasFalling && a.state !== 'falling') {
      const pen = result;
      // A delivery: let go on purpose and landed in the pen of whoever let go.
      const delivered = a.droppedBy !== null && pen === a.droppedBy;
      a.droppedBy = null;
      if (delivered && a.golden) settleGolden(w.animals, a, pen);
      const value = pen ? animalValue(a, pen) : 0;
      const stolen = pen !== null && a.owner !== pen;
      const golden = a.goldenValue != null;
      w.events.push({ type: 'land', id: a.id, kind: a.kind, pen, delivered, value, stolen, bonus: a.bonus, golden, x: a.x, y: a.y });
    }
  }

  spookPens(w, dt);
  restock(w, dt);
}
