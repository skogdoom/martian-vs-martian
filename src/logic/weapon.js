// Clip, reload and per-round ammo cap.
// `ammo` is every shot left this round, including the ones in the clip.
// `free` (triple-shot power-up): shots cost no ammo and the clip always reloads.
// `endless` (unlimited power-up): shots cost nothing at all, so no reloads.

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
export function tryFire(w, free = false, endless = false) {
  if (!canFire(w)) return false;
  w.cooldown = COMBAT.fireCooldown;
  if (endless) return true;
  w.clip--;
  if (!free) w.ammo--;
  if (w.clip === 0 && (free || w.ammo > 0)) w.reload = COMBAT.reloadTime;
  return true;
}

/** Add shots from an ammo crate, up to the per-round cap. */
export function addAmmo(w, n) {
  w.ammo = Math.min(COMBAT.ammoPerRound, w.ammo + n);
}

// Snap tiny float leftovers to zero so a timer of N steps takes exactly N steps.
function countDown(t, dt) {
  const left = t - dt;
  return left > 1e-9 ? left : 0;
}

/** Advance timers. Returns true on the step the clip is refilled. */
export function updateWeapon(w, dt, free = false, endless = false) {
  w.cooldown = countDown(w.cooldown, dt);
  if (endless) {
    // A full clip, straight away, for as long as it lasts.
    const refilled = w.reload > 0 || w.clip < COMBAT.clipSize;
    w.clip = COMBAT.clipSize;
    w.reload = 0;
    return refilled;
  }
  // Free shots don't outlive the power-up. An empty clip reloads as soon as
  // there is something to load (triple shot, or ammo from a crate).
  if (!free && w.clip > w.ammo) w.clip = w.ammo;
  if (w.clip === 0 && w.reload === 0 && (free || w.ammo > 0)) w.reload = COMBAT.reloadTime;
  if (w.reload === 0) return false;
  w.reload = countDown(w.reload, dt);
  if (w.reload > 0) return false;
  w.clip = free ? COMBAT.clipSize : Math.min(COMBAT.clipSize, w.ammo);
  return true;
}
