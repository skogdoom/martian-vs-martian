// All projectiles, redrawn each frame.

import { Graphics } from 'pixi.js';
import { COMBAT } from '../config.js';
import { COLORS } from './backdrop.js';

export function createProjectileView() {
  const g = new Graphics();
  return {
    view: g,
    sync(projectiles) {
      g.clear();
      const r = COMBAT.projectileRadius;
      for (const p of projectiles) {
        const c = COLORS[p.owner];
        // Tapered trail, glow, hot core.
        g.poly([p.x, p.y - r * 0.8, p.x - p.dir * r * 7, p.y, p.x, p.y + r * 0.8]).fill({ color: c, alpha: 0.55 });
        g.circle(p.x, p.y, r * 2.2).fill({ color: c, alpha: 0.25 });
        g.circle(p.x, p.y, r * 1.3).fill({ color: c, alpha: 0.7 });
        g.circle(p.x, p.y, r * 0.75).fill(0xffffff);
      }
    },
  };
}
