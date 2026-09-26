// Cows, lambs and the tractor beams.
// Each animal is a container drawn facing right with its feet at (0, 0);
// legs are separate so they can walk, and kick when lifted.

import { Container, Graphics } from 'pixi.js';
import { SAUCER, ANIMALS } from '../config.js';
import { SIDES } from '../logic/world.js';
import { COLORS } from './backdrop.js';
import { drawParachute } from './powerupView.js';

const GOLD = 0xffcf3a;

const LEG = {
  cow: { w: 6, h: 13, hipY: -13, xs: [-18, -11, 12, 19], color: 0xe9e4d8, far: 0xbdb6a8, hoof: 0x2b2320 },
  lamb: { w: 4, h: 11, hipY: -11, xs: [-11, -6, 8, 13], color: 0x2e2e33, far: 0x1c1c20, hoof: 0x121214 },
};

function makeLeg(kind, far) {
  const L = LEG[kind];
  const g = new Graphics();
  g.rect(-L.w / 2, 0, L.w, L.h).fill(far ? L.far : L.color);
  g.rect(-L.w / 2, L.h - 3, L.w, 3).fill(L.hoof);
  return g;
}

function drawCow(g) {
  // Tail.
  g.moveTo(-26, -30).quadraticCurveTo(-34, -22, -31, -13).stroke({ color: 0xe9e4d8, width: 2.5 });
  g.circle(-31, -12, 3).fill(0x2b2320);
  // Body with patches.
  g.roundRect(-27, -37, 50, 25, 11).fill(0xf6f2e8);
  g.ellipse(-12, -27, 9, 7).fill(0x2b2320);
  g.ellipse(6, -32, 6, 4).fill(0x2b2320);
  g.ellipse(14, -20, 5, 4).fill(0x2b2320);
  // Udder.
  g.ellipse(-4, -12, 6, 3.5).fill(0xf2a7b5);
  // Head.
  g.ellipse(24, -34, 9, 8).fill(0xf6f2e8);
  g.ellipse(21, -35, 5, 4).fill(0x2b2320);
  g.ellipse(31, -30, 6.5, 5).fill(0xf2a7b5);
  g.circle(33, -30, 1).fill(0x7a3a45);
  g.circle(29, -30, 1).fill(0x7a3a45);
  g.circle(26, -37, 1.6).fill(0x111111);
  // Horns and ear.
  g.moveTo(20, -41).quadraticCurveTo(19, -47, 23, -48).stroke({ color: 0xefe6c8, width: 2.5 });
  g.moveTo(27, -41).quadraticCurveTo(28, -47, 31, -47).stroke({ color: 0xefe6c8, width: 2.5 });
  g.ellipse(16, -39, 4, 2.2).fill(0x2b2320);
}

function drawLamb(g) {
  // Fleece: a cloud of puffs.
  const puffs = [
    [-13, -20, 7],
    [-6, -24, 8],
    [3, -24, 8],
    [11, -21, 7],
    [-9, -15, 6],
    [0, -15, 7],
    [9, -15, 6],
  ];
  for (const [x, y, r] of puffs) g.circle(x, y, r + 1).fill(0xd9d4c6);
  for (const [x, y, r] of puffs) g.circle(x - 0.5, y - 0.5, r).fill(0xfdfbf4);
  // Head.
  g.ellipse(19, -24, 6.5, 6).fill(0x2e2e33);
  g.ellipse(14, -26, 4, 2).fill(0x2e2e33);
  g.circle(12, -30, 3).fill(0xfdfbf4);
  g.circle(21, -26, 1.4).fill(0xffffff);
}

function createAnimalSprite(a) {
  const view = new Container();
  const L = LEG[a.kind];
  const legs = L.xs.map((x, i) => {
    const leg = makeLeg(a.kind, i % 2 === 0);
    leg.position.set(x, L.hipY);
    return leg;
  });
  const body = new Graphics();
  if (a.kind === 'cow') drawCow(body);
  else drawLamb(body);
  // Golden animals: gold tint, a glow, and a parachute on the way down.
  const glow = new Graphics().ellipse(0, -20, 40, 30).fill({ color: GOLD, alpha: 0.25 });
  glow.visible = false;
  const chute = new Graphics();
  drawParachute(chute);
  chute.y = a.kind === 'cow' ? -16 : -4;
  chute.visible = false;
  const collar = new Graphics();
  // Gold star: stolen during a steal power-up, worth double.
  const badge = new Graphics();
  const star = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3 : 7;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    star.push(Math.cos(ang) * r, Math.sin(ang) * r);
  }
  badge.poly(star).fill(0xffd76a).stroke({ color: 0x8a6a1a, width: 1 });
  badge.position.set(0, a.kind === 'cow' ? -46 : -38);
  badge.visible = false;
  // Far legs behind the body, near legs in front.
  view.addChild(glow, chute, legs[0], legs[2], body, legs[1], legs[3], collar, badge);

  let facing = a.x < 640 ? 1 : -1;
  let walk = Math.random() * 10;
  const wobble = Math.random() * 10; // phase, so dangling animals don't swing in step
  let owner;

  return {
    view,
    sync(a, t, dt) {
      if (a.vx !== 0) facing = Math.sign(a.vx);
      view.position.set(a.x, a.y);
      view.scale.x = facing;

      const golden = Boolean(a.golden);
      const tint = golden ? GOLD : 0xffffff;
      if (body.tint !== tint) {
        body.tint = tint;
        if (a.kind === 'cow') legs.forEach((leg) => (leg.tint = tint));
      }
      glow.visible = golden;
      glow.alpha = 0.6 + 0.4 * Math.sin(t * 5);
      chute.visible = a.state === 'descending';

      const aloft = a.state === 'lifting' || a.state === 'carried' || a.state === 'falling' || a.state === 'descending';
      if (aloft) {
        // Dangling and kicking.
        legs.forEach((leg, i) => (leg.rotation = Math.sin(t * 18 + i * 1.7) * 0.5));
        view.rotation = Math.sin(t * 5 + wobble) * 0.08;
      } else if (a.vx !== 0) {
        walk += dt * Math.abs(a.vx) * 0.25;
        legs.forEach((leg, i) => (leg.rotation = Math.sin(walk + (i % 2 ? Math.PI : 0)) * 0.45));
        view.rotation = 0;
      } else {
        legs.forEach((leg) => (leg.rotation *= 0.8));
        view.rotation = 0;
      }

      badge.visible = a.bonus && a.state === 'penned';
      badge.rotation = Math.sin(t * 3) * 0.3;

      if (a.owner !== owner) {
        owner = a.owner;
        collar.clear();
        if (owner) {
          const x = a.kind === 'cow' ? 17 : 13;
          const y = a.kind === 'cow' ? -34 : -25;
          collar.roundRect(x - 2, y - 6, 4, 12, 2).fill(COLORS[owner]);
          collar.circle(x + 1, y + 7, 2.2).fill(0xffd76a);
        }
      }
    },
  };
}

/** Beam from the saucer's emitter down to an animal. `strength` 0..1. */
function drawBeam(g, s, a, side, strength, t) {
  const x0 = s.x;
  const y0 = s.y + SAUCER.halfHeight - 2;
  const reach = Math.min(1, strength / 0.12); // the beam shoots down first
  const y1 = y0 + (a.y + 4 - y0) * reach;
  const top = 10;
  const bottom = ANIMALS.size[a.kind].w / 2 + 12;
  const x1 = x0 + (a.x - x0) * reach;
  const color = COLORS[side];
  const alpha = 0.18 + 0.22 * strength;

  g.poly([x0 - top, y0, x0 + top, y0, x1 + bottom, y1, x1 - bottom, y1]).fill({ color, alpha });
  g.poly([x0 - top * 0.4, y0, x0 + top * 0.4, y0, x1 + bottom * 0.45, y1, x1 - bottom * 0.45, y1]).fill({
    color: 0xffffff,
    alpha: alpha * 0.5,
  });
  // Rings rising up the beam.
  for (let i = 0; i < 4; i++) {
    const u = 1 - ((t * 1.6 + i / 4) % 1);
    const y = y0 + (y1 - y0) * u;
    const w = top + (bottom - top) * u;
    const x = x0 + (x1 - x0) * u;
    g.ellipse(x, y, w, 3).stroke({ color: 0xffffff, width: 1.5, alpha: 0.5 * (1 - Math.abs(u - 0.5)) * reach });
  }
}

export function createBeamView() {
  const g = new Graphics();
  return {
    view: g,
    sync(world, t) {
      g.clear();
      for (const side of SIDES) {
        const h = world.hooks[side];
        const s = world.saucers[side];
        if (h.target) drawBeam(g, s, h.target, side, h.progress, t);
        else if (h.carrying) drawBeam(g, s, h.second ?? h.carrying, side, 1, t);
      }
    },
  };
}

/** Draws every animal in `animals`, including ones added later (golden drops). */
export function createAnimalView(animals) {
  const view = new Container();
  const sprites = new Map();
  function add(a) {
    const sprite = createAnimalSprite(a);
    sprites.set(a, sprite);
    // Cows behind lambs, so a lamb in a crowded pen stays visible.
    if (a.kind === 'cow') view.addChildAt(sprite.view, 0);
    else view.addChild(sprite.view);
  }
  let last = null;
  return {
    view,
    sync(t) {
      const dt = last === null ? 0 : Math.min(0.1, t - last);
      last = t;
      for (const a of animals) {
        if (!sprites.has(a)) add(a);
        sprites.get(a).sync(a, t, dt);
      }
    },
  };
}
