// All projectiles and laser beams, redrawn each frame.

import { COMBAT } from '../../config.js';
import { COLORS } from './backdrop.js';
import { drawRocket, drawBomb } from './powerupView.js';

export function createProjectileView(art) {
  const g = art.dynamicGraphics();
  // Rockets and bombs are small shape pools, positioned and rotated each frame.
  const view = art.container();
  const pools = { rockets: [], bombs: [] };
  art.add(view, g);
  function pooled(kind, i, draw) {
    let s = pools[kind][i];
    if (!s) {
      s = art.graphics();
      draw(s);
      pools[kind].push(s);
      art.add(view, s);
    }
    s.visible = true;
    return s;
  }
  return {
    view,
    sync(world, t) {
      art.draw(g).clear();
      for (const kind of ['rockets', 'bombs']) for (const s of pools[kind]) s.visible = false;
      world.rockets.forEach((r, i) => {
        const s = pooled('rockets', i, (gr) => drawRocket(art, gr, 26, 0.8));
        s.setPosition(r.x, r.y);
        s.rotation = r.angle;
        s.setScale(1, 1 + 0.08 * Math.sin(t * 40));
      });
      world.bombs.forEach((b, i) => {
        const s = pooled('bombs', i, (gr) => drawBomb(art, gr, 9));
        s.setPosition(b.x, b.y - 9);
        s.rotation = Math.sin(t * 10) * 0.3;
      });
      for (const side of ['red', 'blue']) {
        const b = world.lasers[side];
        if (!b) continue;
        const x = Math.min(b.x0, b.x1);
        const w = Math.abs(b.x1 - b.x0);
        const flicker = 0.85 + 0.15 * Math.sin(t * 70);
        art.draw(g).rect(x, b.y - 9, w, 18, { fill: COLORS[side], alpha: 0.18 * flicker });
        art.draw(g).rect(x, b.y - 5, w, 10, { fill: 0xff5ce1, alpha: 0.45 * flicker });
        art.draw(g).rect(x, b.y - 2, w, 4, { fill: 0xffffff, alpha: flicker });
        art.draw(g).circle(b.x0, b.y, 7, { fill: 0xffffff, alpha: 0.9 });
        if (b.hit) art.draw(g).circle(b.x1, b.y, 10 + Math.sin(t * 50) * 3, { fill: 0xffffff, alpha: 0.8 });
      }
      const r = COMBAT.projectileRadius;
      for (const p of world.projectiles) {
        const c = COLORS[p.owner];
        // Tapered trail, glow, hot core.
        art.draw(g).polygon([p.x, p.y - r * 0.8, p.x - p.dir * r * 7, p.y, p.x, p.y + r * 0.8], { fill: c, alpha: 0.55 });
        art.draw(g).circle(p.x, p.y, r * 2.2, { fill: c, alpha: 0.25 });
        art.draw(g).circle(p.x, p.y, r * 1.3, { fill: c, alpha: 0.7 });
        art.draw(g).circle(p.x, p.y, r * 0.75, { fill: 0xffffff });
      }
    },
  };
}
