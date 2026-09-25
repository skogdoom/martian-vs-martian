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
        g.rect(p.dir > 0 ? p.x - r * 3 : p.x, p.y - r / 2, r * 3, r).fill({ color: COLORS[p.owner], alpha: 0.5 });
        g.circle(p.x, p.y, r).fill(0xffffff);
        g.circle(p.x, p.y, r).stroke({ color: COLORS[p.owner], width: 2 });
      }
    },
  };
}
