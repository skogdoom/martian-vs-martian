import { WIDTH, HEIGHT, ARENA } from '../../config.js';
import { PAD, menuLift, layout } from '../../layout.js';
import { createRng } from '../../logic/rng.js';
import { occasion } from '../../occasion.js';
import { createSnow, createFireworks } from '../render/festive.js';
import { MOON_PHASES, MOON_AT, moonLitOutline, drawMoonSmile } from '../render/backdrop.js';

const GROUND = ARENA.groundY;
const FENCE_WIDTH = 90;
const FENCE_HEIGHT = 42;
// The illustrated posts are centered 10% inside the fence frame's edges.
const FENCE_POST_INSET = FENCE_WIDTH * 0.1;

function cartoonMoon(art, phase) {
  const view = art.container();
  view.name = 'cartoon-moon';
  const glow = (1 + MOON_PHASES[phase].bulge) / 2;
  const haze = occasion === 'halloween' ? 0xffb35c : 0xfff6d8;
  const atmosphere = art.graphics((draw) =>
    draw
      .circle(0, 0, 60, { fill: haze, alpha: 0.02 + 0.04 * glow })
      .circle(0, 0, 44, { fill: haze, alpha: 0.03 + 0.05 * glow })
      .circle(0, 0, 32, { fill: 0x2b3150, alpha: 0.9 }),
  );
  // A trimmed phase frame is narrower than the full disk. Clip the full-moon
  // artwork instead of stretching each phase to a square or centering its lit
  // half. Bake once per view; movement never repaints or uploads the texture.
  const source = art.sprites.sprite('moon-full', 64, 64);
  const frame = source.frame;
  const points = moonLitOutline(phase, 32, 64);
  const lit = art.scope.bitmap(
    { x: -32, y: -32, width: 64, height: 64 },
    (ctx) => {
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      ctx.closePath();
      ctx.clip();
      // Slightly overscan the source to keep its heavy outline outside the
      // moon's circular limb and away from the phase terminator.
      ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, -34, -34, 68, 68);
    },
    { resolution: 4, cacheKey: `cartoon-moon-${phase}`, imageSmoothingQuality: 'high' },
  );
  source.destroy();
  lit.name = 'cartoon-moon-lit';
  if (occasion === 'halloween') art.tint(lit, 0xffb15c);
  art.add(view, atmosphere, lit);
  if (occasion === 'christmas') {
    const face = art.graphics();
    face.name = 'moon-smile';
    drawMoonSmile(art, face);
    art.add(view, face);
  }
  return view;
}

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
  const moon = occasion === 'mayTheFourth' ? sprite('battle-station', 66, 66) : cartoonMoon(art, full ? 'full' : phase);
  // Center the white brim, excluding the pom-pom on the right of the frame.
  const hat = occasion === 'christmas' ? sprite('santa-hat', 72, 48, 0, 0, 0.4, 1) : null;
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
      const postX = side === 'red' ? right - FENCE_POST_INSET : left + FENCE_POST_INSET;
      const lantern = sprite('pumpkin', 28, 28, postX, GROUND - FENCE_HEIGHT, 0.5, 1);
      lanterns.push(lantern);
      art.add(land, lantern);
    }
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
      moon.setPosition(MOON_AT.x, MOON_AT.y + menuLift());
      hat?.setPosition(moon.x, moon.y - 20);
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
    for (let x = left; x < right; x += FENCE_WIDTH) {
      const fence = art.sprites.sprite('fence', FENCE_WIDTH, FENCE_HEIGHT, x, GROUND, 0, 1);
      fence.name = `front-fence-${side}`;
      art.add(view, fence);
    }
  }
  if (occasion === 'christmas') {
    // Keep the whole tree outside the pen, on the field side of its gate.
    // Adding it after the fences keeps the lower branches visible too.
    const width = 50;
    for (const side of ['red', 'blue']) {
      const { left, right } = ARENA.pens[side];
      const x = side === 'red' ? right + width / 2 + 10 : left - width / 2 - 10;
      art.add(view, art.sprites.sprite('christmas-tree', width, 64, x, GROUND + 8, 0.5, 1));
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
