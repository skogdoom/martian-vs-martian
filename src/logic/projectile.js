// Projectiles fly horizontally at the shooter's height, toward the opponent's side.

import { WIDTH, SAUCER, COMBAT } from '../config.js';

/** +1 or -1: which way `shooter` fires, given where `target` is. */
export function fireDirection(shooter, target) {
  const dx = target.x - shooter.x;
  if (dx !== 0) return Math.sign(dx);
  return shooter.side === 'red' ? 1 : -1;
}

export function createProjectile(shooter, target) {
  const dir = fireDirection(shooter, target);
  return {
    owner: shooter.side,
    dir,
    x: shooter.x + dir * (SAUCER.radius + COMBAT.projectileRadius),
    y: shooter.y,
    vx: dir * COMBAT.projectileSpeed,
    alive: true,
  };
}

/** Ellipse-vs-circle overlap between a projectile and a saucer. */
export function hitsSaucer(p, s) {
  const rx = SAUCER.radius + COMBAT.projectileRadius;
  const ry = SAUCER.halfHeight + COMBAT.projectileRadius;
  const dx = (p.x - s.x) / rx;
  const dy = (p.y - s.y) / ry;
  return dx * dx + dy * dy <= 1;
}

/** Move a projectile and test it against `target`. Returns true on a hit.
 * The swept test keeps fast shots from tunnelling through a saucer. */
export function updateProjectile(p, target, dt) {
  const x0 = p.x;
  p.x += p.vx * dt;
  const substeps = Math.ceil(Math.abs(p.x - x0) / COMBAT.projectileRadius);
  for (let i = 1; i <= substeps; i++) {
    const probe = { x: x0 + ((p.x - x0) * i) / substeps, y: p.y };
    if (hitsSaucer(probe, target)) {
      p.x = probe.x;
      p.alive = false;
      return true;
    }
  }
  if (p.x < -COMBAT.projectileRadius || p.x > WIDTH + COMBAT.projectileRadius) p.alive = false;
  return false;
}

export function applyKnockback(target, dir) {
  target.vx = dir * COMBAT.knockback;
}
