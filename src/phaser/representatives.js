// Representative original recipes, with native Phaser containers for moving
// parts. Complete animations/powers and remaining artwork belong to milestone 3.
import { SAUCER } from '../config.js';
import { PAD } from '../layout.js';
import { createDrawing } from './drawing.js';
import { colorCss } from './shapes.js';

const COLORS = { red: 0xe5484d, blue: 0x3e8ef7 };
const SHADE = { red: 0x9e2a2f, blue: 0x1f5bb0 };

export function saucer(scope, store, side, parent = scope.root) {
  const view = scope.container(parent);
  const g = createDrawing(scope, store, `saucer-${side}`, view);
  const r = SAUCER.radius,
    h = SAUCER.halfHeight;
  const domeY = -h + 2,
    domeRy = SAUCER.top - h + 2;
  g.ellipse(0, 2, r + 12, h + 8, { fill: COLORS[side], alpha: 0.12 });
  g.ellipse(0, domeY, 15, domeRy, { fill: 0x0c1830, alpha: 0.85 });
  g.curve(
    [
      ['moveTo', -4, -22],
      ['lineTo', -7, -27],
    ],
    { stroke: COLORS[side], width: 2 },
  );
  g.curve(
    [
      ['moveTo', 4, -22],
      ['lineTo', 7, -27],
    ],
    { stroke: COLORS[side], width: 2 },
  );
  g.circle(-7, -27, 2, { fill: 0xfff3a0 });
  g.circle(7, -27, 2, { fill: 0xfff3a0 });
  g.ellipse(0, -4, 10, 6, { fill: SHADE[side] });
  g.ellipse(0, -15, 9, 8.5, { fill: COLORS[side] });
  const ex = (side === 'red' ? 1 : -1) * 1.5;
  g.ellipse(-4 + ex, -15, 3, 4, { fill: 0x111111 });
  g.ellipse(4 + ex, -15, 3, 4, { fill: 0x111111 });
  g.circle(-3 + ex, -17, 1, { fill: 0xffffff });
  g.circle(5 + ex, -17, 1, { fill: 0xffffff });
  g.ellipse(0, domeY, 15, domeRy, { fill: 0xbfe8ff, alpha: 0.18 });
  g.ellipse(0, domeY, 15, domeRy, { stroke: 0xdff4ff, width: 1.5, alpha: 0.6 });
  g.ellipse(-6, domeY - 9, 3, 6, { fill: 0xffffff, alpha: 0.45 });
  g.ellipse(0, 4, r * 0.62, h * 0.75, { fill: 0x4a5162 });
  g.ellipse(0, h - 3, 9, 4, { fill: COLORS[side] });
  g.ellipse(0, 1, r, h - 2, { fill: SHADE[side] });
  g.ellipse(0, 0, r, h - 4, { fill: COLORS[side] });
  g.ellipse(0, -3, r * 0.86, h * 0.55, { fill: 0xc9d2de });
  g.ellipse(0, -4, r * 0.8, h * 0.38, { fill: 0xe3e9f1 });
  g.ellipse(-8, -5, r * 0.35, 2, { fill: 0xffffff, alpha: 0.8 });
  for (let i = 0; i < 7; i++) {
    const u = i / 6;
    g.circle((u - 0.5) * r * 1.6, 3 + Math.sin(u * Math.PI) * 3, 2.2, { fill: (1 + i) % 3 === 0 ? 0xfff6b0 : 0x6b5a2a });
  }
  return view;
}

export function cowBody(g) {
  g.curve(
    [
      ['moveTo', -26, -30],
      ['quadraticCurveTo', -34, -22, -31, -13],
    ],
    { stroke: 0xe9e4d8, width: 2.5 },
  );
  g.circle(-31, -12, 3, { fill: 0x2b2320 });
  g.roundRect(-27, -37, 50, 25, 11, { fill: 0xf6f2e8 });
  for (const [x, y, rx, ry] of [
    [-12, -27, 9, 7],
    [6, -32, 6, 4],
    [14, -20, 5, 4],
  ])
    g.ellipse(x, y, rx, ry, { fill: 0x2b2320 });
  g.ellipse(-4, -12, 6, 3.5, { fill: 0xf2a7b5 });
  g.ellipse(24, -34, 9, 8, { fill: 0xf6f2e8 });
  g.ellipse(21, -35, 5, 4, { fill: 0x2b2320 });
  g.ellipse(31, -30, 6.5, 5, { fill: 0xf2a7b5 });
  g.circle(33, -30, 1, { fill: 0x7a3a45 });
  g.circle(29, -30, 1, { fill: 0x7a3a45 });
  g.circle(26, -37, 1.6, { fill: 0x111111 });
  g.curve(
    [
      ['moveTo', 20, -41],
      ['quadraticCurveTo', 19, -47, 23, -48],
    ],
    { stroke: 0xefe6c8, width: 2.5 },
  );
  g.curve(
    [
      ['moveTo', 27, -41],
      ['quadraticCurveTo', 28, -47, 31, -47],
    ],
    { stroke: 0xefe6c8, width: 2.5 },
  );
  g.ellipse(16, -39, 4, 2.2, { fill: 0x2b2320 });
}

export function lambBody(g) {
  const puffs = [
    [-13, -20, 7],
    [-6, -24, 8],
    [3, -24, 8],
    [11, -21, 7],
    [-9, -15, 6],
    [0, -15, 7],
    [9, -15, 6],
  ];
  for (const [x, y, r] of puffs) g.circle(x, y, r + 1, { fill: 0xd9d4c6 });
  for (const [x, y, r] of puffs) g.circle(x - 0.5, y - 0.5, r, { fill: 0xfdfbf4 });
  g.ellipse(19, -24, 6.5, 6, { fill: 0x2e2e33 });
  g.ellipse(14, -26, 4, 2, { fill: 0x2e2e33 });
  g.circle(12, -30, 3, { fill: 0xfdfbf4 });
  g.circle(21, -26, 1.4, { fill: 0xffffff });
}

export function animal(scope, store, kind, parent = scope.root) {
  const view = scope.container(parent);
  const body = scope.container(view);
  const leg =
    kind === 'cow'
      ? { w: 6, h: 13, xs: [-18, -11, 12, 19], color: 0xe9e4d8, far: 0xbdb6a8, hoof: 0x2b2320 }
      : { w: 4, h: 11, xs: [-11, -6, 8, 13], color: 0x2e2e33, far: 0x1c1c20, hoof: 0x121214 };
  const legs = leg.xs.map((x, i) => {
    const part = scope.container(view).setPosition(x, -leg.h);
    const g = createDrawing(scope, store, `${kind}-leg-${i % 2}`, part);
    g.rect(-leg.w / 2, 0, leg.w, leg.h, { fill: i % 2 ? leg.color : leg.far });
    g.rect(-leg.w / 2, leg.h - 3, leg.w, 3, { fill: leg.hoof });
    return part;
  });
  const g = createDrawing(scope, store, `${kind}-body`, body);
  if (kind === 'cow') cowBody(g);
  else lambBody(g);
  for (const child of [legs[0], legs[2], body, legs[1], legs[3]]) scope.attach(view, child);
  return view;
}

export function parachute(scope, store, parent = scope.root) {
  const view = scope.container(parent);
  const g = createDrawing(scope, store, 'parachute', view);
  g.curve(
    [
      ['moveTo', -26, -62],
      ['quadraticCurveTo', 0, -96, 26, -62],
      ['lineTo', -26, -62],
    ],
    { fill: 0xf2f2f2 },
  );
  for (const x of [-13, 13]) g.rect(x - 4, -80, 8, 18, { fill: 0xe5484d, alpha: 0.85 });
  for (const x of [-24, -8, 8, 24])
    g.curve(
      [
        ['moveTo', x, -62],
        ['lineTo', 0, -30],
      ],
      { stroke: 0xdddddd, width: 1 },
    );
  return view;
}

export function wolf(scope, store, parent = scope.root) {
  const view = scope.container(parent);
  const legs = [-17, -11, 11, 17].map((x, i) => {
    const leg = scope.container(view).setPosition(x, -13);
    const g = createDrawing(scope, store, `wolf-leg-${i % 2}`, leg);
    g.rect(-2.5, 0, 5, 13, { fill: i % 2 ? 0x8a9099 : 0x5f656e });
    g.rect(-2.5, 10, 5, 3, { fill: 0x3a3e45 });
    return leg;
  });
  const body = scope.container(view),
    head = scope.container(view).setPosition(18, -28);
  const g = createDrawing(scope, store, 'wolf-body', body);
  g.curve(
    [
      ['moveTo', -20, -26],
      ['quadraticCurveTo', -34, -30, -38, -16],
    ],
    { stroke: 0x5f656e, width: 9, cap: 'round' },
  );
  g.curve(
    [
      ['moveTo', -21, -26],
      ['quadraticCurveTo', -33, -29, -36, -18],
    ],
    { stroke: 0x8a9099, width: 6, cap: 'round' },
  );
  g.circle(-37, -15, 3.5, { fill: 0xc9ccd2 });
  g.roundRect(-24, -31, 44, 19, 9, { fill: 0x8a9099 });
  g.ellipse(-2, -14, 16, 4, { fill: 0xc9ccd2 });
  g.ellipse(-6, -28, 12, 3, { fill: 0x5f656e, alpha: 0.6 });
  const h = createDrawing(scope, store, 'wolf-head', head);
  h.ellipse(6, -3, 10, 9, { fill: 0x8a9099 });
  h.polygon([8, -7, 24, -2, 23, 3, 9, 5], { fill: 0xc9ccd2 });
  h.circle(23.5, -1.5, 2.3, { fill: 0x1c1c20 });
  h.polygon([0, -9, 2, -20, 7, -10], { fill: 0x5f656e });
  h.polygon([6, -10, 10, -19, 13, -9], { fill: 0x5f656e });
  h.polygon([2, -10, 3, -16, 5.5, -10], { fill: 0xd79aa3 });
  h.ellipse(10, -5, 2.4, 1.8, { fill: 0xffd24a });
  h.circle(10.6, -5, 1, { fill: 0x111111 });
  h.curve(
    [
      ['moveTo', 12, 3],
      ['lineTo', 21, 3],
    ],
    { stroke: 0x1c1c20, width: 1.2 },
  );
  for (const x of [14, 17, 20]) h.polygon([x - 1, 3, x, 5, x + 1, 3], { fill: 0xffffff });
  for (const child of [legs[0], legs[2], body, legs[1], legs[3], head]) scope.attach(view, child);
  return view;
}

export const SKY_STOPS = [
  [0, 0x050817],
  [0.55, 0x15204a],
  [1, 0x3b2f5e],
];
export function skyTexture(store) {
  const bounds = { x: 0, y: -PAD, width: 1280, height: 660 + PAD };
  return store.shared(
    'sky',
    bounds,
    (ctx) => {
      const gradient = ctx.createLinearGradient(0, -PAD, 0, 660);
      for (const [stop, color] of SKY_STOPS) gradient.addColorStop(stop, colorCss(color));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, -PAD, 1280, 660 + PAD);
    },
    1,
  );
}
