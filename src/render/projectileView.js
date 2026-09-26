// All projectiles and laser beams, redrawn each frame.

import { Graphics } from 'pixi.js';
import { COMBAT } from '../config.js';
import { COLORS } from './backdrop.js';

export function createProjectileView() {
  const g = new Graphics();
  return {
    view: g,
    sync(world, t) {
      g.clear();
      for (const side of ['red', 'blue']) {
        const b = world.lasers[side];
        if (!b) continue;
        const x = Math.min(b.x0, b.x1);
        const w = Math.abs(b.x1 - b.x0);
        const flicker = 0.85 + 0.15 * Math.sin(t * 70);
        g.rect(x, b.y - 9, w, 18).fill({ color: COLORS[side], alpha: 0.18 * flicker });
        g.rect(x, b.y - 5, w, 10).fill({ color: 0xff5ce1, alpha: 0.45 * flicker });
        g.rect(x, b.y - 2, w, 4).fill({ color: 0xffffff, alpha: flicker });
        g.circle(b.x0, b.y, 7).fill({ color: 0xffffff, alpha: 0.9 });
        if (b.hit) g.circle(b.x1, b.y, 10 + Math.sin(t * 50) * 3).fill({ color: 0xffffff, alpha: 0.8 });
      }
      const r = COMBAT.projectileRadius;
      for (const p of world.projectiles) {
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
