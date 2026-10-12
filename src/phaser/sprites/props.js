import { COMBAT, ANIMALS } from '../../config.js';
import { createListView } from '../render/listView.js';
import { label } from '../render/text.js';

const chuteVisible = (a) => a.state === 'descending' || (a.state === 'falling' && a.chute);

export function cartoonPowerIcon(art, type, r = 14) {
  return art.sprites.sprite(`power-${type}`, r * 2, r * 2);
}

export function cartoonDrop(art, kind) {
  const { sprite, frame } = art.sprites;
  const view = art.container();
  const green = kind === 'greenman';
  const h = green ? 36 : kind === 'package' ? 36 : 30;
  const glow = sprite('fx-ring', 52, 44, 0, -h / 2).setAlpha(0.3);
  const chute = sprite('parachute', 56, 64, 0, -h + 6, 0.5, 1);
  const body = sprite(green ? 'alien' : kind, green ? 29 : 34, h, 0, 0, 0.5, 1);
  const mark = label(art, '?', { size: 22, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 });
  const bubble = label(art, 'Oh, no!', { size: 15, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 });
  bubble.setPosition(36, -54);
  const sign = art.container();
  art.add(view, glow, chute, body, mark, sign, bubble);
  const phase = art.random() * 10;
  let icon;
  let power;
  let facing = 1;
  return {
    view,
    sync(d, t) {
      view.visible = d.state !== 'gone';
      if (!view.visible) return;
      if (d.vx) facing = Math.sign(d.vx);
      const panic = green && d.panic != null;
      view.setPosition(d.x + (panic ? Math.sin(t * 70) * 1.2 : 0), d.y);
      chute.visible = chuteVisible(d);
      if (green) {
        frame(body, panic ? 'alien-panic' : 'alien');
        body.flipX = facing < 0;
        body.rotation = !chute.visible && d.vx ? Math.sin(t * 14) * 0.04 : 0;
        if (power !== d.power) {
          icon?.destroy();
          power = d.power;
          icon = cartoonPowerIcon(art, power, 13);
          art.add(sign, icon);
        }
        sign.setPosition(0, chute.visible ? -h - 52 : -58 + Math.sin(t * 4) * 3);
      }
      bubble.visible = panic;
      mark.visible = kind === 'package' && !chute.visible;
      mark.y = -52 + Math.sin(t * 4 + phase) * 3;
      const swinging = chute.visible || d.state === 'lifting' || d.state === 'falling';
      view.rotation = swinging ? Math.sin(t * 2.4 + phase) * 0.12 : 0;
      glow.alpha = 0.12 + 0.12 * Math.sin(t * 5);
    },
  };
}

export function cartoonDrops(art) {
  return createListView(art, (d) => cartoonDrop(art, d.kind === 'crate' || d.kind === 'package' ? d.kind : 'greenman'));
}

export function cartoonTimeBomb(art) {
  const { sprite } = art.sprites;
  const view = art.container();
  const glow = sprite('impact', 54, 50, 0, -15);
  const body = sprite('timebomb', 32, ANIMALS.size.timebomb.h + 8, 0, 0, 0.5, 1);
  const spark = sprite('spark', 10, 10, 10, -38);
  const count = label(art, '', { size: 24, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 1 });
  count.y = -44;
  art.add(view, glow, body, spark, count);
  const wobble = art.random() * 10;
  return {
    view,
    sync(b, t) {
      view.visible = b.state !== 'gone';
      if (!view.visible) return;
      view.setPosition(b.x, b.y);
      const n = Math.ceil(b.fuse - 1e-9);
      count.text = String(n);
      art.tint(count, n <= 3 ? 0xff4040 : 0xffffff);
      const pulse = Math.max(0, Math.sin(b.fuse * Math.PI * (n <= 3 ? 8 : 2)));
      glow.alpha = 0.15 + pulse * 0.35;
      spark.setDisplaySize(7 + pulse * 5, 7 + pulse * 5).setRotation(t * 9);
      view.rotation = ['lifting', 'carried', 'falling'].includes(b.state) ? Math.sin(t * 6 + wobble) * 0.2 : 0;
    },
  };
}

export function cartoonTimeBombs(art) {
  return createListView(art, () => cartoonTimeBomb(art));
}

export function cartoonProjectiles(art) {
  const view = art.container();
  const pools = { rockets: [], bombs: [], shots: [], lasers: [], emitters: [], impacts: [] };
  function pooled(kind, i, name, w, h) {
    let s = pools[kind][i];
    if (!s) {
      s = art.sprites.sprite(name, w, h);
      pools[kind].push(s);
      art.add(view, s);
    }
    return s.setVisible(true);
  }
  return {
    view,
    sync(world, t) {
      for (const pool of Object.values(pools)) for (const s of pool) s.visible = false;
      world.rockets.forEach((r, i) => pooled('rockets', i, 'rocket', 38, 18).setPosition(r.x, r.y).setRotation(r.angle));
      world.bombs.forEach((b, i) =>
        pooled('bombs', i, 'bomb', 18, 25)
          .setPosition(b.x, b.y - 10)
          .setRotation(Math.sin(t * 10) * 0.3),
      );
      world.projectiles.forEach((p, i) => {
        const r = COMBAT.projectileRadius;
        const s = pooled('shots', i, 'fx-trail', r * 7, r * 2.6);
        // Keep the hot head at the simulated collision position; the tail trails.
        s.setPosition(p.x - p.dir * r * 2.4, p.y);
        s.flipX = p.dir < 0;
        art.tint(s, p.owner === 'red' ? 0xff8aaa : 0xaaaaff);
      });
      ['red', 'blue'].forEach((side, i) => {
        const b = world.lasers[side];
        if (!b) return;
        const s = pooled('lasers', i, 'laser', 1, 18);
        s.setPosition((b.x0 + b.x1) / 2, b.y)
          .setDisplaySize(Math.max(1, Math.abs(b.x1 - b.x0)), 18)
          .setAlpha(0.85 + 0.15 * Math.sin(t * 70));
        s.flipX = b.x1 > b.x0;
        const emitter = pooled('emitters', i, 'fx-dot', 18, 18).setPosition(b.x0, b.y);
        art.tint(emitter, 0xffaaff);
        if (b.hit) pooled('impacts', i, 'impact', 28, 28).setPosition(b.x1, b.y).setAlpha(0.8);
      });
    },
  };
}
