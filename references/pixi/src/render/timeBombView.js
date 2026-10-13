// Time bombs on the ground or in a beam: a big bomb with a fizzing fuse and
// the seconds left over it, blinking faster as it gets close.

import { Container, Graphics } from 'pixi.js';
import { ANIMALS } from '../config.js';
import { drawBomb } from './powerupView.js';
import { label } from './text.js';
import { createListView } from './listView.js';

const R = 15;

export function createTimeBombSprite() {
  const view = new Container();
  // A pulsing red glow, so it stands out in a crowded pen.
  const glow = new Graphics().circle(0, 0, R * 2.2).fill({ color: 0xff3030, alpha: 0.25 });
  const body = new Graphics();
  drawBomb(body, R, false);
  body.y = -ANIMALS.size.timebomb.h / 2 + 2;
  const flash = new Graphics().circle(0, 0, R).fill(0xff3030);
  flash.y = body.y;
  const spark = new Graphics();
  const count = label('', { size: 24, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 1 });
  count.y = body.y - R * 1.7;
  glow.y = -ANIMALS.size.timebomb.h / 2 + 2;
  view.addChild(glow, body, flash, spark, count);
  view.visible = false;
  const wobble = Math.random() * 10;

  return {
    view,
    sync(b, t) {
      view.visible = b.state !== 'gone';
      if (!view.visible) return;
      view.position.set(b.x, b.y);
      const n = Math.ceil(b.fuse - 1e-9);
      count.text = String(n);
      count.tint = n <= 3 ? 0xff4040 : 0xffffff;
      // Blinks once a second, then faster for the last three.
      const rate = n <= 3 ? 8 : 2;
      flash.alpha = 0.55 * Math.max(0, Math.sin(b.fuse * Math.PI * rate));
      glow.alpha = 0.5 + 0.5 * Math.max(0, Math.sin(b.fuse * Math.PI * rate));
      glow.scale.set(1 + 0.15 * glow.alpha);
      const aloft = b.state === 'lifting' || b.state === 'carried' || b.state === 'falling';
      view.rotation = aloft ? Math.sin(t * 6 + wobble) * 0.2 : 0;
      spark.clear();
      const sx = R * 0.72;
      const sy = body.y - R * 1.58;
      for (let i = 0; i < 3; i++) {
        const a = t * 25 + i * 2.1;
        spark.circle(sx + Math.cos(a) * 3, sy + Math.sin(a) * 3, 1.5 + (i === 0 ? 1.5 : 0)).fill(i ? 0xff8a3a : 0xffe45c);
      }
    },
  };
}

export function createTimeBombsView() {
  return createListView(createTimeBombSprite);
}
