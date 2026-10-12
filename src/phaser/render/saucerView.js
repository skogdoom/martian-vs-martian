// Saucer with its Martian pilot under a glass dome.

import { SAUCER } from '../../config.js';
import { COLORS } from './backdrop.js';
import { POWER_COLOR, SHIELD_COLOR, drawRocket, drawBomb } from './powerupView.js';
import { variant } from '../sprites/variant.js';
import { cartoonSaucer } from '../sprites/actors.js';

const SHADE = { red: 0x9e2a2f, blue: 0x1f5bb0 };
const LIGHTS = 7;

function drawMartian(art, g, side) {
  const c = COLORS[side];
  // Antennae.
  art.draw(g).curve(
    [
      ['moveTo', -4, -22],
      ['lineTo', -7, -27],
    ],
    { stroke: c, width: 2 },
  );
  art.draw(g).curve(
    [
      ['moveTo', 4, -22],
      ['lineTo', 7, -27],
    ],
    { stroke: c, width: 2 },
  );
  art.draw(g).circle(-7, -27, 2, { fill: 0xfff3a0 });
  art.draw(g).circle(7, -27, 2, { fill: 0xfff3a0 });
  // Shoulders and head.
  art.draw(g).ellipse(0, -4, 10, 6, { fill: SHADE[side] });
  art.draw(g).ellipse(0, -15, 9, 8.5, { fill: c });
}

function drawHull(art, g, side) {
  const r = SAUCER.radius;
  const h = SAUCER.halfHeight;
  // Underside and emitter.
  art.draw(g).ellipse(0, 4, r * 0.62, h * 0.75, { fill: 0x4a5162 });
  art.draw(g).ellipse(0, h - 3, 9, 4, { fill: COLORS[side] });
  // Rim in team colour.
  art.draw(g).ellipse(0, 1, r, h - 2, { fill: SHADE[side] });
  art.draw(g).ellipse(0, 0, r, h - 4, { fill: COLORS[side] });
  // Top plate.
  art.draw(g).ellipse(0, -3, r * 0.86, h * 0.55, { fill: 0xc9d2de });
  art.draw(g).ellipse(0, -4, r * 0.8, h * 0.38, { fill: 0xe3e9f1 });
  art.draw(g).ellipse(-8, -5, r * 0.35, 2, { fill: 0xffffff, alpha: 0.8 });
}

export function createSaucerView(art, side) {
  return variant(
    art,
    () => classicSaucer(art, side),
    () => cartoonSaucer(art, side),
  );
}

function classicSaucer(art, side) {
  const view = art.container();
  const r = SAUCER.radius;
  const h = SAUCER.halfHeight;
  const domeY = -h + 2;
  const domeRy = SAUCER.top - h + 2;

  const glow = art.graphics((draw) => draw.ellipse(0, 2, r + 12, h + 8, { fill: COLORS[side], alpha: 0.12 }));
  // Power-up aura, and speed streaks trailing behind.
  const aura = art.graphics((draw) => draw.ellipse(0, 0, r + 14, h + 14, { stroke: POWER_COLOR, width: 3 }));
  aura.visible = false;
  const streaks = art.graphics();
  for (const [y, len] of [
    [-6, 30],
    [2, 44],
    [9, 26],
  ])
    art.draw(streaks).rect(-r - len - 6, y - 1, len, 2, { fill: 0xffffff, alpha: 0.6 });
  streaks.visible = false;

  const back = art.graphics((draw) => draw.ellipse(0, domeY, 15, domeRy, { fill: 0x0c1830, alpha: 0.85 }));
  const martian = art.graphics();
  drawMartian(art, martian, side);
  const eyes = art.graphics();
  const glass = art.graphics();
  art.draw(glass).ellipse(0, domeY, 15, domeRy, { fill: 0xbfe8ff, alpha: 0.18 });
  art.draw(glass).ellipse(0, domeY, 15, domeRy, { stroke: 0xdff4ff, width: 1.5, alpha: 0.6 });
  art.draw(glass).ellipse(-6, domeY - 9, 3, 6, { fill: 0xffffff, alpha: 0.45 });

  const hull = art.graphics();
  drawHull(art, hull, side);
  const lights = art.graphics();
  const flash = art.graphics((draw) => draw.ellipse(0, -2, r, h + 6, { fill: 0xffffff }));
  flash.alpha = 0;
  // A single-use power-up waiting under the hull.
  const heldRocket = art.graphics();
  drawRocket(art, heldRocket, 22);
  heldRocket.setPosition(0, h + 4);
  const heldBomb = art.graphics();
  drawBomb(art, heldBomb, 7);
  heldBomb.setPosition(0, h + 9);
  heldRocket.visible = heldBomb.visible = false;
  // Stars circling the dome while stunned.
  const dizzy = art.graphics();
  // Shield power-up: a bubble around the whole saucer.
  const shield = art.graphics();
  art.draw(shield).ellipse(0, -4, r + 16, SAUCER.top + 6, { fill: SHIELD_COLOR, alpha: 0.12 });
  art.draw(shield).ellipse(0, -4, r + 16, SAUCER.top + 6, { stroke: SHIELD_COLOR, width: 2.5 });
  art.draw(shield).ellipse(-r * 0.55, -SAUCER.top * 0.55, 8, 4, { fill: 0xffffff, alpha: 0.5 });
  shield.visible = false;
  // Fast enough to ram: a shock front ahead of the saucer.
  const shock = art.graphics();
  for (const [dx, w, a] of [
    [0, 3, 0.9],
    [9, 2, 0.5],
  ]) {
    art.draw(shock).curve(
      [
        ['moveTo', r + 2 + dx, -h - 8],
        ['quadraticCurveTo', r + 18 + dx, 0, r + 2 + dx, h + 8],
      ],
      { stroke: 0xffffff, width: w, alpha: a },
    );
  }
  shock.visible = false;

  // What the eyes, lights and stars were last drawn as, so they are only
  // redrawn when that changes rather than every frame.
  const drawn = { eyes: null, lights: null, dizzy: false };
  function drawEyes(blinking, ex) {
    if (blinking) {
      art.draw(eyes).rect(-7 + ex, -15, 5, 1.5, { fill: 0x111111 });
      art.draw(eyes).rect(2 + ex, -15, 5, 1.5, { fill: 0x111111 });
    } else {
      art.draw(eyes).ellipse(-4 + ex, -15, 3, 4, { fill: 0x111111 });
      art.draw(eyes).ellipse(4 + ex, -15, 3, 4, { fill: 0x111111 });
      art.draw(eyes).circle(-3 + ex, -17, 1, { fill: 0xffffff });
      art.draw(eyes).circle(5 + ex, -17, 1, { fill: 0xffffff });
    }
  }

  art.add(view, aura, streaks, glow, heldRocket, heldBomb, back, martian, eyes, glass, hull, lights, flash, dizzy, shield, shock);

  return {
    view,
    /** `look` is -1/+1 toward the opponent; `hit` fades 1 → 0 after being shot;
     * `deflect` the same after a shot bounced off the shield;
     * `power` is the active power-up type, if any; `momentum` 0..1 from flying
     * straight; `ramReady` when going fast enough to ram. */
    sync(s, t, { look = 1, hit = 0, deflect = 0, beam = false, power = null, momentum = 0, ramReady = false } = {}) {
      const stunned = s.stun > 0;
      const bob = Math.sin(t * 3 + (side === 'red' ? 0 : 1.7)) * 1.5;
      view.setPosition(s.x, s.y + bob);
      const tilt = Math.max(-0.25, Math.min(0.25, s.vx / 2000));
      view.rotation = stunned ? Math.sin(t * 18) * 0.6 : tilt + (hit > 0 ? Math.sin(t * 60) * 0.12 * hit : 0);

      // Eyes: big and dark, glancing toward the opponent; the odd blink.
      const blinking = (t + (side === 'red' ? 0 : 1.9)) % 3.7 < 0.12;
      const ex = look * 1.5;
      // Redrawn only when they change (a blink, or a glance the other way).
      const eyesKey = blinking ? -ex : ex + 10;
      if (eyesKey !== drawn.eyes) {
        drawn.eyes = eyesKey;
        art.draw(eyes).clear();
        drawEyes(blinking, ex);
      }

      // Chasing rim lights: one step every 1/8 s.
      const phase = Math.floor(t * 8) % 3;
      if (phase !== drawn.lights) {
        drawn.lights = phase;
        art.draw(lights).clear();
        for (let i = 0; i < LIGHTS; i++) {
          const u = i / (LIGHTS - 1);
          const x = (u - 0.5) * r * 1.6;
          const y = 3 + Math.sin(u * Math.PI) * 3;
          const on = (phase + i) % 3 === 0;
          art.draw(lights).circle(x, y, 2.2, { fill: on ? 0xfff6b0 : 0x6b5a2a });
        }
      }
      glow.alpha = beam ? 1 : 0.7 + 0.3 * Math.sin(t * 4);
      flash.alpha = hit * 0.7;
      aura.visible = power !== null;
      aura.alpha = 0.5 + 0.4 * Math.sin(t * 8);
      aura.setScale(1 + 0.06 * Math.sin(t * 8));
      // Streaks point away from the direction of travel (the view is rotated, not flipped).
      const speedy = power === 'speed' && Math.abs(s.vx) > 150;
      streaks.visible = speedy || momentum > 0.15;
      streaks.alpha = speedy ? 1 : Math.min(1, momentum * 1.3);
      streaks.scaleX = s.vx >= 0 ? 1 : -1;
      shock.visible = ramReady && !stunned;
      if (shock.visible) {
        shock.rotation = Math.atan2(s.vy, s.vx) - view.rotation;
        shock.alpha = 0.6 + 0.4 * Math.sin(t * 30);
      }
      heldRocket.visible = power === 'rocket';
      heldBomb.visible = power === 'bomb' || power === 'timeBomb';
      heldRocket.scaleX = look;
      shield.visible = power === 'shield';
      shield.alpha = 0.55 + 0.2 * Math.sin(t * 5) + 0.45 * deflect;
      shield.setScale(1 + 0.03 * Math.sin(t * 5) + 0.08 * deflect);

      if (stunned || drawn.dizzy) art.draw(dizzy).clear();
      drawn.dizzy = stunned;
      if (stunned) {
        for (let i = 0; i < 4; i++) {
          const a = t * 6 + (i * Math.PI) / 2;
          const x = Math.cos(a) * 22;
          const y = -26 + Math.sin(a) * 6;
          art.draw(dizzy).star(x, y, 5, 4, 2, { fill: 0xffe45c });
        }
      }
    },
  };
}
