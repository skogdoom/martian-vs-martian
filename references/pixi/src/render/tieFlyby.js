// 4 May on the title screen: now and then three small fighters sweep across
// the sky in a V, behind the menu text. Cosmetic only, so it uses Math.random.

import { Container, Graphics } from 'pixi.js';
import { WIDTH } from '../config.js';
import { layout } from '../layout.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const FIRST = [2, 4]; // seconds before the first pass
const GAP = [15, 25]; // seconds between passes
// Where each one flies in the V, relative to the leader.
const FORMATION = [
  [0, 0],
  [-46, -20],
  [-46, 22],
];

/** One fighter, seen head on: a ball cockpit between two six-sided wings. */
function fighter() {
  const g = new Graphics();
  const wing = (x) =>
    g
      .poly([x, -15, x + 4, -8, x + 4, 8, x, 15, x - 4, 8, x - 4, -8])
      .fill(0x5d636d)
      .stroke({ color: 0x2d3038, width: 1.2 });
  wing(-13);
  wing(13);
  g.rect(-11, -1.5, 22, 3).fill(0x7a808a); // the struts
  g.circle(0, 0, 5.5).fill(0x8a909a).stroke({ color: 0x2d3038, width: 1 });
  g.circle(0, 0, 2.6).fill(0x1d2028); // the window
  return g;
}

export function createTieFlyby() {
  const view = new Container();
  const ships = FORMATION.map(() => fighter());
  view.addChild(...ships);
  view.visible = false;
  let wait = rand(...FIRST);
  let pass = null;

  return {
    view,
    update(dt) {
      if (!pass) {
        wait -= dt;
        if (wait > 0) return;
        wait = rand(...GAP);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const speed = rand(260, 340);
        const y = rand(-layout.extra * 0.6 + 60, 270);
        pass = { dir, x: dir > 0 ? -80 : WIDTH + 80, y, vy: rand(-25, 25), speed, t: 0 };
      }
      pass.t += dt;
      pass.x += pass.dir * pass.speed * dt;
      pass.y += pass.vy * dt;
      if (pass.x < -140 || pass.x > WIDTH + 140) pass = null;
    },
    render() {
      view.visible = pass !== null;
      if (!pass) return;
      ships.forEach((s, i) => {
        const [dx, dy] = FORMATION[i];
        // The wingmen trail behind the leader and weave a little.
        s.position.set(pass.x + dx * pass.dir, pass.y + dy + Math.sin(pass.t * 3 + i * 2) * 3);
        s.rotation = Math.sin(pass.t * 2 + i) * 0.08;
      });
    },
  };
}
