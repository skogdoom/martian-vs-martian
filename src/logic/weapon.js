// Clip, reload and per-round ammo cap.
// `ammo` is every shot left this round, including the ones in the clip.
// `free` (triple-shot power-up): shots cost no ammo and the clip always reloads.

import { COMBAT } from '../config.js';

export function createWeapon() {
  return {
    clip: Math.min(COMBAT.clipSize, COMBAT.ammoPerRound),
    ammo: COMBAT.ammoPerRound,
    reload: 0, // seconds left of the current reload, 0 when not reloading
    cooldown: 0,
  };
}

export function isReloading(w) {
  return w.reload > 0;
}

/** Reload progress in [0, 1], or null when not reloading. */
export function reloadProgress(w) {
  return w.reload > 0 ? 1 - w.reload / COMBAT.reloadTime : null;
}

export function canFire(w) {
  return w.clip > 0 && w.reload === 0 && w.cooldown === 0;
}

/** Spend one shot. Returns true if a shot was fired. */
export function tryFire(w, free = false) {
  if (!canFire(w)) return false;
  w.clip--;
  if (!free) w.ammo--;
  w.cooldown = COMBAT.fireCooldown;
  if (w.clip === 0 && (free || w.ammo > 0)) w.reload = COMBAT.reloadTime;
  return true;
}

// Snap tiny float leftovers to zero so a timer of N steps takes exactly N steps.
function countDown(t, dt) {
  const left = t - dt;
  return left > 1e-9 ? left : 0;
}

/** Advance timers. Returns true on the step the clip is refilled. */
export function updateWeapon(w, dt, free = false) {
  w.cooldown = countDown(w.cooldown, dt);
  // Free shots don't outlive the power-up; an empty gun reloads when it starts.
  if (!free && w.clip > w.ammo) w.clip = w.ammo;
  if (free && w.clip === 0 && w.reload === 0) w.reload = COMBAT.reloadTime;
  if (w.reload === 0) return false;
  w.reload = countDown(w.reload, dt);
  if (w.reload > 0) return false;
  w.clip = free ? COMBAT.clipSize : Math.min(COMBAT.clipSize, w.ammo);
  return true;
}
