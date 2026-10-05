// Computer player. Pure logic: reads the world, returns the same kind of input
// a person produces (-1/0/+1 per axis, shoot presses, a held fire key).
// It re-decides every `skill.react` seconds and holds its keys in between.
// Used for the single-player CPU and by the balance simulator (scripts/sim.js).

import { ARENA, SAUCER, POWERUP, ROUND, HOOK, ANIMALS } from '../config.js';
import { scores } from './scoring.js';
import { hasPower } from './powerup.js';
import { topSpeed } from './saucer.js';
import { outOfShots } from './world.js';
import { HAZARDS } from './hook.js';

const other = (side) => (side === 'red' ? 'blue' : 'red');
const LOW = ARENA.flightBottom - 12; // lowest hover height for hooking
const TRAVEL = 330; // cruising height, above where the beam reaches the ground

/** A hover height to hook `a` from: anywhere the beam reaches it from, with
 * low down most likely and the top of that band least likely. */
function hookHeight(a, rng) {
  const top = ARENA.groundY - ANIMALS.size[a.kind].h;
  const highest = top - HOOK.reach - SAUCER.halfHeight + 8; // a little margin
  const u = 1 - Math.sqrt(rng()); // 0..1, density falling linearly from 0 (low) to 1 (high)
  return LOW - u * Math.max(0, LOW - highest);
}

/** Digital steering toward `target` on one axis: press, release or brake. */
function axis(pos, vel, target, gain, max) {
  const desired = Math.max(-max, Math.min(max, (target - pos) * gain));
  const dv = desired - vel;
  return Math.abs(dv) < 30 ? 0 : Math.sign(dv);
}

/**
 * `skill`:
 *   gain         how hard it steers toward targets
 *   react        seconds between decisions
 *   aim          how close in height (px) before it fires
 *   hunter       chance to chase an opponent who is lifting
 *   huntWithGun  the same, while holding a laser, triple shot or infinite ammo
 *   picky        only shoot at an opponent who is lifting or carrying
 *   sloppy       share of lifts where it lets go of the keys once the beam grabs
 *   jitter       steering noise, px
 *   raid         steal from the opponent's pen when losing in the second half,
 *                and fetch a wolf from the field to drop on the opponent's lambs
 *   carryLow     fly home low while carrying, so a hit doesn't splat the animal
 */
export function createBot(side, rng, skill, roundLength = ROUND.length) {
  let letGo = false;
  let lifting = null; // the animal we decided `letGo` for
  let wait = 0;
  let held = { x: 0, y: 0, shoot: false, fire: false };
  let mode = 'collect';
  let hoverFor = null; // the thing we picked a hover height for
  let hoverY = LOW;
  /** Hover height for hooking `a`, picked once per target. */
  function hoverAt(a) {
    if (hoverFor !== a) {
      hoverFor = a;
      hoverY = hookHeight(a, rng);
    }
    return hoverY;
  }
  /** Height to fly at toward `a`: above the beam's reach while far off (passing
   * through it slowly would start a pickup early), then down to the hover height. */
  function approach(a, s) {
    return Math.abs(a.x - s.x) > 180 ? TRAVEL : hoverAt(a);
  }

  function pickTarget(w, s, elapsed) {
    let best = null;
    let bestD = Infinity;
    // Raid the opponent's pen with the steal power-up, or when losing in the
    // second half. Always want the green man and unclaimed gold.
    const p = scores(w.animals);
    const losing = skill.raid && p[side] < p[other(side)] && elapsed > roundLength / 2;
    const stealPenalty = hasPower(w.powers, side, 'steal') || losing ? -300 : 150;
    const wantsAmmo = w.weapons[side].ammo <= 3;
    const theirLambs = w.animals.filter((a) => a.kind === 'lamb' && a.state === 'penned' && a.pen === other(side)).length;
    const wolves = skill.raid && theirLambs >= 2 ? w.wolves : [];
    for (const a of [...w.animals, ...w.drops, ...wolves]) {
      const eligible = (a.state === 'field' || (a.state === 'penned' && a.pen !== side)) && a.hookedBy === null;
      if (!eligible) continue;
      const unpaidGold = a.golden && a.goldenValue == null;
      const prize = a.kind === 'wolf' || a.kind === 'greenman' || a.kind === 'package' || unpaidGold || (a.kind === 'crate' && wantsAmmo);
      const d = Math.abs(a.x - s.x) + (a.state === 'penned' ? stealPenalty : 0) + (prize ? -400 : 0);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  return {
    skill,
    /** Input for this step. `elapsed` is seconds since the round started. */
    think(w, dt, elapsed) {
      wait -= dt;
      if (wait > 0) return { ...held, shoot: false };
      wait = skill.react;

      const s = w.saucers[side];
      const o = w.saucers[other(side)];
      const hook = w.hooks[side];
      const theirs = w.hooks[other(side)];
      const weapon = w.weapons[side];
      const laser = hasPower(w.powers, side, 'laser');
      const triple = hasPower(w.powers, side, 'triple');
      const endless = hasPower(w.powers, side, 'unlimited');
      // No point chasing or shooting at a shield.
      const shielded = hasPower(w.powers, other(side), 'shield');
      const rocket = hasPower(w.powers, side, 'rocket');
      const bomb = hasPower(w.powers, side, 'bomb') || hasPower(w.powers, side, 'timeBomb');
      const theirPen = ARENA.pens[other(side)];
      const theirPenX = (theirPen.left + theirPen.right) / 2;
      const inTheirPen = w.animals.filter((a) => a.state === 'penned' && a.pen === other(side)).length;
      let tx; // where to steer: every branch below sets both
      let ty;
      let dropBomb = false;
      let letGoOfIt = false;
      let ramming = false;
      // Trouble on the beam (a wolf, a time bomb) goes to their pen.
      const carried = [hook.carrying, hook.second];
      const carriedHazard = carried.some((a) => HAZARDS.has(a?.kind));
      const carriedBomb = carried.find((a) => a?.kind === 'timebomb');
      const overOwnPen = s.x >= ARENA.pens[side].left - 20 && s.x <= ARENA.pens[side].right + 20;
      // A time bomb about to go off is let go of anywhere but over our own pen.
      const bail = carriedBomb && carriedBomb.fuse < 1.2 && !overOwnPen;
      // Trouble in our pen: get it out, unless the bomb is too close to going off.
      const trouble = [...w.wolves, ...w.timeBombs].find(
        (a) => a.state === 'penned' && a.pen === side && a.hookedBy === null && (a.kind === 'wolf' || a.fuse > 3),
      );

      // With the twin beam, grab a second animal on the way if one is close.
      const second =
        hook.carrying && !hook.second && !hook.target && hasPower(w.powers, side, 'twin')
          ? w.animals.find((a) => a.state === 'field' && a.hookedBy === null && Math.abs(a.x - s.x) < 300)
          : null;

      if (carriedHazard) {
        // Over their pen and let it go. Low down: a wolf dropped from up high opens a
        // parachute and takes seconds to land; a bomb is nearer its target as well.
        tx = theirPenX;
        ty = LOW - 20;
        letGoOfIt = bail || Math.abs(s.x - theirPenX) < 30;
      } else if (second) {
        tx = second.x;
        ty = approach(second, s);
      } else if (hook.carrying && !hook.target) {
        // Home, coming down low over the pen so the animals are let go safely.
        const pen = ARENA.pens[side];
        tx = (pen.left + pen.right) / 2;
        ty = skill.carryLow || Math.abs(s.x - tx) < 280 ? LOW - 20 : 360;
        mode = 'collect';
      } else if (bomb && !hook.target && inTheirPen > 0) {
        // Fly over their pen and let it go.
        tx = theirPenX;
        ty = 330;
        dropBomb = Math.abs(s.x - theirPenX) < 30;
      } else if (hook.target) {
        if (lifting !== hook.target) {
          lifting = hook.target;
          letGo = rng() < skill.sloppy;
        }
        if (letGo) {
          held = { x: 0, y: 0, shoot: false, fire: false };
          return held;
        }
        tx = hook.target.x;
        ty = s.y;
      } else if (trouble) {
        tx = trouble.x;
        ty = approach(trouble, s);
      } else {
        const armed = weapon.ammo > 0 || laser || triple || endless;
        const hunter = laser || triple || endless ? Math.max(skill.huntWithGun, skill.hunter) : skill.hunter;
        // A carrier is worth chasing too: a hit knocks its animal loose.
        const prey = theirs.target || theirs.carrying;
        // Out of shots, it rams a carrier instead, if one is close and level.
        const rammable = theirs.carrying && Math.abs(o.x - s.x) < 450 && Math.abs(o.y - s.y) < 60;
        if (mode === 'collect' && prey && !shielded && rng() < hunter) {
          if (armed) mode = 'hunt';
          else if (rammable) mode = 'ram';
        }
        if (mode === 'hunt' && (!prey || shielded || !armed)) mode = 'collect';
        if (mode === 'ram' && (!theirs.carrying || shielded || armed || Math.abs(o.y - s.y) > 120)) mode = 'collect';
        if (mode === 'ram') {
          ramming = true;
          tx = o.x;
          ty = o.y;
        } else if (mode === 'hunt') {
          tx = s.x;
          ty = o.y;
        } else {
          const a = pickTarget(w, s, elapsed);
          if (a) {
            tx = a.x;
            ty = approach(a, s);
          } else {
            // Nothing to fetch: wait mid-field, not over our own pen (that spooks the animals).
            tx = 640;
            ty = 380;
          }
        }
      }

      const top = topSpeed(s, hasPower(w.powers, side, 'speed') ? POWERUP.speedBoost : 1) * (outOfShots(w, side) ? SAUCER.outOfAmmoBoost : 1);
      const aligned = Math.abs(o.y - s.y) < skill.aim + (triple ? POWERUP.tripleSpread : 0);
      const target = theirs.target || theirs.carrying;
      const worthIt = !shielded && (skill.picky ? target : target || mode === 'hunt' || rng() < 0.05);
      held = {
        // Ramming: full speed at it, no braking.
        x: ramming ? Math.sign(o.x - s.x) : axis(s.x, s.vx, tx + (rng() - 0.5) * skill.jitter, skill.gain, top),
        // Ramming: hold the line once level, so momentum builds.
        y: ramming && Math.abs(o.y - s.y) < 16 ? 0 : axis(s.y, s.vy, ty, skill.gain, top),
        // While carrying, shoot drops what it carries: only ever a wolf, on purpose.
        shoot: hook.carrying
          ? letGoOfIt
          : rocket
            ? Boolean(target)
            : bomb
              ? dropBomb
              : Boolean(aligned && worthIt && (weapon.ammo > 0 || triple || endless)),
        fire: aligned && laser,
      };
      return held;
    },
  };
}
