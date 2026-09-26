// Computer player. Pure logic: reads the world, returns the same kind of input
// a person produces (-1/0/+1 per axis, shoot presses, a held fire key).
// It re-decides every `skill.react` seconds and holds its keys in between.
// Used for the single-player CPU and by the balance simulator (scripts/sim.js).

import { ARENA, SAUCER, POWERUP, ROUND } from '../config.js';
import { scores } from './scoring.js';
import { hasPower } from './powerup.js';

const other = (side) => (side === 'red' ? 'blue' : 'red');
const LOW = ARENA.flightBottom - 12; // hover height for hooking

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
 *   huntWithGun  the same, while holding a laser or triple shot
 *   picky        only shoot at an opponent who is lifting or carrying
 *   sloppy       share of lifts where it lets go of the keys once the beam grabs
 *   jitter       steering noise, px
 *   raid         steal from the opponent's pen when losing in the second half
 *   carryLow     fly home low while carrying, so a hit doesn't splat the animal
 */
export function createBot(side, rng, skill) {
  let letGo = false;
  let lifting = null; // the animal we decided `letGo` for
  let wait = 0;
  let held = { x: 0, y: 0, shoot: false, fire: false };
  let mode = 'collect';

  function pickTarget(w, s, elapsed) {
    let best = null;
    let bestD = Infinity;
    // Raid the opponent's pen with the steal power-up, or when losing in the
    // second half. Always want the green man and unclaimed gold.
    const p = scores(w.animals);
    const losing = skill.raid && p[side] < p[other(side)] && elapsed > ROUND.length / 2;
    const stealPenalty = hasPower(w.powers, side, 'steal') || losing ? -300 : 150;
    const wantsAmmo = w.weapons[side].ammo <= 3;
    for (const a of [...w.animals, ...w.drops]) {
      const eligible = (a.state === 'field' || (a.state === 'penned' && a.pen !== side)) && a.hookedBy === null;
      if (!eligible) continue;
      const unpaidGold = a.golden && a.goldenValue == null;
      const prize = a.kind === 'greenman' || a.kind === 'package' || unpaidGold || (a.kind === 'crate' && wantsAmmo);
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
      const rocket = hasPower(w.powers, side, 'rocket');
      const bomb = hasPower(w.powers, side, 'bomb');
      const theirPen = ARENA.pens[other(side)];
      const theirPenX = (theirPen.left + theirPen.right) / 2;
      const inTheirPen = w.animals.filter((a) => a.state === 'penned' && a.pen === other(side)).length;
      let tx = s.x;
      let ty = s.y;
      let dropBomb = false;

      // With the twin beam, grab a second animal on the way if one is close.
      const second =
        hook.carrying && !hook.second && !hook.target && hasPower(w.powers, side, 'twin')
          ? w.animals.find((a) => a.state === 'field' && a.hookedBy === null && Math.abs(a.x - s.x) < 300)
          : null;

      if (second) {
        tx = second.x;
        ty = Math.abs(second.x - s.x) > 120 ? 380 : LOW;
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
      } else {
        const armed = weapon.ammo > 0 || laser || triple;
        const hunter = laser || triple ? Math.max(skill.huntWithGun, skill.hunter) : skill.hunter;
        // A carrier is worth chasing too: a hit knocks its animal loose.
        const prey = theirs.target || theirs.carrying;
        if (mode === 'collect' && prey && armed && rng() < hunter) mode = 'hunt';
        if (mode === 'hunt' && (!prey || !armed)) mode = 'collect';
        if (mode === 'hunt') {
          tx = s.x;
          ty = o.y;
        } else {
          const a = pickTarget(w, s, elapsed);
          if (a) {
            tx = a.x;
            ty = Math.abs(a.x - s.x) > 120 ? 380 : LOW;
          } else {
            // Nothing to fetch: wait mid-field, not over our own pen (that spooks the animals).
            tx = 640;
            ty = 380;
          }
        }
      }

      const top = SAUCER.maxSpeed * (hasPower(w.powers, side, 'speed') ? POWERUP.speedBoost : 1);
      const aligned = Math.abs(o.y - s.y) < skill.aim + (triple ? POWERUP.tripleSpread : 0);
      const target = theirs.target || theirs.carrying;
      const worthIt = skill.picky ? target : target || mode === 'hunt' || rng() < 0.05;
      held = {
        x: axis(s.x, s.vx, tx + (rng() - 0.5) * skill.jitter, skill.gain, top),
        y: axis(s.y, s.vy, ty, skill.gain, top),
        // While carrying, shoot would drop the animal: never do that.
        shoot: hook.carrying
          ? false
          : rocket
            ? Boolean(target)
            : bomb
              ? dropBomb
              : Boolean(aligned && worthIt && (weapon.ammo > 0 || triple)),
        fire: aligned && laser,
      };
      return held;
    },
  };
}
