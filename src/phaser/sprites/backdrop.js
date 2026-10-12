import { WIDTH, HEIGHT, ARENA } from '../../config.js';
import { PAD, menuLift, layout } from '../../layout.js';
import { createRng } from '../../logic/rng.js';
import { occasion } from '../../occasion.js';
import { createSnow, createFireworks } from '../render/festive.js';

const GROUND = ARENA.groundY;

export function cartoonBackdrop(art, phase) {
  const { sprite } = art.sprites;
  const view = art.container();
  const rng = createRng(42);
  const sky = art.scope.bitmap(
    { x: 0, y: -PAD, width: WIDTH, height: GROUND + PAD },
    (ctx) => {
      const gradient = ctx.createLinearGradient(0, -PAD, 0, GROUND);
      gradient.addColorStop(0, '#030d26');
      gradient.addColorStop(0.65, '#0b1c51');
      gradient.addColorStop(1, '#283482');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, -PAD, WIDTH, GROUND + PAD);
    },
    { resolution: 1, cacheKey: 'cartoon-sky' },
  );
  const starGroups = [art.container(), art.container(), art.container()];
  const count = Math.round(150 * (1 + PAD / GROUND));
  for (let i = 0; i < count; i++) {
    const x = rng() * WIDTH;
    const y = -PAD + rng() * (rng() < 0.5 ? 1 : rng()) * (GROUND - 120 + PAD);
    const size = rng() < 0.12 ? 6 : 2 + rng() * 2;
    art.add(starGroups[i % 3], sprite('fx-spark', size, size, x, y).setAlpha(0.5 + rng() * 0.5));
  }
  const full = occasion === 'christmas' || occasion === 'halloween';
  const moon = sprite(occasion === 'mayTheFourth' ? 'battle-station' : `moon-${full ? 'full' : phase}`, 66, 66);
  if (occasion === 'halloween') art.tint(moon, 0xffb15c);
  const hat = occasion === 'christmas' ? sprite('santa-hat', 72, 48, 0, -42) : null;
  const land = art.container();
  const hills = sprite('hills', WIDTH, 170, 0, 620, 0, 1);
  const meadow = sprite('meadow', WIDTH, 115, 0, GROUND + 4, 0, 1);
  const soil = art.graphics((draw) => draw.rect(0, GROUND, WIDTH, HEIGHT - GROUND + PAD, { fill: 0x164a25 }));
  const flags = [];
  const lanterns = [];
  art.add(land, hills);
  for (const [x, w, h] of [
    [90, 90, 120],
    [240, 45, 60],
    [880, 60, 80],
    [1180, 95, 125],
  ])
    art.add(land, sprite('trees', w, h, x, 586, 0.5, 1).setAlpha(0.7));
  art.add(land, meadow, soil);
  for (let x = 12; x < WIDTH; x += 26) art.add(land, sprite('grass', 20, 12 + rng() * 8, x, GROUND + 2, 0.5, 1));
  for (let i = 0; i < 25; i++) art.add(land, sprite('grass', 24, 14, rng() * WIDTH, GROUND + 22 + rng() * 35));
  for (const side of ['red', 'blue']) {
    const { left, right } = ARENA.pens[side];
    const center = (left + right) / 2;
    const barn = sprite('barn', 128, 98, center, GROUND - 22, 0.5, 1).setAlpha(0.9);
    art.add(land, barn, sprite('hay', 45, 34, side === 'red' ? right - 20 : left + 20, GROUND - 2, 0.5, 1));
    const poleX = side === 'red' ? left + (occasion === 'midsummer' ? 46 : 26) : right - (occasion === 'midsummer' ? 46 : 26);
    const pole = art.container();
    pole.name = `flagpole-${side}`;
    pole.setPosition(poleX, GROUND).setScale(side === 'red' ? 1 : -1, 1);
    art.add(land, pole);
    if (occasion === 'midsummer') {
      const maypole = sprite('maypole', 78, 214, 0, 0, 0.5, 1);
      const ribbon = sprite(`ribbon-${side}`, 60, 20, 0, -208, 0, 0.3);
      art.add(pole, maypole, ribbon);
      flags.push(ribbon);
    } else {
      const stem = art.graphics((draw) => draw.rect(-2, -210, 4, 210, { fill: 0xb8bcc8 }).circle(0, -212, 4, { fill: 0xe8e8f0 }));
      const flag = sprite(`flag-${side}-cloth`, 60, 34, 2, -206, 0, 0);
      flag.name = `flag-${side}`;
      art.add(pole, stem, flag);
      flags.push(flag);
    }
    if (occasion === 'halloween') {
      const lantern = sprite('pumpkin', 28, 28, side === 'red' ? right : left, GROUND - 42, 0.5, 1);
      lanterns.push(lantern);
      art.add(land, lantern);
    }
    if (occasion === 'christmas') art.add(land, sprite('christmas-tree', 50, 64, side === 'red' ? 155 : 1125, GROUND - 3, 0.5, 1));
  }
  const snow = occasion === 'christmas' ? createSnow(art) : null;
  const fireworks = occasion === 'newYearsEve' ? createFireworks(art) : null;
  const bats = occasion === 'halloween' ? cartoonBats(art) : null;
  art.add(
    view,
    sky,
    ...starGroups,
    ...(fireworks ? [fireworks.view] : []),
    moon,
    ...(hat ? [hat] : []),
    ...(bats ? [bats.view] : []),
    land,
    ...(snow ? [snow.view] : []),
  );
  return {
    view,
    tick(t) {
      starGroups.forEach((g, i) => (g.alpha = 0.65 + 0.35 * Math.sin(t * (1.3 + i * 0.4) + i * 2.1)));
      moon.setPosition(1002, 188 + menuLift());
      hat?.setPosition(moon.x, moon.y - 41);
      // Transform the already painted flag/ribbon: zero geometry or uploads.
      flags.forEach((flag, i) => (flag.rotation = Math.sin(t * 5 + i) * 0.018));
      lanterns.forEach((l) => (l.alpha = 0.8 + 0.15 * Math.sin(t * 11)));
      snow?.tick(t);
      fireworks?.tick(t);
      bats?.tick(t);
    },
  };
}

export function cartoonPenForeground(art) {
  const view = art.container();
  for (const side of ['red', 'blue']) {
    const { left, right } = ARENA.pens[side];
    for (let x = left; x < right; x += 90) {
      const fence = art.sprites.sprite('fence', 90, 42, x, GROUND, 0, 1);
      fence.name = `front-fence-${side}`;
      art.add(view, fence);
    }
  }
  return { view };
}

function cartoonBats(art) {
  const view = art.container();
  const bats = Array.from({ length: 4 }, () => art.sprites.sprite('bat', 34, 19));
  art.add(view, ...bats);
  return {
    view,
    tick(t) {
      const pass = t % 14;
      view.visible = pass > 2 && pass < 10;
      bats.forEach((b, i) => {
        b.setPosition((pass - 2) * 180 - 50 - i * 36, 150 - layout.extra * 0.4 + Math.sin(t * 2.5 + i) * 12 + i * 18);
        b.setDisplaySize(34, 16 + Math.sin(t * 18 + i) * 5);
      });
    },
  };
}
