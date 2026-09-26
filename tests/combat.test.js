import { describe, it, expect } from 'vitest';
import { STEP, COMBAT } from '../src/config.js';
import { createWeapon, tryFire, updateWeapon, isReloading, reloadProgress } from '../src/logic/weapon.js';
import { createProjectile, fireDirection, updateProjectile } from '../src/logic/projectile.js';
import { createSaucer } from '../src/logic/saucer.js';
import { createWorld, stepWorld } from '../src/logic/world.js';

function wait(w, seconds) {
  let reloaded = false;
  for (let t = 0; t < seconds - 1e-9; t += STEP) reloaded = updateWeapon(w, STEP) || reloaded;
  return reloaded;
}

function emptyClip(w) {
  let fired = 0;
  while (w.clip > 0) {
    if (tryFire(w)) fired++;
    wait(w, COMBAT.fireCooldown);
  }
  return fired;
}

describe('weapon', () => {
  it('starts with a full clip and the round cap', () => {
    const w = createWeapon();
    expect(w.clip).toBe(COMBAT.clipSize);
    expect(w.ammo).toBe(COMBAT.ammoPerRound);
    expect(isReloading(w)).toBe(false);
  });

  it('fires once per press, limited by the cooldown', () => {
    const w = createWeapon();
    expect(tryFire(w)).toBe(true);
    expect(tryFire(w)).toBe(false);
    wait(w, COMBAT.fireCooldown);
    expect(tryFire(w)).toBe(true);
    expect(w.clip).toBe(COMBAT.clipSize - 2);
    expect(w.ammo).toBe(COMBAT.ammoPerRound - 2);
  });

  it('reloads automatically when the clip is empty', () => {
    const w = createWeapon();
    expect(emptyClip(w)).toBe(COMBAT.clipSize);
    expect(isReloading(w)).toBe(true);
    expect(tryFire(w)).toBe(false);

    expect(wait(w, COMBAT.reloadTime / 2)).toBe(false);
    expect(reloadProgress(w)).toBeGreaterThan(0.4);
    expect(tryFire(w)).toBe(false);

    expect(wait(w, COMBAT.reloadTime / 2 + STEP)).toBe(true);
    expect(isReloading(w)).toBe(false);
    expect(w.clip).toBe(COMBAT.clipSize);
    expect(tryFire(w)).toBe(true);
  });

  it('stops after the per-round cap and does not reload an empty weapon', () => {
    const w = createWeapon();
    let fired = 0;
    for (let i = 0; i < 100; i++) {
      if (tryFire(w)) fired++;
      wait(w, COMBAT.reloadTime + STEP);
    }
    expect(fired).toBe(COMBAT.ammoPerRound);
    expect(w.ammo).toBe(0);
    expect(w.clip).toBe(0);
    expect(isReloading(w)).toBe(false);
  });

  it('reloads only the remaining ammo into a partial last clip', () => {
    const w = createWeapon();
    w.ammo = 5;
    emptyClip(w);
    wait(w, COMBAT.reloadTime + STEP);
    expect(w.clip).toBe(2);
    expect(w.ammo).toBe(2);
  });
});

describe('projectiles', () => {
  it('fire toward the opponent side', () => {
    const red = createSaucer('red');
    const blue = createSaucer('blue');
    expect(fireDirection(red, blue)).toBe(1);
    expect(fireDirection(blue, red)).toBe(-1);
    red.x = 1000;
    blue.x = 300;
    expect(fireDirection(red, blue)).toBe(-1);
  });

  it('travel at the shooter height and can miss', () => {
    const red = createSaucer('red');
    const blue = createSaucer('blue');
    blue.y = red.y + 100;
    const p = createProjectile(red, blue);
    expect(p.y).toBe(red.y);
    let hit = false;
    for (let i = 0; i < 200 && p.alive; i++) hit = updateProjectile(p, blue, STEP) || hit;
    expect(hit).toBe(false);
    expect(p.alive).toBe(false);
  });

  it('knock the opponent back on a hit', () => {
    const w = createWorld();
    const { red, blue } = w.saucers;
    red.x = 400;
    blue.x = 800;
    red.y = blue.y = 250;
    stepWorld(w, { red: { x: 0, y: 0, shoot: true } }, STEP);
    expect(w.projectiles).toHaveLength(1);
    let hit = null;
    for (let i = 0; i < 60 && !hit; i++) {
      stepWorld(w, {}, STEP);
      hit = w.events.find((e) => e.type === 'hit');
    }
    expect(hit?.side).toBe('blue');
    expect(blue.vx).toBeGreaterThan(COMBAT.knockback * 0.9);
    expect(w.projectiles).toHaveLength(0);
  });
});
