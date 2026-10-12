// Arena scenery: night sky, stars, moon, hills, ground and the two pens, and
// on special days a Santa hat and snow, fireworks, maypoles, a battle station,
// or a Halloween sky (see occasion.js).
// `createBackdrop()` returns { view, tick(t) }; tick animates stars and flags.

import { WIDTH, HEIGHT, ARENA } from '../../config.js';
import { PAD, menuLift } from '../../layout.js';
import { createRng } from '../../logic/rng.js';
import { label } from './text.js';
import { occasion } from '../../occasion.js';
import { createSantaHat, createSnow, createFireworks, createSpookySky, createLanterns } from './festive.js';
import { variant } from '../sprites/variant.js';
import { cartoonBackdrop, cartoonPenForeground } from '../sprites/backdrop.js';

export const COLORS = {
  red: 0xe5484d,
  blue: 0x3e8ef7,
};

const WOOD = 0x7a5530;
const WOOD_DARK = 0x4e3520;
const GROUND = ARENA.groundY;

function sky(art, g) {
  const image = art.scope.bitmap(
    { x: 0, y: -PAD, width: WIDTH, height: GROUND + PAD },
    (ctx) => {
      const gradient = ctx.createLinearGradient(0, -PAD, 0, GROUND);
      gradient.addColorStop(0, '#050817');
      gradient.addColorStop(0.55, '#15204a');
      gradient.addColorStop(1, '#3b2f5e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, -PAD, WIDTH, GROUND + PAD);
    },
    { resolution: 1 },
    g,
  );
  return image;
}

function stars(art, rng) {
  // Three groups that twinkle out of phase.
  const groups = [art.graphics(), art.graphics(), art.graphics()];
  const count = Math.round(150 * (1 + PAD / GROUND)); // the sky reaches PAD px above the arena
  for (let i = 0; i < count; i++) {
    const x = rng() * WIDTH;
    const y = -PAD + rng() * (rng() < 0.5 ? 1 : rng()) * (GROUND - 120 + PAD);
    const r = rng() < 0.12 ? 1.8 : 0.6 + rng() * 0.8;
    art.draw(groups[i % 3]).circle(x, y, r, { fill: 0xffffff, alpha: 0.5 + rng() * 0.5 });
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
// Where it hangs: just right of the title on the menu, half below it. Every
// scene puts it in the same place on screen, so it doesn't move when a round
// starts (on a tall screen that means lifting it with the menu text).
export const MOON_AT = { x: 1002, y: 188 };
// Always full at Christmas (to wear the Santa hat with a smile) and at Halloween.
const ALWAYS_FULL = new Set(['christmas', 'halloween']);
export const moonPhase = ALWAYS_FULL.has(occasion) ? 'full' : PHASE_NAMES[Math.floor(Math.random() * PHASE_NAMES.length)];
// Moonlight, craters and glow: pale, or a big orange harvest moon at Halloween.
const MOON_COLOURS =
  occasion === 'halloween' ? { lit: 0xffa13d, crater: 0xe0832a, glow: 0xffb35c } : { lit: 0xf3ecd2, crater: 0xdcd3b4, glow: 0xfff6d8 };

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

/** Drawn around (0, 0); the backdrop puts it at MOON_AT. */
function moon(art, g, phase = moonPhase) {
  if (occasion === 'mayTheFourth') {
    battleStation(art, g);
    return;
  }
  const x = 0;
  const y = 0;
  const r = 32;
  // The glow is fainter the less of it is lit.
  const glow = (1 + MOON_PHASES[phase].bulge) / 2;
  const { lit, crater, glow: haze } = MOON_COLOURS;
  art.draw(g).circle(x, y, 60, { fill: haze, alpha: 0.02 + 0.04 * glow });
  art.draw(g).circle(x, y, 44, { fill: haze, alpha: 0.03 + 0.05 * glow });
  // The dark side, just visible against the sky.
  art.draw(g).circle(x, y, r, { fill: 0x2b3150, alpha: 0.9 });
  art.draw(g).polygon(
    moonLitOutline(phase, r).map((v, i) => v + (i % 2 ? y : x)),
    { fill: lit },
  );
  if (occasion === 'christmas') {
    smile(art, g, x, y);
    return;
  }
  for (const [dx, dy, cr] of [
    [-10, -6, 7],
    [9, 9, 5],
    [12, -12, 3],
  ]) {
    if (isLit(phase, r, dx, dy)) art.draw(g).circle(x + dx, y + dy, cr, { fill: crater });
  }
}

/** On 4 May: that's no moon. A grey battle station of radius 34 at (0, 0),
 * with a trench round its middle, panel lines and a big dish up top. */
function battleStation(art, g) {
  const r = 34;
  art.draw(g).circle(0, 0, 54, { fill: 0xc8d0e0, alpha: 0.05 });
  art.draw(g).circle(0, 0, r, { fill: 0x8d939e });
  // Shading on the side away from the light.
  art.draw(g).circle(5, 4, r - 2, { fill: 0x6b717c, alpha: 0.35 });
  art.draw(g).circle(-4, -4, r - 8, { fill: 0xa3a9b3, alpha: 0.5 });
  // Panel lines above and below the trench.
  for (const y of [-22, -12, 11, 21]) {
    const half = Math.sqrt(r * r - y * y);
    art.draw(g).curve(
      [
        ['moveTo', -half + 2, y],
        ['lineTo', half - 2, y],
      ],
      { stroke: 0x5f646e, width: 1, alpha: 0.6 },
    );
  }
  for (const x of [-20, -6, 8, 22]) {
    art.draw(g).curve(
      [
        ['moveTo', x, -Math.sqrt(r * r - x * x) + 3],
        ['lineTo', x, Math.sqrt(r * r - x * x) - 3],
      ],
      { stroke: 0x5f646e, width: 0.6, alpha: 0.35 },
    );
  }
  // The trench round the equator.
  art.draw(g).curve(
    [
      ['moveTo', -r, 0],
      ['quadraticCurveTo', 0, 5, r, 0],
    ],
    { stroke: 0x3e424a, width: 3 },
  );
  // The dish, upper left, with its focus point.
  art.draw(g).circle(-13, -15, 10, { fill: 0x6f7580 });
  art.draw(g).circle(-12, -14, 7, { fill: 0x5a5f69 });
  art.draw(g).circle(-13, -15, 10, { stroke: 0x4a4e57, width: 1.2 });
  art.draw(g).circle(-12, -14, 1.6, { fill: 0x9fe08a });
  // A few lit windows.
  for (const [x, y] of [
    [10, -26],
    [18, -6],
    [-24, 8],
    [6, 16],
    [22, 14],
  ])
    art.draw(g).rect(x, y, 2, 1, { fill: 0xfff3c0, alpha: 0.8 });
}

/** A happy face on a full moon of radius 32 at (x, y), under a Santa hat. */
function smile(art, g, x, y) {
  const ink = 0x6b5d3e;
  art.draw(g).ellipse(x - 10, y - 4, 3.2, 4.4, { fill: ink });
  art.draw(g).ellipse(x + 10, y - 4, 3.2, 4.4, { fill: ink });
  art.draw(g).circle(x - 9, y - 5.5, 1.1, { fill: 0xfffbe8 });
  art.draw(g).circle(x + 11, y - 5.5, 1.1, { fill: 0xfffbe8 });
  art.draw(g).circle(x - 18, y + 6, 5, { fill: 0xff8a8a, alpha: 0.45 });
  art.draw(g).circle(x + 18, y + 6, 5, { fill: 0xff8a8a, alpha: 0.45 });
  art.draw(g).curve(
    [
      ['moveTo', x - 13, y + 6],
      ['quadraticCurveTo', x, y + 21, x + 13, y + 6],
    ],
    { stroke: ink, width: 2.6, cap: 'round' },
  );
}

/** A band of rolling hills from `base` down to the ground. */
function hills(art, g, base, amp, color, phase) {
  const pts = [0, GROUND];
  for (let x = 0; x <= WIDTH; x += 16) {
    const y = base - amp * (0.55 * Math.sin(x / 170 + phase) + 0.3 * Math.sin(x / 67 + phase * 2) + 0.15 * Math.sin(x / 31));
    pts.push(x, y);
  }
  pts.push(WIDTH, GROUND);
  art.draw(g).polygon(pts, { fill: color });
}

function ground(art, g) {
  art.draw(g).rect(0, GROUND, WIDTH, HEIGHT - GROUND + PAD, { fill: 0x4a3322 }); // dirt runs on below the arena
  art.draw(g).rect(0, GROUND, WIDTH, 14, { fill: 0x3f8a3a });
  art.draw(g).rect(0, GROUND, WIDTH, 4, { fill: 0x5cae52 });
  const rng = createRng(7);
  for (let i = 0; i < 90; i++) {
    const x = rng() * WIDTH;
    art.draw(g).curve(
      [
        ['moveTo', x, GROUND + 2],
        ['lineTo', x + (rng() - 0.5) * 6, GROUND - 5 - rng() * 5],
      ],
      { stroke: 0x5cae52, width: 2 },
    );
  }
  for (let i = 0; i < 40; i++) {
    art.draw(g).circle(rng() * WIDTH, GROUND + 22 + rng() * 34, 1.5 + rng() * 2, { fill: 0x5d4330 });
  }
}

function pen(art, g, side) {
  const { left, right } = ARENA.pens[side];
  const fieldX = side === 'red' ? right : left;
  // Straw floor.
  art.draw(g).rect(left, GROUND, right - left, 14, { fill: 0xc9a44a });
  art.draw(g).rect(left, GROUND, right - left, 4, { fill: 0xe0c068 });
  // Back fence, behind the animals.
  for (let x = left + 12; x < right; x += 34) art.draw(g).rect(x - 3, GROUND - 42, 6, 42, { fill: WOOD_DARK });
  art.draw(g).rect(left, GROUND - 36, right - left, 5, { fill: WOOD_DARK });
  art.draw(g).rect(left, GROUND - 20, right - left, 5, { fill: WOOD_DARK });
  // Gatepost on the field side.
  art.draw(g).rect(fieldX - 5, GROUND - 56, 10, 56, { fill: WOOD });
  art.draw(g).rect(fieldX - 5, GROUND - 56, 10, 4, { fill: 0x9c7244 });
  // Flagpole, or at midsummer a maypole.
  const poleX = flagpoleX(side);
  if (occasion === 'midsummer') {
    maypole(art, g, poleX);
    return;
  }
  art.draw(g).rect(poleX - 2, GROUND - 170, 4, 170, { fill: 0xb8bcc8 });
  art.draw(g).circle(poleX, GROUND - 172, 4, { fill: 0xe8e8f0 });
}

const LEAF = 0x3f8f3a;
const LEAF_DARK = 0x2c6a2a;
const BLOOMS = [0xffffff, 0xffd84a, 0xff7fb0, 0x8fb8ff];

/** A Swedish midsummer pole: wrapped in leaves, a crossbar with a wreath
 * hanging from each end, flowers all over. */
function maypole(art, g, x) {
  const top = GROUND - 176;
  const barY = GROUND - 132;
  // The pole, wrapped in greenery.
  art.draw(g).rect(x - 4, top, 8, GROUND - top, { fill: LEAF_DARK });
  for (let y = top + 4; y < GROUND - 4; y += 9) {
    art.draw(g).ellipse(x - 4, y, 5, 3, { fill: LEAF });
    art.draw(g).ellipse(x + 4, y + 4, 5, 3, { fill: LEAF });
  }
  // The crossbar.
  art.draw(g).rect(x - 34, barY - 3, 68, 6, { fill: LEAF_DARK });
  for (let dx = -32; dx <= 32; dx += 8) art.draw(g).ellipse(x + dx, barY - 2, 4.5, 3, { fill: LEAF });
  // A wreath hanging from each end.
  for (const dx of [-30, 30]) {
    const cx = x + dx;
    const cy = barY + 22;
    art.draw(g).curve(
      [
        ['moveTo', cx, barY + 2],
        ['lineTo', cx, cy - 13],
      ],
      { stroke: LEAF_DARK, width: 2 },
    );
    art.draw(g).circle(cx, cy, 13, { stroke: LEAF, width: 6 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      art.draw(g).circle(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, 2.2, { fill: BLOOMS[i % BLOOMS.length] });
    }
  }
  // Flowers on the pole and the bar, and a crown of leaves on top.
  for (let y = top + 10, i = 0; y < GROUND - 10; y += 17, i++) art.draw(g).circle(x + (i % 2 ? 3 : -3), y, 2.4, { fill: BLOOMS[i % BLOOMS.length] });
  for (let dx = -28, i = 1; dx <= 28; dx += 14, i++) art.draw(g).circle(x + dx, barY - 4, 2.4, { fill: BLOOMS[i % BLOOMS.length] });
  art.draw(g).ellipse(x, top - 2, 9, 6, { fill: LEAF });
}

/** Where the flagpole stands; a maypole further in, so its wreaths fit on screen. */
function flagpoleX(side) {
  const { left, right } = ARENA.pens[side];
  const inset = occasion === 'midsummer' ? 46 : 26;
  return side === 'red' ? left + inset : right - inset;
}

function flag(art, side) {
  // The points change every frame. Submit native geometry in WebGL instead of
  // allocating, rasterizing and uploading a fresh texture for each flag.
  const g = art.dynamicGraphics();
  const poleX = flagpoleX(side);
  const dir = side === 'red' ? 1 : -1;
  const top = GROUND - 166;
  if (occasion === 'midsummer') return ribbon(art, g, side, poleX, dir);
  return {
    g,
    tick(t) {
      art.draw(g).clear();
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
      art.draw(g).polygon(pts, { fill: COLORS[side] });
    },
  };
}

/** At midsummer: a long ribbon in the team colour fluttering from the top of
 * the maypole, so each pen still shows whose it is. */
function ribbon(art, g, side, poleX, dir) {
  const top = GROUND - 178;
  return {
    g,
    tick(t) {
      art.draw(g).clear();
      for (const [dy, w, len] of [
        [0, 7, 74],
        [9, 5, 58],
      ]) {
        const pts = [];
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          pts.push(poleX + dir * u * len, top + dy + u * 26 + Math.sin(t * 5 - u * 5 + dy) * 5 * u);
        }
        for (let i = steps; i >= 0; i--) {
          const u = i / steps;
          pts.push(poleX + dir * u * len, top + dy + u * 26 + w * (1 - u * 0.5) + Math.sin(t * 5 - u * 5 + dy) * 5 * u);
        }
        art.draw(g).polygon(pts, { fill: dy ? 0xffd84a : COLORS[side] });
      }
    },
  };
}

export function createBackdrop(art, phase = moonPhase) {
  return variant(
    art,
    () => classicBackdrop(art, phase),
    () => cartoonBackdrop(art, phase),
  );
}

export function createPenForeground(art) {
  const layer = variant(
    art,
    () => ({ view: art.container() }),
    () => cartoonPenForeground(art),
  );
  layer.view.name = 'pen-foreground';
  return layer;
}

function classicBackdrop(art, phase) {
  const view = art.container();
  const rng = createRng(42);

  const back = art.graphics();
  sky(art, back);
  const starGroups = stars(art, rng);
  const moonView = art.graphics();
  moon(art, moonView, ALWAYS_FULL.has(occasion) ? 'full' : phase);
  // Special days (occasion.js): a Santa hat and snow, or fireworks.
  const hat = occasion === 'christmas' ? createSantaHat(art) : null;
  const snow = occasion === 'christmas' ? createSnow(art) : null;
  const fireworks = occasion === 'newYearsEve' ? createFireworks(art) : null;
  const spooky = occasion === 'halloween' ? createSpookySky(art) : null;
  // Jack-o'-lanterns on top of the gateposts, on the field side of each pen.
  const lanterns =
    occasion === 'halloween'
      ? createLanterns(
          art,
          [ARENA.pens.red.right, ARENA.pens.blue.left].map((x) => ({ x, y: GROUND - 56 })),
        )
      : null;
  const placeMoon = () => {
    moonView.setPosition(MOON_AT.x, MOON_AT.y + menuLift());
    hat?.setPosition(moonView.x, moonView.y);
  };
  placeMoon();

  const land = art.graphics();
  hills(art, land, 560, 50, 0x1c2544, 0.8);
  hills(art, land, 610, 36, 0x1d3a2c, 2.3);
  // Faint marker for the lowest flight level.
  for (let x = 8; x < WIDTH; x += 24) art.draw(land).rect(x, ARENA.flightBottom, 10, 1, { fill: 0xffffff, alpha: 0.08 });
  ground(art, land);
  pen(art, land, 'red');
  pen(art, land, 'blue');

  const flags = [flag(art, 'red'), flag(art, 'blue')];

  // Fireworks go off behind the hills; snow falls in front of everything here.
  art.add(
    view,
    back,
    ...starGroups,
    ...(fireworks ? [fireworks.view] : []),
    moonView,
    ...(hat ? [hat] : []),
    ...(spooky ? [spooky.view] : []),
    land,
    ...flags.map((f) => f.g),
  );

  for (const side of ['red', 'blue']) {
    const { left, right } = ARENA.pens[side];
    const t = label(art, side === 'red' ? 'RED PEN' : 'BLUE PEN', { size: 14, color: 0xffffff, bold: true, anchorX: 0.5 });
    t.alpha = 0.8;
    t.setPosition((left + right) / 2, GROUND + 32);
    art.add(view, t);
  }
  if (snow) art.add(view, snow.view);
  if (lanterns) art.add(view, lanterns.view);

  function tick(t) {
    starGroups.forEach((g, i) => {
      g.alpha = 0.65 + 0.35 * Math.sin(t * (1.3 + i * 0.4) + i * 2.1);
    });
    for (const f of flags) f.tick(t);
    placeMoon(); // the screen may have changed shape
    snow?.tick(t);
    fireworks?.tick(t);
    spooky?.tick(t);
    lanterns?.tick(t);
  }
  tick(0);

  return { view, tick };
}
