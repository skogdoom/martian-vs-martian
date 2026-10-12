// Shooting stars: now and then one streaks across the sky and fades out.
// Cosmetic only (the title screen's sky), so it uses the isolated artwork random stream.

import { WIDTH } from '../../config.js';
import { layout } from '../../layout.js';
import { createStyleSurface } from '../sprites/adapter.js';

const rand = (art, lo, hi) => lo + art.random() * (hi - lo);

const GAP = [4, 10]; // seconds between stars
const FIRST = [1.5, 4]; // seconds before the first one
const START_BELOW = 200; // they start above this

export function createShootingStars(art) {
  const surface = createStyleSurface(art, {}, false);
  const view = surface.view;
  let wait = rand(art, ...FIRST);
  let star = null;
  let drawn = false;

  function spawn() {
    const dir = art.random() < 0.5 ? -1 : 1; // heading left or right
    const angle = rand(art, 0.15, 0.45); // below the horizontal, radians
    const speed = rand(art, 400, 600); // px/s: slow enough to watch
    const life = rand(art, 1.2, 1.9);
    return {
      // Starts on the side it comes from, so most of the streak is on screen.
      x: dir > 0 ? rand(art, 0, WIDTH * 0.6) : rand(art, WIDTH * 0.4, WIDTH),
      y: rand(art, -layout.extra + 20, START_BELOW),
      vx: Math.cos(angle) * speed * dir,
      vy: Math.sin(angle) * speed,
      tail: rand(art, 90, 160),
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
      wait = rand(art, ...GAP);
      star = spawn();
    },
    render() {
      const draw = surface.draw;
      if (!star) {
        if (drawn) draw.clear();
        drawn = false;
        return;
      }
      draw.clear();
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
        draw.curve(
          [
            ['moveTo', star.x - ux * a, star.y - uy * a],
            ['lineTo', star.x - ux * b, star.y - uy * b],
          ],
          { stroke: 0xdfe8ff, width: 0.6 + 1.8 * k, alpha: alpha * k * 0.9 },
        );
      }
      draw.circle(star.x, star.y, 4, { fill: 0xffffff, alpha: alpha * 0.25 });
      draw.circle(star.x, star.y, 1.8, { fill: 0xffffff, alpha: alpha });
    },
  };
}
