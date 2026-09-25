// Placeholder cows and lambs, plus the tractor beams. Redrawn each frame.

import { Graphics } from 'pixi.js';
import { SAUCER, ANIMALS } from '../config.js';
import { SIDES } from '../logic/world.js';
import { COLORS } from './backdrop.js';

function drawAnimal(g, a) {
  const { w, h } = ANIMALS.size[a.kind];
  const x = a.x - w / 2;
  const top = a.y - h;
  const facing = a.vx < 0 ? -1 : 1;
  const legH = h * 0.3;
  const bodyH = h - legH;
  const body = a.kind === 'cow' ? 0xf4f1ea : 0xfdfbf5;
  const dark = a.kind === 'cow' ? 0x2b2320 : 0x3a3a3a;

  // Legs.
  for (const lx of [0.2, 0.75]) g.rect(x + w * lx - 3, top + bodyH - 2, 6, legH + 2).fill(dark);
  // Body.
  if (a.kind === 'cow') {
    g.roundRect(x, top, w, bodyH, 8).fill(body);
    g.circle(x + w * 0.35, top + bodyH * 0.45, bodyH * 0.25).fill(dark);
    g.circle(x + w * 0.7, top + bodyH * 0.3, bodyH * 0.18).fill(dark);
  } else {
    g.roundRect(x, top, w, bodyH, bodyH / 2).fill(body);
  }
  // Head.
  const hx = a.x + facing * (w / 2 + 2);
  g.circle(hx, top + bodyH * 0.35, bodyH * 0.38).fill(a.kind === 'cow' ? body : dark);
  // Owner tag: a small dot in the colour of whoever first delivered it.
  if (a.owner) g.circle(a.x, top + 5, 3.5).fill(COLORS[a.owner]);
}

function drawBeam(g, s, a, side, alpha) {
  const y0 = s.y + SAUCER.halfHeight;
  const y1 = a.y;
  const hw = ANIMALS.size[a.kind].w / 2 + 6;
  g.poly([s.x - 12, y0, s.x + 12, y0, a.x + hw, y1, a.x - hw, y1]).fill({ color: COLORS[side], alpha: 0.12 + 0.18 * alpha });
}

export function createAnimalView() {
  const g = new Graphics();
  return {
    view: g,
    sync(world) {
      g.clear();
      for (const side of SIDES) {
        const h = world.hooks[side];
        const s = world.saucers[side];
        if (h.target) drawBeam(g, s, h.target, side, h.progress);
        if (h.carrying) drawBeam(g, s, h.carrying, side, 1);
      }
      for (const a of world.animals) drawAnimal(g, a);
    },
  };
}
