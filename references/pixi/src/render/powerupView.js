// Drops (the little green man, ammo crates), power-up icons and names.

import { Container, Graphics } from 'pixi.js';
import { label } from './text.js';
import { createListView } from './listView.js';

export const POWER_NAMES = {
  speed: 'SPEED BOOST',
  laser: 'LASER CANNON',
  triple: 'TRIPLE SHOT',
  steal: 'DOUBLE STEAL',
  rocket: 'HOMING ROCKET',
  twin: 'TWIN BEAM',
  bomb: 'PEN BOMB',
  unlimited: 'INFINITE AMMO',
  shield: 'SHIELD',
  cowRain: 'LAMBS → COWS',
  lambRain: 'COWS → LAMBS',
  timeBomb: 'TIME BOMB',
  parachute: 'PARACHUTES',
};

export const SHIELD_COLOR = 0x7fe8ff;

/** Small rocket pointing along +x, nose at (len/2, 0). */
export function drawRocket(g, len, flame = 0) {
  const h = len * 0.22;
  if (flame > 0) g.poly([-len / 2, -h * 0.6, -len / 2 - len * 0.5 * flame, 0, -len / 2, h * 0.6]).fill(0xffa53a);
  g.poly([-len / 2, -h * 1.6, -len / 2 + len * 0.25, -h, -len / 2 + len * 0.25, h, -len / 2, h * 1.6]).fill(0xc9303a);
  g.roundRect(-len / 2, -h, len * 0.8, h * 2, h).fill(0xe8ecf2);
  g.poly([len * 0.3, -h, len / 2, 0, len * 0.3, h]).fill(0xc9303a);
}

/** Round black bomb with a lit fuse, centred on (0, 0). */
export function drawBomb(g, r, spark = true) {
  g.circle(0, 0, r).fill(0x22252b);
  g.circle(-r * 0.35, -r * 0.35, r * 0.28).fill({ color: 0xffffff, alpha: 0.35 });
  g.rect(-r * 0.25, -r * 1.25, r * 0.5, r * 0.4).fill(0x6b6f78);
  g.moveTo(0, -r * 1.25)
    .quadraticCurveTo(r * 0.4, -r * 1.7, r * 0.7, -r * 1.55)
    .stroke({ color: 0xc9a46a, width: Math.max(1, r * 0.15) });
  if (spark) g.circle(r * 0.72, -r * 1.58, r * 0.28).fill(0xffd24a);
}

export const POWER_COLOR = 0x6cff6c;

/** A round badge with the power-up's symbol, centred on (0, 0). */
export function createPowerIcon(type, r = 14) {
  const view = new Container();
  const g = new Graphics();
  g.circle(0, 0, r).fill(0x10301a);
  g.circle(0, 0, r).stroke({ color: POWER_COLOR, width: 2 });
  const s = r / 14;
  if (type === 'speed') {
    // Lightning bolt.
    g.poly([2 * s, -10 * s, -6 * s, 2 * s, -1 * s, 2 * s, -3 * s, 10 * s, 6 * s, -3 * s, 1 * s, -3 * s]).fill(0xffe45c);
  } else if (type === 'laser') {
    g.rect(-9 * s, -2 * s, 18 * s, 4 * s).fill({ color: 0xff5ce1, alpha: 0.5 });
    g.rect(-9 * s, -1 * s, 18 * s, 2 * s).fill(0xffffff);
    g.circle(-8 * s, 0, 3.5 * s).fill(0xff5ce1);
  } else if (type === 'rocket') {
    const rocket = new Graphics();
    drawRocket(rocket, 20 * s, 0.6);
    rocket.rotation = -0.5;
    view.addChild(g, rocket);
    return view;
  } else if (type === 'bomb' || type === 'timeBomb') {
    drawBomb(g, 6.5 * s);
    if (type === 'timeBomb') {
      // A clock face on the bomb.
      g.circle(0, 0, 4.2 * s).fill(0xffffff);
      g.moveTo(0, 0)
        .lineTo(0, -3.2 * s)
        .stroke({ color: 0xd0202a, width: 1.2 * s });
      g.moveTo(0, 0)
        .lineTo(2.4 * s, 0.8 * s)
        .stroke({ color: 0x111111, width: 1.2 * s });
    }
  } else if (type === 'twin') {
    // Two animals rising in two beams.
    for (const dx of [-4.5, 4.5]) {
      g.poly([dx * s - 2 * s, -9 * s, dx * s + 2 * s, -9 * s, dx * s + 4 * s, 8 * s, dx * s - 4 * s, 8 * s]).fill({
        color: POWER_COLOR,
        alpha: 0.35,
      });
      g.roundRect(dx * s - 3.5 * s, 0, 7 * s, 5 * s, 2 * s).fill(0xffffff);
    }
  } else if (type === 'shield') {
    // A bubble with a little shield in it.
    g.circle(0, 0, 9.5 * s).fill({ color: SHIELD_COLOR, alpha: 0.25 });
    g.circle(0, 0, 9.5 * s).stroke({ color: SHIELD_COLOR, width: 1.5 * s });
    g.poly([-5 * s, -5 * s, 5 * s, -5 * s, 5 * s, 0, 0, 6 * s, -5 * s, 0]).fill(0xffffff);
    g.circle(-4 * s, -5.5 * s, 1.6 * s).fill({ color: 0xffffff, alpha: 0.7 });
  } else if (type === 'cowRain') {
    // A cow's face: horns, a black patch and a pink muzzle.
    g.moveTo(-5 * s, -6 * s)
      .lineTo(-9 * s, -10 * s)
      .stroke({ color: 0xf2e6c8, width: 2 * s });
    g.moveTo(5 * s, -6 * s)
      .lineTo(9 * s, -10 * s)
      .stroke({ color: 0xf2e6c8, width: 2 * s });
    g.ellipse(-9 * s, -3 * s, 3 * s, 1.8 * s).fill(0xffffff);
    g.ellipse(9 * s, -3 * s, 3 * s, 1.8 * s).fill(0xffffff);
    g.roundRect(-6.5 * s, -8 * s, 13 * s, 15 * s, 5 * s).fill(0xffffff);
    g.ellipse(-3 * s, -4.5 * s, 3.2 * s, 3.4 * s).fill(0x222222);
    g.circle(3 * s, -3 * s, 1.2 * s).fill(0x111111);
    g.circle(-3 * s, -3 * s, 1.2 * s).fill(0xffffff);
    g.ellipse(0, 4 * s, 6 * s, 3.8 * s).fill(0xf2a0b0);
    g.circle(-2 * s, 4 * s, 0.9 * s).fill(0x8a4a5a);
    g.circle(2 * s, 4 * s, 0.9 * s).fill(0x8a4a5a);
  } else if (type === 'lambRain') {
    // A lamb's face: dark, in a ring of wool.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.circle(Math.cos(a) * 6.5 * s, Math.sin(a) * 6 * s - 1 * s, 3.4 * s).fill(0xf3eee2);
    }
    g.ellipse(-7 * s, 0, 3 * s, 1.6 * s).fill(0x3a3a3a);
    g.ellipse(7 * s, 0, 3 * s, 1.6 * s).fill(0x3a3a3a);
    g.ellipse(0, 1 * s, 4.5 * s, 6 * s).fill(0x3a3a3a);
    g.circle(-2 * s, -0.5 * s, 1.1 * s).fill(0xffffff);
    g.circle(2 * s, -0.5 * s, 1.1 * s).fill(0xffffff);
    g.circle(0, -6 * s, 3 * s).fill(0xf3eee2);
  } else if (type === 'parachute') {
    // A canopy with a lamb hanging under it.
    g.moveTo(-10 * s, -2 * s)
      .quadraticCurveTo(0, -16 * s, 10 * s, -2 * s)
      .lineTo(-10 * s, -2 * s)
      .fill(0xf2f2f2);
    g.rect(-5.5 * s, -9.5 * s, 3 * s, 7 * s).fill(0xe5484d);
    g.rect(2.5 * s, -9.5 * s, 3 * s, 7 * s).fill(0xe5484d);
    for (const x of [-9, 9])
      g.moveTo(x * s, -2 * s)
        .lineTo(0, 4 * s)
        .stroke({ color: 0xdddddd, width: 1 * s });
    g.roundRect(-4.5 * s, 3.5 * s, 9 * s, 6 * s, 3 * s).fill(0xf3eee2);
    g.circle(-4 * s, 5.5 * s, 2 * s).fill(0x3a3a3a);
  } else if (type === 'triple') {
    for (const dy of [-6, 0, 6]) {
      g.rect(-8 * s, (dy - 1) * s, 9 * s, 2 * s).fill({ color: 0xffffff, alpha: 0.5 });
      g.circle(3 * s, dy * s, 2.6 * s).fill(0xffffff);
    }
  }
  view.addChild(g);
  if (type === 'steal') {
    const t = label('2×', { size: Math.round(13 * s), color: 0xffd76a, bold: true, anchorX: 0.5, anchorY: 0.5 });
    t.y = 0.5 * s;
    view.addChild(t);
  } else if (type === 'unlimited') {
    const t = label('∞', { size: Math.round(20 * s), color: 0xffd76a, bold: true, anchorX: 0.5, anchorY: 0.5 });
    t.y = -0.5 * s;
    view.addChild(t);
  }
  return view;
}

/** `panic`: both hands on his head and his mouth open ("Oh, no!"). */
function drawGreenMan(body, panic = false) {
  const green = 0x5fd35f;
  const dark = 0x2f8a3a;
  // Body, arms and head (feet at y = 0 are the separate legs).
  body.roundRect(-6, -17, 12, 10, 4).fill(green);
  if (panic) {
    body.moveTo(-6, -15).lineTo(-12, -20).lineTo(-8, -27).stroke({ color: green, width: 3 });
    body.moveTo(6, -15).lineTo(12, -20).lineTo(8, -27).stroke({ color: green, width: 3 });
  } else {
    body.moveTo(-6, -15).lineTo(-10, -9).stroke({ color: green, width: 3 });
    body.moveTo(6, -15).lineTo(10, -22).stroke({ color: green, width: 3 }); // waving
  }
  body.ellipse(0, -24, 9, 7.5).fill(green);
  if (panic) body.ellipse(0, -19.5, 2, 2.4).fill(0x111111);
  body.moveTo(-4, -30).lineTo(-6, -35).stroke({ color: dark, width: 1.5 });
  body.moveTo(4, -30).lineTo(6, -35).stroke({ color: dark, width: 1.5 });
  body.circle(-6, -35, 1.8).fill(0xfff3a0);
  body.circle(6, -35, 1.8).fill(0xfff3a0);
  body.ellipse(-3.5, -24, 2.6, 3.4).fill(0x111111);
  body.ellipse(3.5, -24, 2.6, 3.4).fill(0x111111);
  body.circle(-3, -25, 0.8).fill(0xffffff);
  body.circle(4, -25, 0.8).fill(0xffffff);
}

export function drawParachute(g) {
  const top = -78;
  g.moveTo(-26, top + 16)
    .quadraticCurveTo(0, top - 18, 26, top + 16)
    .lineTo(-26, top + 16)
    .fill(0xf2f2f2);
  for (const x of [-13, 13]) g.rect(x - 4, top - 2, 8, 18).fill({ color: 0xe5484d, alpha: 0.85 });
  for (const x of [-24, -8, 8, 24])
    g.moveTo(x, top + 16)
      .lineTo(0, -30)
      .stroke({ color: 0xdddddd, width: 1 });
}

/** Green man: parachute on the way down, a power-up sign over his head. */
export function createGreenManView() {
  const view = new Container();
  const chute = new Graphics();
  drawParachute(chute);
  const legs = [new Graphics(), new Graphics()];
  legs.forEach((leg, i) => {
    leg.rect(-1.5, 0, 3, 8).fill(0x2f8a3a);
    leg.position.set(i ? 3 : -3, -8);
  });
  const body = new Graphics();
  drawGreenMan(body);
  const panicBody = new Graphics();
  drawGreenMan(panicBody, true);
  panicBody.visible = false;
  const sign = new Container();
  const glow = new Graphics().circle(0, 0, 22).fill({ color: POWER_COLOR, alpha: 0.18 });
  sign.addChild(glow);
  // Speech bubble while he panics.
  const bubble = new Container();
  const words = label('Oh, no!', { size: 15, color: 0x111111, bold: true, anchorX: 0.5, anchorY: 0.5 });
  const pad = 7;
  const bubbleBg = new Graphics()
    .roundRect(-words.width / 2 - pad, -words.height / 2 - pad + 1, words.width + 2 * pad, words.height + 2 * pad - 2, 8)
    .fill(0xffffff)
    .poly([-14, words.height / 2 + pad - 2, -4, words.height / 2 + pad - 2, -18, words.height / 2 + pad + 8])
    .fill(0xffffff);
  bubble.addChild(bubbleBg, words);
  bubble.position.set(34, -52);
  bubble.visible = false;
  view.addChild(chute, ...legs, body, panicBody, sign, bubble);
  view.visible = false;

  let icon = null;
  let facing = 1;

  return {
    view,
    sync(d, t) {
      view.visible = d.state !== 'gone';
      if (!view.visible) return;
      if (!icon) {
        icon = createPowerIcon(d.power, 13);
        sign.addChild(icon);
      }
      if (d.vx !== 0) facing = Math.sign(d.vx);
      const panic = d.panic != null;
      view.position.set(d.x + (panic ? Math.sin(t * 70) * 1.2 : 0), d.y);
      body.scale.x = facing;
      body.visible = !panic;
      panicBody.visible = bubble.visible = panic;
      chute.visible = d.state === 'descending' || (d.state === 'falling' && d.chute);
      view.rotation = chute.visible ? Math.sin(t * 2.2) * 0.12 : 0;

      const aloft = d.state === 'lifting' || d.state === 'falling';
      legs.forEach((leg, i) => {
        if (aloft) leg.rotation = Math.sin(t * 20 + i * 2) * 0.6;
        else if (d.vx !== 0) leg.rotation = Math.sin(t * 14 + i * Math.PI) * 0.5;
        else leg.rotation = 0;
      });

      // The sign rides on the canopy on the way down, then bobs above his head.
      if (chute.visible) sign.position.set(0, -72);
      else sign.position.set(0, -58 + Math.sin(t * 4) * 3);
      glow.scale.set(1 + 0.15 * Math.sin(t * 6));
    },
  };
}

/** Mystery package: a wrapped box with a question mark. */
export function createPackageView() {
  const view = new Container();
  const chute = new Graphics();
  drawParachute(chute);
  chute.y = 10;
  const glow = new Graphics().ellipse(0, -14, 32, 26).fill({ color: 0xc86cff, alpha: 0.2 });
  const box = new Graphics();
  box.roundRect(-15, -28, 30, 28, 3).fill(0x8a3fd1);
  box.rect(-3, -28, 6, 28).fill(0xffd24a); // ribbon
  box.rect(-15, -17, 30, 6).fill(0xffd24a);
  box.ellipse(-6, -32, 6, 4).fill(0xffd24a); // bow
  box.ellipse(6, -32, 6, 4).fill(0xffd24a);
  box.roundRect(-15, -28, 30, 28, 3).stroke({ color: 0x5a2690, width: 2 });
  const mark = label('?', { size: 22, color: 0xffffff, bold: true, anchorX: 0.5, anchorY: 0.5 });
  mark.position.set(0, -52);
  view.addChild(glow, chute, box, mark);
  view.visible = false;
  const phase = Math.random() * 10;

  return {
    view,
    sync(p, t) {
      view.visible = p.state !== 'gone';
      if (!view.visible) return;
      view.position.set(p.x, p.y);
      chute.visible = p.state === 'descending';
      mark.visible = p.state !== 'descending';
      mark.y = -52 + Math.sin(t * 4 + phase) * 3;
      const swinging = p.state === 'descending' || p.state === 'lifting' || p.state === 'falling';
      view.rotation = swinging ? Math.sin(t * 2.4 + phase) * 0.12 : 0;
      glow.alpha = 0.6 + 0.4 * Math.sin(t * 5);
    },
  };
}

/** Wooden ammo crate with brass rounds on the front. */
export function createCrateView() {
  const view = new Container();
  const chute = new Graphics();
  drawParachute(chute);
  chute.y = 12;
  const glow = new Graphics().ellipse(0, -13, 30, 24).fill({ color: 0xffd76a, alpha: 0.18 });
  const box = new Graphics();
  box.rect(-15, -26, 30, 26).fill(0x9c6b3a);
  for (const y of [-18, -9]) box.rect(-15, y, 30, 1.5).fill(0x6e4a26);
  box.rect(-15, -26, 30, 26).stroke({ color: 0x5a3b1c, width: 2 });
  for (const [x, y] of [
    [-15, -26],
    [15, -26],
    [-15, 0],
    [15, 0],
  ])
    box.rect(x - 3, y - 3, 6, 6).fill(0x8a8f99);
  for (const x of [-7, 0, 7]) {
    box.rect(x - 2.2, -19, 4.4, 9).fill(0xd9a93a);
    box.circle(x, -19, 2.2).fill(0xe8c15a);
  }
  view.addChild(glow, chute, box);
  view.visible = false;
  const phase = Math.random() * 10;

  return {
    view,
    sync(c, t) {
      view.visible = c.state !== 'gone';
      if (!view.visible) return;
      view.position.set(c.x, c.y);
      chute.visible = c.state === 'descending';
      const swinging = c.state === 'descending' || c.state === 'lifting' || c.state === 'falling';
      view.rotation = swinging ? Math.sin(t * 2.4 + phase) * 0.12 : 0;
      glow.alpha = 0.6 + 0.4 * Math.sin(t * 4);
    },
  };
}

/** Draws every drop in the world, making views for new ones as they arrive. */
export function createDropsView() {
  return createListView((d) => ({ crate: createCrateView, package: createPackageView })[d.kind]?.() ?? createGreenManView());
}
