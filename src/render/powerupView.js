// The little green man, power-up icons and names.

import { Container, Graphics } from 'pixi.js';
import { label } from './text.js';

export const POWER_NAMES = {
  speed: 'SPEED BOOST',
  laser: 'LASER CANNON',
  triple: 'TRIPLE SHOT',
  steal: 'DOUBLE STEAL',
};

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
  }
  return view;
}

function drawGreenMan(body) {
  const green = 0x5fd35f;
  const dark = 0x2f8a3a;
  // Body, arms and head (feet at y = 0 are the separate legs).
  body.roundRect(-6, -17, 12, 10, 4).fill(green);
  body.moveTo(-6, -15).lineTo(-10, -9).stroke({ color: green, width: 3 });
  body.moveTo(6, -15).lineTo(10, -22).stroke({ color: green, width: 3 }); // waving
  body.ellipse(0, -24, 9, 7.5).fill(green);
  body.moveTo(-4, -30).lineTo(-6, -35).stroke({ color: dark, width: 1.5 });
  body.moveTo(4, -30).lineTo(6, -35).stroke({ color: dark, width: 1.5 });
  body.circle(-6, -35, 1.8).fill(0xfff3a0);
  body.circle(6, -35, 1.8).fill(0xfff3a0);
  body.ellipse(-3.5, -24, 2.6, 3.4).fill(0x111111);
  body.ellipse(3.5, -24, 2.6, 3.4).fill(0x111111);
  body.circle(-3, -25, 0.8).fill(0xffffff);
  body.circle(4, -25, 0.8).fill(0xffffff);
}

function drawParachute(g) {
  const top = -78;
  g.moveTo(-26, top + 16).quadraticCurveTo(0, top - 18, 26, top + 16).lineTo(-26, top + 16).fill(0xf2f2f2);
  for (const x of [-13, 13]) g.rect(x - 4, top - 2, 8, 18).fill({ color: 0xe5484d, alpha: 0.85 });
  for (const x of [-24, -8, 8, 24]) g.moveTo(x, top + 16).lineTo(0, -30).stroke({ color: 0xdddddd, width: 1 });
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
  const sign = new Container();
  const glow = new Graphics().circle(0, 0, 22).fill({ color: POWER_COLOR, alpha: 0.18 });
  sign.addChild(glow);
  view.addChild(chute, ...legs, body, sign);
  view.visible = false;

  let icon = null;
  let facing = 1;

  return {
    view,
    sync(d, t) {
      view.visible = d !== null && d.state !== 'gone';
      if (!view.visible) return;
      if (!icon) {
        icon = createPowerIcon(d.power, 13);
        sign.addChild(icon);
      }
      if (d.vx !== 0) facing = Math.sign(d.vx);
      view.position.set(d.x, d.y);
      body.scale.x = facing;
      chute.visible = d.state === 'descending';
      view.rotation = d.state === 'descending' ? Math.sin(t * 2.2) * 0.12 : 0;

      const aloft = d.state === 'lifting' || d.state === 'falling';
      legs.forEach((leg, i) => {
        if (aloft) leg.rotation = Math.sin(t * 20 + i * 2) * 0.6;
        else if (d.vx !== 0) leg.rotation = Math.sin(t * 14 + i * Math.PI) * 0.5;
        else leg.rotation = 0;
      });

      // The sign rides on the canopy on the way down, then bobs above his head.
      if (d.state === 'descending') sign.position.set(0, -72);
      else sign.position.set(0, -58 + Math.sin(t * 4) * 3);
      glow.scale.set(1 + 0.15 * Math.sin(t * 6));
    },
  };
}
