// Particles, score pop-ups and screen shake, driven by world events.

import { Container, Graphics } from 'pixi.js';
import { COLORS } from './backdrop.js';
import { label } from './text.js';
import { ARENA } from '../config.js';
import { POWER_COLOR } from './powerupView.js';

const other = (side) => (side === 'red' ? 'blue' : 'red');
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

export function createEffects() {
  const view = new Container();
  const g = new Graphics();
  view.addChild(g);
  const particles = [];
  const rings = [];
  const stains = []; // splat marks on the ground, fading out
  const popups = [];
  let shake = 0;
  const hitFlash = { red: 0, blue: 0 };

  /** Spray `count` particles. `dir` biases them sideways (-1/+1), `up` upward. */
  function burst(x, y, { count, colors, speed = [60, 240], life = [0.3, 0.7], size = [1.5, 3.5], gravity = 400, dir = 0, up = 0, shape = 'dot' }) {
    for (let i = 0; i < count; i++) {
      let angle = rand(0, Math.PI * 2);
      if (dir) angle = (dir > 0 ? 0 : Math.PI) + rand(-0.9, 0.9);
      if (up) angle = -Math.PI / 2 + rand(-up, up);
      const v = rand(...speed);
      const max = rand(...life);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: max,
        max,
        size: rand(...size),
        color: colors[i % colors.length],
        gravity,
        shape,
        spin: rand(0, Math.PI),
      });
    }
  }

  function ring(x, y, color, radius, life = 0.35) {
    rings.push({ x, y, color, radius, life, max: life });
  }

  function popup(text, x, y, color) {
    const t = label(text, { size: 26, color, bold: true, anchorX: 0.5, anchorY: 0.5 });
    t.position.set(x, y);
    view.addChild(t);
    popups.push({ t, life: 1.2 });
  }

  function handle(events) {
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          burst(e.x, e.y, { count: 6, colors: [COLORS[e.side], 0xffffff], speed: [40, 120], life: [0.1, 0.25], gravity: 0 });
          break;
        case 'hit':
          burst(e.x, e.y, { count: 34, colors: [0xffffff, COLORS[other(e.side)], 0xfff3a0], dir: e.dir, speed: [140, 480], life: [0.35, 0.8], size: [2, 4.5] });
          ring(e.x, e.y, COLORS[other(e.side)], 56);
          hitFlash[e.side] = 1;
          shake = Math.max(shake, 7);
          break;
        case 'bump':
          burst(e.x, e.y, { count: 10, colors: [0xcfd6ff, 0x8a93c0], speed: [40, 140], life: [0.2, 0.4], gravity: 0 });
          shake = Math.max(shake, 2);
          break;
        case 'interrupt':
          burst(e.x, e.y, { count: 8, colors: [COLORS[e.side]], speed: [30, 100], life: [0.2, 0.4], gravity: 0 });
          break;
        case 'pickup':
          burst(e.x, e.y, { count: 12, colors: [0xffffff, COLORS[e.side]], speed: [40, 120], life: [0.3, 0.6], gravity: -60, shape: 'star' });
          break;
        case 'dropLanded':
          burst(e.x, e.y, { count: 8, colors: [0x7a5a3a, 0x9c7a52], up: 1.2, speed: [30, 90], life: [0.2, 0.4], gravity: 300 });
          break;
        case 'powerup':
          burst(e.x, e.y - 15, { count: 36, colors: [POWER_COLOR, 0xffffff, 0xfff3a0], speed: [80, 320], life: [0.5, 1], size: [2, 4], gravity: -40, shape: 'star' });
          ring(e.x, e.y - 15, POWER_COLOR, 80, 0.5);
          break;
        case 'ammoCrate':
          burst(e.x, e.y - 15, { count: 24, colors: [0xd9a93a, 0xffd76a, 0xffffff], speed: [80, 260], life: [0.4, 0.8], size: [2, 4], gravity: -30, shape: 'star' });
          ring(e.x, e.y - 15, 0xffd76a, 60, 0.4);
          break;
        case 'explosion':
          if (e.big) {
            burst(e.x, e.y, { count: 50, colors: [0xffd24a, 0xff8a3a, 0xff4a2a, 0xffffff], speed: [120, 520], life: [0.3, 0.9], size: [2.5, 6], gravity: 250 });
            burst(e.x, e.y, { count: 16, colors: [0x5a5f6a, 0x7a7f8a], speed: [30, 120], life: [0.8, 1.4], size: [5, 9], gravity: -60 });
            ring(e.x, e.y, 0xffa53a, 110, 0.45);
            shake = Math.max(shake, 11);
          } else {
            burst(e.x, e.y, { count: 16, colors: [0xffd24a, 0xff8a3a, 0x7a7f8a], speed: [60, 220], life: [0.2, 0.5], size: [2, 4], gravity: 100 });
          }
          break;
        case 'rocketLaunch':
          burst(e.x, e.y, { count: 12, colors: [0xcfd6ff, 0x8a93c0], speed: [40, 140], life: [0.3, 0.6], size: [3, 5], gravity: -40 });
          break;
        case 'splat':
          // A cartoon cloud of blood, a stain on the grass, and a "SPLAT!".
          burst(e.x, e.y - 12, { count: 60, colors: [0xd21f2a, 0xa3121c, 0xff4050, 0x6e0a12], up: 1.3, speed: [120, 480], life: [0.5, 1.1], size: [2.5, 6], gravity: 900 });
          burst(e.x, e.y - 18, { count: 18, colors: [0xb5171f, 0xe0303a], speed: [20, 90], life: [0.6, 1.2], size: [6, 11], gravity: -20 });
          ring(e.x, e.y - 12, 0xd21f2a, 60, 0.35);
          stains.push({ x: e.x, w: 30 + Math.random() * 20, life: 8, max: 8 });
          popup('SPLAT!', e.x, e.y - 70, 0xff4050);
          shake = Math.max(shake, 5);
          break;
        case 'knockLoose':
          burst(e.x, e.y, { count: 20, colors: [0xffffff, 0xff5ce1, COLORS[e.side]], speed: [80, 260], life: [0.3, 0.6], size: [2, 4], gravity: 200, shape: 'star' });
          ring(e.x, e.y, 0xff5ce1, 40);
          break;
        case 'land':
          if (e.delivered && e.golden) {
            burst(e.x, e.y - 10, { count: 70, colors: [0xffcf3a, 0xfff3a0, 0xffffff], up: 1.1, speed: [200, 560], life: [0.8, 1.6], size: [3, 6], gravity: 500, shape: 'star' });
            ring(e.x, e.y - 14, 0xffcf3a, 120, 0.7);
            popup(`+${e.value}`, e.x, e.y - 70, 0xffcf3a);
          } else if (e.delivered) {
            burst(e.x, e.y - 10, { count: 44, colors: [COLORS[e.pen], 0xffd76a, 0xffffff], up: 0.7, speed: [200, 460], life: [0.8, 1.3], size: [3, 5.5], gravity: 650, shape: 'confetti' });
            ring(e.x, e.y - 14, 0xffd76a, 70, 0.45);
            popup(`+${e.value}`, e.x, e.y - 60, e.stolen ? 0xcfd6ff : 0xffd76a);
          } else {
            burst(e.x, e.y, { count: 10, colors: [0x7a5a3a, 0x9c7a52], up: 1.2, speed: [30, 90], life: [0.2, 0.4], gravity: 300 });
          }
          break;
      }
    }
  }

  /** Continuous effects that follow world state rather than events. */
  function ambient(world) {
    // Rockets leave a smoke trail.
    for (const r of world.rockets) {
      const bx = r.x - Math.cos(r.angle) * 14;
      const by = r.y - Math.sin(r.angle) * 14;
      burst(bx, by, { count: 1, colors: [0xffa53a], speed: [10, 40], life: [0.1, 0.2], size: [2, 3.5], gravity: 0 });
      burst(bx, by, { count: 1, colors: [0x9aa0ab, 0x6a707b], speed: [5, 25], life: [0.5, 0.9], size: [3, 6], gravity: -30 });
    }
    // Golden animals glitter.
    for (const a of world.animals) {
      if (!a.golden || Math.random() > 0.25) continue;
      const x = a.x + rand(-30, 30);
      const y = a.y - rand(0, 50);
      burst(x, y, { count: 1, colors: [0xfff3a0, 0xffffff], speed: [5, 25], life: [0.3, 0.6], size: [1.5, 3], gravity: -30, shape: 'star' });
    }
    for (const side of ['red', 'blue']) {
      const b = world.lasers[side];
      if (b?.hit) {
        burst(b.x1, b.y, { count: 2, colors: [0xffffff, 0xff5ce1], dir: -b.dir, speed: [80, 260], life: [0.15, 0.35], gravity: 200 });
        shake = Math.max(shake, 1.5);
      }
    }
  }

  function update(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= Math.exp(-1.5 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += dt * 8;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    for (const r of rings) r.life -= dt;
    for (const s of stains) s.life -= dt;
    for (let i = stains.length - 1; i >= 0; i--) if (stains[i].life <= 0) stains.splice(i, 1);
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1);

    for (const p of popups) {
      p.life -= dt;
      p.t.y -= 40 * dt;
      p.t.alpha = Math.min(1, p.life * 2);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      if (popups[i].life <= 0) {
        popups[i].t.destroy();
        popups.splice(i, 1);
      }
    }

    shake = Math.max(0, shake - dt * 30);
    hitFlash.red = Math.max(0, hitFlash.red - dt * 2.5);
    hitFlash.blue = Math.max(0, hitFlash.blue - dt * 2.5);
  }

  function render() {
    g.clear();
    for (const s of stains) {
      const alpha = Math.min(0.85, s.life / s.max * 1.5);
      g.ellipse(s.x, ARENA.groundY + 3, s.w, 6).fill({ color: 0x7a0c14, alpha });
      g.ellipse(s.x - s.w * 0.3, ARENA.groundY + 2, s.w * 0.35, 3).fill({ color: 0xa3121c, alpha });
    }
    for (const r of rings) {
      const u = 1 - r.life / r.max;
      g.circle(r.x, r.y, 6 + r.radius * Math.sqrt(u)).stroke({ color: r.color, width: 4 * (1 - u) + 1, alpha: 1 - u });
    }
    for (const p of particles) {
      const alpha = Math.min(1, p.life / p.max * 2);
      if (p.shape === 'confetti') {
        const w = p.size * 1.6 * Math.abs(Math.cos(p.spin));
        g.rect(p.x - w / 2, p.y - p.size / 2, Math.max(0.5, w), p.size).fill({ color: p.color, alpha });
      } else if (p.shape === 'star') {
        const s = p.size;
        g.poly([p.x, p.y - s * 2, p.x + s * 0.5, p.y, p.x, p.y + s * 2, p.x - s * 0.5, p.y]).fill({ color: p.color, alpha });
        g.poly([p.x - s * 2, p.y, p.x, p.y - s * 0.5, p.x + s * 2, p.y, p.x, p.y + s * 0.5]).fill({ color: p.color, alpha });
      } else {
        g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha });
      }
    }
  }

  return {
    view,
    handle,
    ambient,
    update,
    render,
    hitFlash,
    /** Current camera offset for screen shake. */
    shakeOffset() {
      return shake > 0 ? { x: rand(-shake, shake), y: rand(-shake, shake) } : { x: 0, y: 0 };
    },
  };
}
