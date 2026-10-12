// The wolf: grey, bushy-tailed, facing right with its feet at (0, 0).
// Its head dips while it eats and tips back to howl when it is getting bored.

import { Container, Graphics } from 'pixi.js';
import { WOLF } from '../config.js';
import { drawParachute } from './powerupView.js';
import { createListView } from './listView.js';

const FUR = 0x8a9099;
const DARK = 0x5f656e;
const PALE = 0xc9ccd2;

function drawBody(g) {
  // Bushy tail, then the body with a pale belly.
  g.moveTo(-20, -26).quadraticCurveTo(-34, -30, -38, -16).stroke({ color: DARK, width: 9, cap: 'round' });
  g.moveTo(-21, -26).quadraticCurveTo(-33, -29, -36, -18).stroke({ color: FUR, width: 6, cap: 'round' });
  g.circle(-37, -15, 3.5).fill(PALE);
  g.roundRect(-24, -31, 44, 19, 9).fill(FUR);
  g.ellipse(-2, -14, 16, 4).fill(PALE);
  g.ellipse(-6, -28, 12, 3).fill({ color: DARK, alpha: 0.6 }); // darker back
}

/** Head, drawn around the neck at (0, 0) so it can nod. */
function drawHead(g) {
  g.ellipse(6, -3, 10, 9).fill(FUR);
  g.poly([8, -7, 24, -2, 23, 3, 9, 5]).fill(PALE); // snout
  g.circle(23.5, -1.5, 2.3).fill(0x1c1c20); // nose
  g.poly([0, -9, 2, -20, 7, -10]).fill(DARK); // ears
  g.poly([6, -10, 10, -19, 13, -9]).fill(DARK);
  g.poly([2, -10, 3, -16, 5.5, -10]).fill(0xd79aa3);
  g.ellipse(10, -5, 2.4, 1.8).fill(0xffd24a); // eye
  g.circle(10.6, -5, 1).fill(0x111111);
  g.moveTo(12, 3).lineTo(21, 3).stroke({ color: 0x1c1c20, width: 1.2 }); // mouth
  for (const x of [14, 17, 20]) g.poly([x - 1, 3, x, 5, x + 1, 3]).fill(0xffffff); // teeth
}

export function createWolfSprite() {
  const view = new Container();
  const legs = [-17, -11, 11, 17].map((x, i) => {
    const leg = new Graphics();
    leg.rect(-2.5, 0, 5, 13).fill(i % 2 === 0 ? DARK : FUR);
    leg.rect(-2.5, 10, 5, 3).fill(0x3a3e45);
    leg.position.set(x, -13);
    return leg;
  });
  const body = new Graphics();
  drawBody(body);
  const head = new Graphics();
  drawHead(head);
  head.position.set(18, -28);
  const blood = new Graphics();
  blood.circle(20, 5, 3).fill(0xb5171f);
  blood.circle(15, 6, 2).fill(0xd21f2a);
  blood.visible = false;
  head.addChild(blood);
  const chute = new Graphics();
  drawParachute(chute);
  chute.y = -8;
  view.addChild(chute, legs[0], legs[2], body, legs[1], legs[3], head);
  view.visible = false;

  let facing = 1;
  let walk = 0;
  let last = null;
  const wobble = Math.random() * 10;

  return {
    view,
    sync(w, t) {
      const dt = last === null ? 0 : Math.min(0.1, t - last);
      last = t;
      view.visible = w.state !== 'gone';
      if (!view.visible) return;
      if (w.vx !== 0) facing = Math.sign(w.vx);
      view.position.set(w.x, w.y);
      view.scale.x = facing;
      chute.visible = w.state === 'descending' || (w.state === 'falling' && w.chute);

      const aloft = ['lifting', 'carried', 'falling', 'descending'].includes(w.state);
      if (aloft) {
        legs.forEach((leg, i) => (leg.rotation = Math.sin(t * 18 + i * 1.7) * 0.5));
        view.rotation = Math.sin(t * 5 + wobble) * 0.1;
      } else if (w.vx !== 0) {
        walk += dt * Math.abs(w.vx) * 0.22;
        legs.forEach((leg, i) => (leg.rotation = Math.sin(walk + (i < 2 ? 0 : Math.PI) + (i % 2) * 0.6) * 0.6));
        view.rotation = 0;
      } else {
        legs.forEach((leg) => (leg.rotation *= 0.8));
        view.rotation = 0;
      }

      // Eating: the head dips and tears. Bored: it tips back to howl.
      const eating = w.eating > 0;
      const howling = !aloft && !eating && w.bored > WOLF.boredAfter - 1.8;
      if (eating) head.rotation = 0.55 + 0.18 * Math.sin(t * 22);
      else if (howling) head.rotation = -0.9;
      else if (aloft)
        head.rotation = Math.sin(t * 9) * 0.25; // snapping
      else head.rotation = 0;
      blood.visible = eating;
    },
  };
}

/** Draws every wolf in the world, making views for new ones as they arrive. */
export function createWolvesView() {
  return createListView(createWolfSprite);
}
