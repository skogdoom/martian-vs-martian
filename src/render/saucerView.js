// Saucer with its Martian pilot under a glass dome.

import { Container, Graphics } from 'pixi.js';
import { SAUCER } from '../config.js';
import { COLORS } from './backdrop.js';
import { POWER_COLOR, drawRocket, drawBomb } from './powerupView.js';

const SHADE = { red: 0x9e2a2f, blue: 0x1f5bb0 };
const LIGHTS = 7;

function drawMartian(g, side) {
  const c = COLORS[side];
  // Antennae.
  g.moveTo(-4, -22).lineTo(-7, -27).stroke({ color: c, width: 2 });
  g.moveTo(4, -22).lineTo(7, -27).stroke({ color: c, width: 2 });
  g.circle(-7, -27, 2).fill(0xfff3a0);
  g.circle(7, -27, 2).fill(0xfff3a0);
  // Shoulders and head.
  g.ellipse(0, -4, 10, 6).fill(SHADE[side]);
  g.ellipse(0, -15, 9, 8.5).fill(c);
}

function drawHull(g, side) {
  const r = SAUCER.radius;
  const h = SAUCER.halfHeight;
  // Underside and emitter.
  g.ellipse(0, 4, r * 0.62, h * 0.75).fill(0x4a5162);
  g.ellipse(0, h - 3, 9, 4).fill(COLORS[side]);
  // Rim in team colour.
  g.ellipse(0, 1, r, h - 2).fill(SHADE[side]);
  g.ellipse(0, 0, r, h - 4).fill(COLORS[side]);
  // Top plate.
  g.ellipse(0, -3, r * 0.86, h * 0.55).fill(0xc9d2de);
  g.ellipse(0, -4, r * 0.8, h * 0.38).fill(0xe3e9f1);
  g.ellipse(-8, -5, r * 0.35, 2).fill({ color: 0xffffff, alpha: 0.8 });
}

export function createSaucerView(side) {
  const view = new Container();
  const r = SAUCER.radius;
  const h = SAUCER.halfHeight;
  const domeY = -h + 2;
  const domeRy = SAUCER.top - h + 2;

  const glow = new Graphics().ellipse(0, 2, r + 12, h + 8).fill({ color: COLORS[side], alpha: 0.12 });
  // Power-up aura, and speed streaks trailing behind.
  const aura = new Graphics().ellipse(0, 0, r + 14, h + 14).stroke({ color: POWER_COLOR, width: 3 });
  aura.visible = false;
  const streaks = new Graphics();
  for (const [y, len] of [[-6, 30], [2, 44], [9, 26]]) streaks.rect(-r - len - 6, y - 1, len, 2).fill({ color: 0xffffff, alpha: 0.6 });
  streaks.visible = false;

  const back = new Graphics().ellipse(0, domeY, 15, domeRy).fill({ color: 0x0c1830, alpha: 0.85 });
  const martian = new Graphics();
  drawMartian(martian, side);
  const eyes = new Graphics();
  const glass = new Graphics();
  glass.ellipse(0, domeY, 15, domeRy).fill({ color: 0xbfe8ff, alpha: 0.18 });
  glass.ellipse(0, domeY, 15, domeRy).stroke({ color: 0xdff4ff, width: 1.5, alpha: 0.6 });
  glass.ellipse(-6, domeY - 9, 3, 6).fill({ color: 0xffffff, alpha: 0.45 });

  const hull = new Graphics();
  drawHull(hull, side);
  const lights = new Graphics();
  const flash = new Graphics().ellipse(0, -2, r, h + 6).fill(0xffffff);
  flash.alpha = 0;
  // A single-use power-up waiting under the hull.
  const heldRocket = new Graphics();
  drawRocket(heldRocket, 22);
  heldRocket.position.set(0, h + 4);
  const heldBomb = new Graphics();
  drawBomb(heldBomb, 7);
  heldBomb.position.set(0, h + 9);
  heldRocket.visible = heldBomb.visible = false;
  // Stars circling the dome while stunned.
  const dizzy = new Graphics();

  view.addChild(aura, streaks, glow, heldRocket, heldBomb, back, martian, eyes, glass, hull, lights, flash, dizzy);

  return {
    view,
    /** `look` is -1/+1 toward the opponent; `hit` fades 1 → 0 after being shot;
     * `power` is the active power-up type, if any. */
    sync(s, t, { look = 1, hit = 0, beam = false, power = null } = {}) {
      const stunned = s.stun > 0;
      const bob = Math.sin(t * 3 + (side === 'red' ? 0 : 1.7)) * 1.5;
      view.position.set(s.x, s.y + bob);
      const tilt = Math.max(-0.25, Math.min(0.25, s.vx / 2000));
      view.rotation = stunned ? Math.sin(t * 18) * 0.6 : tilt + (hit > 0 ? Math.sin(t * 60) * 0.12 * hit : 0);

      // Eyes: big and dark, glancing toward the opponent; the odd blink.
      const blinking = (t + (side === 'red' ? 0 : 1.9)) % 3.7 < 0.12;
      const ex = look * 1.5;
      eyes.clear();
      if (blinking) {
        eyes.rect(-7 + ex, -15, 5, 1.5).fill(0x111111);
        eyes.rect(2 + ex, -15, 5, 1.5).fill(0x111111);
      } else {
        eyes.ellipse(-4 + ex, -15, 3, 4).fill(0x111111);
        eyes.ellipse(4 + ex, -15, 3, 4).fill(0x111111);
        eyes.circle(-3 + ex, -17, 1).fill(0xffffff);
        eyes.circle(5 + ex, -17, 1).fill(0xffffff);
      }

      // Chasing rim lights.
      lights.clear();
      for (let i = 0; i < LIGHTS; i++) {
        const u = i / (LIGHTS - 1);
        const x = (u - 0.5) * r * 1.6;
        const y = 3 + Math.sin(u * Math.PI) * 3;
        const on = (Math.floor(t * 8) + i) % 3 === 0;
        lights.circle(x, y, 2.2).fill(on ? 0xfff6b0 : 0x6b5a2a);
      }
      glow.alpha = beam ? 1 : 0.7 + 0.3 * Math.sin(t * 4);
      flash.alpha = hit * 0.7;
      aura.visible = power !== null;
      aura.alpha = 0.5 + 0.4 * Math.sin(t * 8);
      aura.scale.set(1 + 0.06 * Math.sin(t * 8));
      // Streaks point away from the direction of travel (the view is rotated, not flipped).
      streaks.visible = power === 'speed' && Math.abs(s.vx) > 150;
      streaks.scale.x = s.vx >= 0 ? 1 : -1;
      heldRocket.visible = power === 'rocket';
      heldBomb.visible = power === 'bomb';
      heldRocket.scale.x = look;

      dizzy.clear();
      if (stunned) {
        for (let i = 0; i < 4; i++) {
          const a = t * 6 + (i * Math.PI) / 2;
          const x = Math.cos(a) * 22;
          const y = -26 + Math.sin(a) * 6;
          dizzy.star(x, y, 5, 4, 2).fill(0xffe45c);
        }
      }
    },
  };
}
