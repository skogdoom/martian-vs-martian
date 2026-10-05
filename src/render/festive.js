// Special-day scenery for the backdrop (see occasion.js): a Santa hat for the
// moon and falling snow at Christmas, fireworks on New Year's Eve. Cosmetic
// only, so it uses Math.random.

import { Graphics } from 'pixi.js';
import { WIDTH, ARENA } from '../config.js';
import { MAX_EXTRA, layout } from '../layout.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const GROUND = ARENA.groundY;

/** A Santa hat for a moon of radius 32 centred on (0, 0), tipped to the right. */
export function createSantaHat() {
  const g = new Graphics();
  // The cap, drooping to the right, with a darker fold.
  g.poly([-27, -22, -14, -56, 6, -74, 30, -70, 34, -60, 24, -54, 27, -22]).fill(0xd8283a);
  g.poly([6, -74, 30, -70, 34, -60, 24, -54, 14, -60]).fill(0xa81c2c);
  // The white brim and the pom-pom.
  g.roundRect(-32, -30, 64, 14, 7).fill(0xf6f6f6);
  g.circle(34, -64, 8).fill(0xf6f6f6);
  g.circle(31, -67, 3).fill({ color: 0xffffff, alpha: 0.9 });
  g.rotation = 0.22;
  return g;
}

/** Snow drifting down over the whole sky, however tall the screen. */
export function createSnow(count = 220) {
  const view = new Graphics();
  const top = -MAX_EXTRA - 20;
  const span = GROUND - top;
  const flakes = Array.from({ length: count }, () => ({
    x: rand(0, WIDTH),
    y: rand(0, span),
    speed: rand(28, 70),
    drift: rand(8, 30),
    freq: rand(0.4, 1.1),
    phase: rand(0, Math.PI * 2),
    r: rand(1, 2.6),
  }));
  return {
    view,
    tick(t) {
      view.clear();
      for (const f of flakes) {
        const y = top + ((f.y + f.speed * t) % span);
        if (y < -layout.extra - 10) continue; // above the screen
        const x = (((f.x + Math.sin(t * f.freq + f.phase) * f.drift) % WIDTH) + WIDTH) % WIDTH;
        view.circle(x, y, f.r).fill({ color: 0xffffff, alpha: 0.55 + f.r * 0.15 });
      }
    },
  };
}

const COLOURS = [
  [0xff5c5c, 0xffd0d0],
  [0x6cff6c, 0xd8ffd8],
  [0x5cb8ff, 0xd6eeff],
  [0xffd75c, 0xfff3c8],
  [0xff7cf0, 0xffd8fb],
  [0xffffff, 0xfff3a0],
];
const MAX_SPARKS = 700;

/** Fireworks: rockets rise from behind the hills and burst in the sky. */
export function createFireworks() {
  const view = new Graphics();
  const rockets = [];
  const sparks = [];
  const flashes = [];
  let wait = rand(0.3, 1);
  let last = null;

  function launch() {
    const x = rand(120, WIDTH - 120);
    rockets.push({
      x,
      y: 570, // behind the hills
      vx: rand(-40, 40),
      vy: -rand(420, 540),
      burstAt: rand(-layout.extra * 0.7 + 40, 280),
      colours: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    });
  }

  function burst(r) {
    const n = Math.min(Math.round(rand(55, 85)), MAX_SPARKS - sparks.length);
    const speed = rand(150, 240);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = speed * Math.sqrt(rand(0.15, 1)); // filled in, not just a ring
      const life = rand(1.1, 1.7);
      sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, colour: r.colours[i % 2] });
    }
    flashes.push({ x: r.x, y: r.y, life: 0.25, colour: r.colours[1] });
  }

  return {
    view,
    tick(t) {
      const dt = last === null ? 0 : Math.max(0, Math.min(0.1, t - last));
      last = t;
      wait -= dt;
      if (wait <= 0) {
        launch();
        if (Math.random() < 0.3) launch(); // sometimes two at once
        wait = rand(0.7, 2);
      }
      for (const r of rockets) {
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.vy += 120 * dt; // slowing as it climbs
        if (r.y <= r.burstAt || r.vy >= -60) {
          r.done = true;
          burst(r);
        }
      }
      for (let i = rockets.length - 1; i >= 0; i--) if (rockets[i].done) rockets.splice(i, 1);
      for (const s of sparks) {
        s.vx *= Math.exp(-1.4 * dt);
        s.vy = s.vy * Math.exp(-1.4 * dt) + 70 * dt; // drag, then a gentle fall
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
      }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
      for (const f of flashes) f.life -= dt;
      for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].life <= 0) flashes.splice(i, 1);

      view.clear();
      for (const f of flashes) view.circle(f.x, f.y, 26).fill({ color: f.colour, alpha: f.life * 1.2 });
      for (const r of rockets) {
        view
          .moveTo(r.x, r.y)
          .lineTo(r.x - r.vx * 0.05, r.y - r.vy * 0.05)
          .stroke({ color: 0xffe2a0, width: 2, alpha: 0.7 });
        view.circle(r.x, r.y, 2).fill(0xfff3c8);
      }
      // Each spark a short streak along its path, fading and thinning as it burns out.
      for (const s of sparks) {
        const k = s.life / s.max;
        const alpha = Math.min(1, k * 1.6);
        view
          .moveTo(s.x - s.vx * 0.06, s.y - s.vy * 0.06)
          .lineTo(s.x, s.y)
          .stroke({ color: s.colour, width: 1 + 1.5 * k, alpha });
        view.circle(s.x, s.y, 0.8 + 1.2 * k).fill({ color: 0xffffff, alpha: alpha * 0.8 });
      }
    },
  };
}
