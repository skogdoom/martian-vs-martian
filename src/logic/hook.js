// Tractor-beam hook: automatic pickup, lift, interrupts, carrying and delivery.

import { ARENA, SAUCER, HOOK, ANIMALS, SPLAT } from '../config.js';
import { speed } from './saucer.js';
import { clampToPen, drop, fallHeight } from './animal.js';
import { spendGolden } from './golden.js';

export function createHook(side) {
  return {
    side,
    target: null, // animal being lifted
    progress: 0, // 0..1 lift progress
    startY: 0, // animal feet y when the lift began
    carrying: null, // fully lifted animal
    second: null, // a second one, under the first (twin beam power-up)
  };
}

// Drops that climb aboard when fully lifted, and the event that follows.
const BOARDS = { greenman: 'powerup', package: 'powerup', crate: 'ammoCrate' };

/** Feet y of an animal hanging under the saucer. */
export function attachY(s, a) {
  return s.y + SAUCER.halfHeight + 4 + ANIMALS.size[a.kind].h;
}

export function isOverOwnPen(s) {
  const pen = ARENA.pens[s.side];
  return s.x >= pen.left && s.x <= pen.right;
}

/** Can this saucer start hooking this animal right now? */
export function canHook(s, a) {
  if (a.hookedBy !== null) return false;
  if (a.state !== 'field' && a.state !== 'penned') return false;
  if (a.state === 'penned' && a.pen === s.side) return false;
  if (Math.abs(a.x - s.x) > HOOK.grabRadius) return false;
  const top = a.y - ANIMALS.size[a.kind].h;
  const gap = top - (s.y + SAUCER.halfHeight);
  return gap >= 0 && gap <= HOOK.reach;
}

/** The closest hookable target; a drop (green man, package, crate) within
 * reach wins over an animal, since that is what a player hovering there wants. */
function findTarget(s, animals) {
  let best = null;
  let bestDx = Infinity;
  for (const a of animals) {
    if (!canHook(s, a)) continue;
    const dx = Math.abs(a.x - s.x) - (BOARDS[a.kind] ? HOOK.grabRadius : 0);
    if (dx < bestDx) {
      best = a;
      bestDx = dx;
    }
  }
  return best;
}

/** Stop a pickup in progress; the animal drops back down. Returns true if one was stopped. */
export function interruptHook(h) {
  if (!h.target) return false;
  drop(h.target);
  h.target = null;
  h.progress = 0;
  return true;
}

/** Knock a carried animal loose (a hit); it falls where it is. The lower one
 * goes first if there are two. Returns it, or null. */
export function dropCarried(h) {
  const a = h.second ?? h.carrying;
  if (!a) return null;
  a.bonus = false;
  drop(a);
  if (a === h.second) h.second = null;
  else h.carrying = null;
  return a;
}

/** Let go of the lowest carried animal by hand (the shoot key). Over your own
 * pen it counts as a delivery; anywhere else it just falls. Returns it, or null. */
export function releaseCarried(h, s) {
  const a = h.second ?? h.carrying;
  if (!a) return null;
  const home = isOverOwnPen(s);
  if (home) a.x = clampToPen(s.x, a.kind, s.side);
  drop(a, home);
  if (a === h.second) h.second = null;
  else h.carrying = null;
  return a;
}

/** Feet y for `a` when it hangs in the next free slot: under the saucer, or
 * under the animal already carried (twin beam). */
function slotY(h, s, a) {
  if (!h.carrying || h.carrying === a) return attachY(s, a);
  return attachY(s, h.carrying) + ANIMALS.size[a.kind].h + 3;
}

/** Advance one step. Pushes events into `events`. `targets` is everything
 * hookable: the animals, plus drops (green man, crates) when around.
 * `stealBonus`: animals stolen now (lifted out of the opponent's pen) are
 * worth extra once delivered, even if the power-up has run out by then.
 * `twin`: the saucer may carry a second animal (twin beam power-up).
 * `stunned`: spinning out after a rocket hit, so no new pickups. */
export function updateHook(h, s, targets, dt, events, { stealBonus = false, twin = false, stunned = false } = {}) {
  if (h.carrying) {
    for (const a of [h.carrying, h.second]) {
      if (!a) continue;
      a.x = s.x;
      a.y = slotY(h, s, a);
    }
    // Released automatically only when low enough for a safe landing.
    if (isOverOwnPen(s) && fallHeight(h.carrying) <= SPLAT.height) {
      for (const [a, dx] of [[h.carrying, -10], [h.second, 12]]) {
        if (!a) continue;
        a.x = clampToPen(s.x + (h.second ? dx : 0), a.kind, s.side);
        drop(a, true);
        events.push({ type: 'deliver', side: s.side, kind: a.kind, x: a.x, y: a.y });
      }
      h.carrying = h.second = null;
      return;
    }
  }

  if (h.target) {
    const a = h.target;
    if (Math.abs(s.x - a.x) > HOOK.driftLimit) {
      interruptHook(h);
      events.push({ type: 'interrupt', side: s.side, reason: 'drift', x: a.x, y: a.y });
      return;
    }
    h.progress = Math.min(1, h.progress + dt / HOOK.liftTime[a.kind]);
    a.y = h.startY + (slotY(h, s, a) - h.startY) * h.progress;
    if (h.progress >= 1 && BOARDS[a.kind]) {
      // Climbs aboard: nothing to carry home.
      a.state = 'gone';
      a.hookedBy = null;
      h.target = null;
      h.progress = 0;
      events.push({ type: BOARDS[a.kind], side: s.side, power: a.power, mystery: a.kind === 'package', x: a.x, y: a.y });
    } else if (h.progress >= 1) {
      // Stolen from the opponent's pen during a steal power-up?
      a.bonus = stealBonus && a.pen !== null && a.pen !== s.side;
      spendGolden(a);
      a.state = 'carried';
      a.pen = null;
      if (h.carrying) h.second = a;
      else h.carrying = a;
      h.target = null;
      h.progress = 0;
      events.push({ type: 'pickup', side: s.side, kind: a.kind, x: a.x, y: a.y });
    }
    return;
  }

  // Room for another? One animal, or two with the twin beam. Drops that
  // climb aboard (green man, crates) only when nothing is carried.
  if (h.carrying && (!twin || h.second)) return;
  if (stunned || speed(s) > HOOK.stillSpeed) return;
  const a = findTarget(s, h.carrying ? targets.filter((t) => !BOARDS[t.kind]) : targets);
  if (!a) return;
  a.state = 'lifting';
  a.hookedBy = s.side;
  a.vx = 0;
  h.target = a;
  h.progress = 0;
  h.startY = a.y;
  events.push({ type: 'hook', side: s.side, kind: a.kind, x: a.x, y: a.y });
}
