// One round's simulation state. Pure: no rendering, no DOM.
// `events` collects things that happened during the last step, for audio and particles.

import { HOOK, COMBAT, POWERUP, AMMO_CRATE, RESTOCK, SPOOK, RAM, ANIMALS, SAUCER } from '../config.js';
import { createSaucer, steerSaucer, moveSaucer, bumpSaucers, speed } from './saucer.js';
import { createWeapon, tryFire, updateWeapon, addAmmo } from './weapon.js';
import { createProjectile, updateProjectile, applyKnockback, fireDirection } from './projectile.js';
import { createHerd, updateAnimal, fallHeight, createAnimal, parachute, fieldBounds, clampToPen } from './animal.js';
import { createHook, updateHook, interruptHook, dropCarried, releaseCarried, isOverOwnPen } from './hook.js';
import { createDrop, createCrate, dropSpot, createPowers, grantPower, hasPower, updatePowers, laserBeam } from './powerup.js';
import { createRng } from './rng.js';
import { animalValue } from './scoring.js';
import { createRocket, updateRocket, rocketKnockback, createBomb, updateBomb, blast, bounceOut, createTimeBomb } from './ordnance.js';
import { createGolden, settleGolden } from './golden.js';
import { createWolf, updateWolf } from './wolf.js';

export const SIDES = ['red', 'blue'];

export function opponent(side) {
  return side === 'red' ? 'blue' : 'red';
}

export function createWorld(seed, { ammo = COMBAT.ammoPerRound } = {}) {
  return {
    saucers: { red: createSaucer('red'), blue: createSaucer('blue') },
    weapons: { red: createWeapon(ammo), blue: createWeapon(ammo) },
    hooks: { red: createHook('red'), blue: createHook('blue') },
    animals: createHerd(),
    projectiles: [],
    rockets: [], // homing rockets in flight
    bombs: [], // pen bombs falling
    drops: [], // things that parachuted in and climb aboard: the green man, ammo crates
    wolves: [], // hooked and carried like animals, but they eat lambs (wolf.js)
    timeBombs: [], // dropped time bombs, also hooked and carried like animals
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
  w.fieldEmptyFor = inField || alive >= RESTOCK.maxAlive ? 0 : w.fieldEmptyFor + dt;
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

/** Cow rain / lamb rain: every animal of one kind standing in the field or
 * in a pen bursts, and one of the other kind parachutes down in its place.
 * One replacing a penned animal belongs to that pen from the start (it counts
 * while still coming down), with the same owner and steal bonus. */
function animalRain(w, side, power) {
  const [from, to] = power === 'cowRain' ? ['lamb', 'cow'] : ['cow', 'lamb'];
  const victims = w.animals.filter((a) => a.kind === from && (a.state === 'field' || a.state === 'penned') && !a.golden);
  const { min, max } = fieldBounds(to);
  let penned = 0;
  for (const a of victims) {
    const pen = a.state === 'penned' ? a.pen : null;
    const x = pen ? clampToPen(a.x, to, pen) : Math.max(min, Math.min(max, a.x));
    const b = createAnimal(`rain-${w.animals.length}`, to, x);
    if (pen) {
      Object.assign(b, { pen, owner: a.owner, bonus: a.bonus });
      penned++;
    }
    parachute(b);
    w.animals.push(b);
    w.events.push({ type: 'burst', kind: from, pen, x: a.x, y: a.y });
    Object.assign(a, { state: 'gone', pen: null, onFire: false });
  }
  w.events.push({ type: 'animalRain', side, from, to, count: victims.length, penned });
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

/** Count a shot hit on `s`; the third in a row dazes it. */
function countHit(w, s) {
  if (s.immune > 0) return;
  s.hits = s.sinceHit <= COMBAT.dazeWindow ? s.hits + 1 : 1;
  s.sinceHit = 0;
  if (s.hits < COMBAT.dazeHits) return;
  s.hits = 0;
  s.stun = Math.max(s.stun, COMBAT.dazeTime);
  s.immune = COMBAT.dazeTime + COMBAT.dazeGrace;
  w.events.push({ type: 'dazed', side: s.side, x: s.x, y: s.y });
}

/** A hit knocked `s` off its course (it was going `vx`, `vy`): turned more
 * than RAM.jolt degrees, it loses its momentum. Pushed on along its way, it
 * keeps it. */
function jolt(w, s, vx, vy) {
  if (s.streak === 0) return;
  const before = Math.hypot(vx, vy);
  const after = speed(s);
  const cos = before && after ? (vx * s.vx + vy * s.vy) / (before * after) : -1;
  if (cos >= Math.cos((RAM.jolt * Math.PI) / 180)) return;
  s.streak = 0;
  w.events.push({ type: 'momentumLost', side: s.side, x: s.x, y: s.y });
}

/** `side` rammed the opponent, flying along `n` (unit vector toward it):
 * it spins out, lets go of everything it carries and loses its pickup. */
function ram(w, side, n) {
  const victim = w.saucers[opponent(side)];
  w.saucers[side].streak = 0; // spent
  const x = (w.saucers.red.x + w.saucers.blue.x) / 2;
  const y = (w.saucers.red.y + w.saucers.blue.y) / 2;
  if (shielded(w, victim.side)) {
    w.events.push({ type: 'ram', side, victim: victim.side, x, y, shielded: true });
    return;
  }
  knockLoose(w, victim.side);
  knockLoose(w, victim.side); // both, with the twin beam
  interrupt(w, victim.side, 'ram');
  victim.vx += n.x * RAM.knockback;
  victim.vy += n.y * RAM.knockback * 0.3;
  victim.stun = Math.max(victim.stun, RAM.daze);
  w.events.push({ type: 'ram', side, victim: victim.side, x, y, dir: Math.sign(n.x) || 1 });
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
  if (hasPower(w.powers, side, 'timeBomb')) {
    w.timeBombs.push(createTimeBomb(s, `timebomb-${w.timeBombs.length}`));
    w.powers[side] = null;
    w.events.push({ type: 'timeBombDrop', side, x: s.x, y: s.y });
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

/** Let go of `b` wherever it is in `side`'s beam. */
function unhook(w, side, b) {
  const h = w.hooks[side];
  if (h.target === b) {
    h.target = null;
    h.progress = 0;
  }
  if (h.second === b) h.second = null;
  if (h.carrying === b) {
    h.carrying = h.second;
    h.second = null;
  }
  b.hookedBy = null;
}

/** Fuses burn down wherever the bombs are. On the ground it goes off like the
 * pen bomb (the pen it is in, or the animals near it in the field); in a beam,
 * it dazes that saucer instead. */
function updateTimeBombs(w, dt) {
  for (const b of w.timeBombs) {
    if (b.state === 'gone') continue;
    if (b.state === 'falling') {
      if (b.droppedBy) b.lastBy = b.droppedBy;
      updateAnimal(b, dt, w.rng);
      if (b.state !== 'falling') {
        w.events.push({ type: 'timeBombLand', pen: b.pen, by: b.droppedBy, x: b.x, y: b.y });
        b.droppedBy = null;
      }
    }
    const shown = Math.ceil(b.fuse - 1e-9);
    b.fuse = Math.max(0, b.fuse - dt);
    const now = Math.ceil(b.fuse - 1e-9);
    if (now !== shown && now > 0) w.events.push({ type: 'tick', n: now, x: b.x, y: b.y });
    if (b.fuse > 0) continue;

    const x = b.x;
    const y = b.y - ANIMALS.size.timebomb.h / 2;
    const held = b.hookedBy;
    const grounded = b.state === 'field' || b.state === 'penned';
    b.state = 'gone';
    w.events.push({ type: 'explosion', x, y, big: true });
    if (held) {
      unhook(w, held, b);
      knockLoose(w, held);
      knockLoose(w, held);
      const s = w.saucers[held];
      s.stun = Math.max(s.stun, POWERUP.timeBombDaze);
      w.events.push({ type: 'timeBombHeld', side: held, x, y });
    } else if (grounded) {
      const { pen, launched } = blast(w.animals, x, w.rng);
      w.events.push({ type: 'bombBlast', side: b.lastBy, pen, count: launched.length, timed: true, x, y });
    }
  }
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
    // The course it had when the beam caught it: the push turns it bit by bit.
    if (!hadHit || !target.course) target.course = { vx: target.vx, vy: target.vy };
    target.vx += beam.dir * POWERUP.laserPush * dt;
    jolt(w, target, target.course.vx, target.course.vy);
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
    s.sinceHit += dt;
    s.immune = Math.max(0, s.immune - dt);
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
    // No momentum with an animal (or anything else) on the beam.
    if (w.hooks[side].carrying) opts.momentum = false;
    if (hasPower(w.powers, side, 'speed')) {
      opts.speedScale = POWERUP.speedBoost;
      opts.accelScale = (opts.accelScale ?? 1) * POWERUP.accelBoost;
    }
    steerSaucer(s, input, dt, opts);
    moveSaucer(s, dt);
  }

  // Speeds toward each other at the moment of contact decide a ram.
  const dx = blue.x - red.x;
  const dy = blue.y - red.y;
  const d = Math.hypot(dx, dy) || 1;
  const n = { x: dx / d, y: dy / d };
  const redIn = red.vx * n.x + red.vy * n.y;
  const blueIn = -(blue.vx * n.x + blue.vy * n.y);
  if (bumpSaucers(red, blue, { aFixed: shielded(w, 'red'), bFixed: shielded(w, 'blue') })) {
    w.events.push({ type: 'bump', x: (red.x + blue.x) / 2, y: (red.y + blue.y) / 2 });
    // A carrier can't ram, even with the speed power-up.
    if (redIn >= RAM.speed && !w.hooks.red.carrying) ram(w, 'red', n);
    if (blueIn >= RAM.speed && !w.hooks.blue.carrying) ram(w, 'blue', { x: -n.x, y: -n.y });
  }

  for (const side of SIDES) updateLaser(w, side, w.saucers[side].stun > 0 ? NO_INPUT : (inputs[side] ?? NO_INPUT), dt);

  const hitNow = new Set(); // saucers shot this step: a triple-shot volley counts once
  for (const p of w.projectiles) {
    const target = w.saucers[opponent(p.owner)];
    if (updateProjectile(p, target, dt)) {
      if (shielded(w, target.side)) {
        w.events.push({ type: 'hit', side: target.side, x: p.x, y: p.y, dir: p.dir, shielded: true });
        continue;
      }
      knockLoose(w, target.side); // before the knockback: it keeps the saucer's own speed
      const { vx, vy } = target;
      applyKnockback(target, p.dir);
      jolt(w, target, vx, vy);
      w.events.push({ type: 'hit', side: target.side, x: p.x, y: p.y, dir: p.dir });
      interrupt(w, target.side, 'shot');
      if (!hitNow.has(target)) countHit(w, target);
      hitNow.add(target);
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
    const { pen, launched } = blast(w.animals, b.x, w.rng);
    w.events.push({ type: 'explosion', x: b.x, y: b.y, big: true });
    w.events.push({ type: 'bombBlast', side: b.owner, pen, count: launched.length, x: b.x, y: b.y });
  }
  w.bombs = w.bombs.filter((b) => b.alive);

  const extra = w.drops.length || w.wolves.length || w.timeBombs.length;
  const targets = extra ? [...w.animals, ...w.drops, ...w.wolves, ...w.timeBombs] : w.animals;
  for (const side of SIDES) {
    const stealBonus = hasPower(w.powers, side, 'steal');
    const twin = hasPower(w.powers, side, 'twin');
    const stunned = w.saucers[side].stun > 0;
    updateHook(w.hooks[side], w.saucers[side], targets, dt, w.events, { stealBonus, twin, stunned });
  }
  for (const e of [...w.events]) {
    if (e.type === 'powerup' && POWERUP.instant.includes(e.power)) animalRain(w, e.side, e.power);
    else if (e.type === 'powerup') grantPower(w.powers, e.side, e.power);
    if (e.type === 'ammoCrate') {
      // The refill is a share of the round's ammo (half, as in a 90 s round).
      const weapon = w.weapons[e.side];
      e.amount = Math.round((AMMO_CRATE.refill * weapon.cap) / COMBAT.ammoPerRound);
      addAmmo(weapon, e.amount);
    }
  }

  for (const d of w.drops) {
    if (d.state === 'gone') continue;
    const wasFalling = d.state === 'falling';
    if (updateAnimal(d, dt, w.rng) === 'touchdown' || (wasFalling && d.state !== 'falling')) {
      w.events.push({ type: 'dropLanded', x: d.x, y: d.y });
    }
  }

  for (const wolf of w.wolves) updateWolf(wolf, w.animals, dt, w.rng, w.events);
  updateTimeBombs(w, dt);

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
  guardFinite(w);
}

const finite = (o) => Number.isFinite(o.x) && Number.isFinite(o.y);

/** A safety net: nothing should ever end up at NaN or Infinity, but if it
 * does (a division by zero somewhere), it must not spread or freeze the
 * round. A saucer goes back to its start; anything else is taken out. */
function guardFinite(w) {
  for (const s of Object.values(w.saucers)) {
    if (finite(s) && Number.isFinite(s.vx) && Number.isFinite(s.vy)) continue;
    Object.assign(s, { x: SAUCER.startX[s.side], y: SAUCER.startY, vx: 0, vy: 0 });
  }
  for (const list of [w.animals, w.drops, w.wolves, w.timeBombs]) {
    for (const a of list) {
      if (a.state === 'gone' || finite(a)) continue;
      for (const side of SIDES) unhook(w, side, a);
      Object.assign(a, { state: 'gone', pen: null });
    }
  }
  for (const p of w.projectiles) if (!finite(p)) p.alive = false;
  for (const r of w.rockets) if (!finite(r)) r.alive = false;
}
