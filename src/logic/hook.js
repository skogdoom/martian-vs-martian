// Tractor-beam hook: automatic pickup, lift, interrupts, carrying and delivery.

import { ARENA, SAUCER, HOOK, ANIMALS } from '../config.js';
import { speed } from './saucer.js';
import { clampToPen, drop } from './animal.js';

export function createHook(side) {
  return {
    side,
    target: null, // animal being lifted
    progress: 0, // 0..1 lift progress
    startY: 0, // animal feet y when the lift began
    carrying: null, // fully lifted animal
  };
}

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

function findTarget(s, animals) {
  let best = null;
  let bestDx = Infinity;
  for (const a of animals) {
    if (!canHook(s, a)) continue;
    const dx = Math.abs(a.x - s.x);
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

/** Knock a carried animal loose (powered hits); it falls where it is. Returns it, or null. */
export function dropCarried(h) {
  const a = h.carrying;
  if (!a) return null;
  a.bonus = false;
  drop(a);
  h.carrying = null;
  return a;
}

/** Advance one step. Pushes events into `events`. `targets` is everything
 * hookable: the animals, plus the green man when he is around.
 * `stealBonus`: animals stolen now (lifted out of the opponent's pen) are
 * worth extra once delivered, even if the power-up has run out by then. */
export function updateHook(h, s, targets, dt, events, { stealBonus = false } = {}) {
  if (h.carrying) {
    const a = h.carrying;
    a.x = s.x;
    a.y = attachY(s, a);
    if (isOverOwnPen(s)) {
      a.x = clampToPen(s.x, a.kind, s.side);
      drop(a, true);
      h.carrying = null;
      events.push({ type: 'deliver', side: s.side, kind: a.kind, x: a.x, y: a.y });
    }
    return;
  }

  if (h.target) {
    const a = h.target;
    if (Math.abs(s.x - a.x) > HOOK.driftLimit) {
      interruptHook(h);
      events.push({ type: 'interrupt', side: s.side, reason: 'drift', x: a.x, y: a.y });
      return;
    }
    h.progress = Math.min(1, h.progress + dt / HOOK.liftTime[a.kind]);
    a.y = h.startY + (attachY(s, a) - h.startY) * h.progress;
    if (h.progress >= 1 && a.kind === 'greenman') {
      // He climbs aboard: nothing to carry, the power-up starts.
      a.state = 'gone';
      a.hookedBy = null;
      h.target = null;
      h.progress = 0;
      events.push({ type: 'powerup', side: s.side, power: a.power, x: a.x, y: a.y });
    } else if (h.progress >= 1) {
      // Stolen from the opponent's pen during a steal power-up?
      a.bonus = stealBonus && a.pen !== null && a.pen !== s.side;
      a.state = 'carried';
      a.pen = null;
      h.carrying = a;
      h.target = null;
      h.progress = 0;
      events.push({ type: 'pickup', side: s.side, kind: a.kind, x: a.x, y: a.y });
    }
    return;
  }

  if (speed(s) > HOOK.stillSpeed) return;
  const a = findTarget(s, targets);
  if (!a) return;
  a.state = 'lifting';
  a.hookedBy = s.side;
  a.vx = 0;
  h.target = a;
  h.progress = 0;
  h.startY = a.y;
  events.push({ type: 'hook', side: s.side, kind: a.kind, x: a.x, y: a.y });
}
