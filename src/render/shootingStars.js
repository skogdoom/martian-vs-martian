// Shooting stars: now and then one streaks across the sky and fades out.
// Cosmetic only (the title screen's sky), so it uses Math.random.

import { Graphics } from 'pixi.js';
import { WIDTH } from '../config.js';
import { layout } from '../layout.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

const GAP = [4, 10]; // seconds between stars
const FIRST = [1.5, 4]; // seconds before the first one
const START_BELOW = 130; // they start above this, and stay in the upper sky (clear of the menu)

export function createShootingStars() {
  const view = new Graphics();
  let wait = rand(...FIRST);
  let star = null;
  let drawn = false;

  function spawn() {
    const dir = Math.random() < 0.5 ? -1 : 1; // heading left or right
    const angle = rand(0.1, 0.3); // below the horizontal, radians: they drop at most ~200 px
    const speed = rand(650, 950);
    const life = rand(0.5, 0.85);
    return {
      // Starts on the side it comes from, so most of the streak is on screen.
      x: dir > 0 ? rand(0, WIDTH * 0.6) : rand(WIDTH * 0.4, WIDTH),
      y: rand(-layout.extra + 20, START_BELOW),
      vx: Math.cos(angle) * speed * dir,
      vy: Math.sin(angle) * speed,
      tail: rand(90, 160),
      life,
      max: life,
    };
  }

  return {
    view,
    update(dt) {
      if (star) {
        star.x += star.vx * dt;
        star.y += star.vy * dt;
        star.life -= dt;
        if (star.life <= 0) star = null;
        return;
      }
      wait -= dt;
      if (wait > 0) return;
      wait = rand(...GAP);
      star = spawn();
    },
    render() {
      if (!star) {
        if (drawn) view.clear();
        drawn = false;
        return;
      }
      view.clear();
      drawn = true;
      // Fades in quickly and out slowly.
      const age = 1 - star.life / star.max;
      const alpha = Math.min(1, age * 8) * Math.min(1, star.life / (star.max * 0.6));
      const speed = Math.hypot(star.vx, star.vy);
      const ux = star.vx / speed;
      const uy = star.vy / speed;
      // The tail: segments growing fainter and thinner toward the end.
      const parts = 6;
      for (let i = 0; i < parts; i++) {
        const a = (star.tail * i) / parts;
        const b = (star.tail * (i + 1)) / parts;
        const k = 1 - i / parts;
        view
          .moveTo(star.x - ux * a, star.y - uy * a)
          .lineTo(star.x - ux * b, star.y - uy * b)
          .stroke({ color: 0xdfe8ff, width: 0.6 + 1.8 * k, alpha: alpha * k * 0.9 });
      }
      view.circle(star.x, star.y, 4).fill({ color: 0xffffff, alpha: alpha * 0.25 });
      view.circle(star.x, star.y, 1.8).fill({ color: 0xffffff, alpha });
    },
  };
}
