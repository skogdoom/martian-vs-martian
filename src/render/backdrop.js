// Arena scenery: night sky, stars, moon, hills, ground and the two pens.
// `createBackdrop()` returns { view, tick(t) }; tick animates stars and flags.

import { Container, Graphics, FillGradient } from 'pixi.js';
import { WIDTH, HEIGHT, ARENA } from '../config.js';
import { PAD } from '../layout.js';
import { createRng } from '../logic/rng.js';
import { label } from './text.js';

export const COLORS = {
  red: 0xe5484d,
  blue: 0x3e8ef7,
};

const WOOD = 0x7a5530;
const WOOD_DARK = 0x4e3520;
const GROUND = ARENA.groundY;

function sky(g) {
  const gradient = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 0x050817 },
      { offset: 0.55, color: 0x15204a },
      { offset: 1, color: 0x3b2f5e },
    ],
    textureSpace: 'local',
  });
  g.rect(0, -PAD, WIDTH, GROUND + PAD).fill(gradient);
}

function stars(rng) {
  // Three groups that twinkle out of phase.
  const groups = [new Graphics(), new Graphics(), new Graphics()];
  const count = Math.round(150 * (1 + PAD / GROUND)); // the sky reaches PAD px above the arena
  for (let i = 0; i < count; i++) {
    const x = rng() * WIDTH;
    const y = -PAD + rng() * (rng() < 0.5 ? 1 : rng()) * (GROUND - 120 + PAD);
    const r = rng() < 0.12 ? 1.8 : 0.6 + rng() * 0.8;
    groups[i % 3].circle(x, y, r).fill({ color: 0xffffff, alpha: 0.5 + rng() * 0.5 });
  }
  return groups;
}

// The moon's phase, picked once when the page loads, so the menu and every
// round of the session share it. `lit` is where the light is (+1 right, -1
// left); `bulge` is the terminator: -1 new, 0 half, +1 full.
export const MOON_PHASES = {
  waning: { lit: -1, bulge: -0.45 }, // a crescent, lit on the left
  quarter: { lit: 1, bulge: 0 }, // half
  waxing: { lit: 1, bulge: 0.55 }, // more than half, lit on the right
  full: { lit: 1, bulge: 1 },
};
const PHASE_NAMES = Object.keys(MOON_PHASES);
export const moonPhase = PHASE_NAMES[Math.floor(Math.random() * PHASE_NAMES.length)];

/** Outline of the lit part of a moon of radius `r` centred on (0, 0): down the
 * lit limb, then back up along the terminator. */
export function moonLitOutline(phase, r, steps = 24) {
  const { lit, bulge } = MOON_PHASES[phase];
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const y = -r + (2 * r * i) / steps;
    pts.push(lit * Math.sqrt(Math.max(0, r * r - y * y)), y);
  }
  for (let i = steps; i >= 0; i--) {
    const y = -r + (2 * r * i) / steps;
    pts.push(-lit * bulge * Math.sqrt(Math.max(0, r * r - y * y)), y);
  }
  return pts;
}

/** Is the point (dx, dy) from the centre on the lit part? */
function isLit(phase, r, dx, dy) {
  const { lit, bulge } = MOON_PHASES[phase];
  return lit * dx >= -bulge * Math.sqrt(Math.max(0, r * r - dy * dy));
}

function moon(g, phase = moonPhase) {
  const x = 930;
  const y = 120;
  const r = 32;
  // The glow is fainter the less of it is lit.
  const glow = (1 + MOON_PHASES[phase].bulge) / 2;
  g.circle(x, y, 60).fill({ color: 0xfff6d8, alpha: 0.02 + 0.04 * glow });
  g.circle(x, y, 44).fill({ color: 0xfff6d8, alpha: 0.03 + 0.05 * glow });
  // The dark side, just visible against the sky.
  g.circle(x, y, r).fill({ color: 0x2b3150, alpha: 0.9 });
  g.poly(moonLitOutline(phase, r).map((v, i) => v + (i % 2 ? y : x))).fill(0xf3ecd2);
  for (const [dx, dy, cr] of [
    [-10, -6, 7],
    [9, 9, 5],
    [12, -12, 3],
  ]) {
    if (isLit(phase, r, dx, dy)) g.circle(x + dx, y + dy, cr).fill(0xdcd3b4);
  }
}

/** A band of rolling hills from `base` down to the ground. */
function hills(g, base, amp, color, phase) {
  const pts = [0, GROUND];
  for (let x = 0; x <= WIDTH; x += 16) {
    const y = base - amp * (0.55 * Math.sin(x / 170 + phase) + 0.3 * Math.sin(x / 67 + phase * 2) + 0.15 * Math.sin(x / 31));
    pts.push(x, y);
  }
  pts.push(WIDTH, GROUND);
  g.poly(pts).fill(color);
}

function ground(g) {
  g.rect(0, GROUND, WIDTH, HEIGHT - GROUND + PAD).fill(0x4a3322); // dirt runs on below the arena
  g.rect(0, GROUND, WIDTH, 14).fill(0x3f8a3a);
  g.rect(0, GROUND, WIDTH, 4).fill(0x5cae52);
  const rng = createRng(7);
  for (let i = 0; i < 90; i++) {
    const x = rng() * WIDTH;
    g.moveTo(x, GROUND + 2)
      .lineTo(x + (rng() - 0.5) * 6, GROUND - 5 - rng() * 5)
      .stroke({ color: 0x5cae52, width: 2 });
  }
  for (let i = 0; i < 40; i++) {
    g.circle(rng() * WIDTH, GROUND + 22 + rng() * 34, 1.5 + rng() * 2).fill(0x5d4330);
  }
}

function pen(g, side) {
  const { left, right } = ARENA.pens[side];
  const fieldX = side === 'red' ? right : left;
  // Straw floor.
  g.rect(left, GROUND, right - left, 14).fill(0xc9a44a);
  g.rect(left, GROUND, right - left, 4).fill(0xe0c068);
  // Back fence, behind the animals.
  for (let x = left + 12; x < right; x += 34) g.rect(x - 3, GROUND - 42, 6, 42).fill(WOOD_DARK);
  g.rect(left, GROUND - 36, right - left, 5).fill(WOOD_DARK);
  g.rect(left, GROUND - 20, right - left, 5).fill(WOOD_DARK);
  // Gatepost on the field side.
  g.rect(fieldX - 5, GROUND - 56, 10, 56).fill(WOOD);
  g.rect(fieldX - 5, GROUND - 56, 10, 4).fill(0x9c7244);
  // Flagpole.
  const poleX = side === 'red' ? left + 26 : right - 26;
  g.rect(poleX - 2, GROUND - 170, 4, 170).fill(0xb8bcc8);
  g.circle(poleX, GROUND - 172, 4).fill(0xe8e8f0);
}

function flag(side) {
  const g = new Graphics();
  const { left, right } = ARENA.pens[side];
  const poleX = side === 'red' ? left + 26 : right - 26;
  const dir = side === 'red' ? 1 : -1;
  const top = GROUND - 166;
  return {
    g,
    tick(t) {
      g.clear();
      const pts = [];
      const len = 60;
      const hgt = 34;
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        pts.push(poleX + dir * u * len, top + Math.sin(t * 5 - u * 4) * 3 * u);
      }
      for (let i = 6; i >= 0; i--) {
        const u = i / 6;
        pts.push(poleX + dir * u * len, top + hgt + Math.sin(t * 5 - u * 4) * 3 * u);
      }
      g.poly(pts).fill(COLORS[side]);
    },
  };
}

export function createBackdrop() {
  const view = new Container();
  const rng = createRng(42);

  const back = new Graphics();
  sky(back);
  moon(back);
  const starGroups = stars(rng);

  const land = new Graphics();
  hills(land, 560, 50, 0x1c2544, 0.8);
  hills(land, 610, 36, 0x1d3a2c, 2.3);
  // Faint marker for the lowest flight level.
  for (let x = 8; x < WIDTH; x += 24) land.rect(x, ARENA.flightBottom, 10, 1).fill({ color: 0xffffff, alpha: 0.08 });
  ground(land);
  pen(land, 'red');
  pen(land, 'blue');

  const flags = [flag('red'), flag('blue')];

  view.addChild(back, ...starGroups, land, ...flags.map((f) => f.g));

  for (const side of ['red', 'blue']) {
    const { left, right } = ARENA.pens[side];
    const t = label(side === 'red' ? 'RED PEN' : 'BLUE PEN', { size: 14, color: 0xffffff, bold: true, anchorX: 0.5 });
    t.alpha = 0.8;
    t.position.set((left + right) / 2, GROUND + 32);
    view.addChild(t);
  }

  function tick(t) {
    starGroups.forEach((g, i) => {
      g.alpha = 0.65 + 0.35 * Math.sin(t * (1.3 + i * 0.4) + i * 2.1);
    });
    for (const f of flags) f.tick(t);
  }
  tick(0);

  return { view, tick };
}
