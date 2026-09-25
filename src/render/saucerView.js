// Placeholder saucer drawing.

import { Graphics } from 'pixi.js';
import { SAUCER } from '../config.js';
import { COLORS } from './backdrop.js';

export function createSaucerView(side) {
  const g = new Graphics();
  const r = SAUCER.radius;
  const h = SAUCER.halfHeight;
  // Dome.
  g.ellipse(0, -h + 2, r * 0.45, SAUCER.top - h + 2).fill({ color: 0xbfe8ff, alpha: 0.8 });
  // Hull.
  g.ellipse(0, 0, r, h).fill(COLORS[side]);
  g.ellipse(0, 0, r, h).stroke({ color: 0xffffff, width: 2, alpha: 0.5 });
  return {
    view: g,
    sync(s) {
      g.position.set(s.x, s.y);
      g.rotation = Math.max(-0.25, Math.min(0.25, s.vx / 2000));
    },
  };
}
