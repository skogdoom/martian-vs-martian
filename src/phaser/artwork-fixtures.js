// Render-only poses shared by the review preview and the independent Pixi
// reference harness. They never step a round or change production game rules.
import { WIDTH, SPOOK, WOLF, POWERUP } from '../config.js';
import { layout, menuLift } from '../layout.js';
import { createWorld } from '../logic/world.js';

export const ARTWORK_PAGES = [
  'arena',
  'sky',
  'scenery',
  'saucers',
  'animals',
  'icons',
  'drops',
  'wolves',
  'weapons',
  'hud',
  'menus',
  'effects-a',
  'effects-b',
  'effects-c',
];
export const EFFECT_CASES = [
  ['shot'],
  ['hit'],
  ['hit', { shielded: true }],
  ['bump'],
  ['interrupt'],
  ['pickup'],
  ['dropLanded'],
  ['powerup'],
  ['ammoCrate'],
  ['explosion'],
  ['explosion', { big: true }],
  ['rocketLaunch'],
  ['spooked'],
  ['extinguish'],
  ['splat'],
  ['splat', { kind: 'greenman' }],
  ['chuteOpen'],
  ['greenmanGone'],
  ['burst'],
  ['dazed'],
  ['momentumLost'],
  ['ram'],
  ['ram', { shielded: true }],
  ['wolfEat'],
  ['timeBombHeld'],
  ['timeBombLand'],
  ['wolfLand'],
  ['wolfLeaves'],
  ['knockLoose'],
  ['land'],
  ['land', { delivered: true }],
  ['land', { delivered: true, golden: true }],
  ['land', { delivered: true, stolen: true }],
];

export function buildArtwork(api, page = 'arena', phase = 'waxing') {
  if (!ARTWORK_PAGES.includes(page)) throw new Error(`Unknown artwork page: ${page}`);
  const view = api.container();
  const actors = [];
  const updates = [];
  const tracked = [];
  const cells = [];
  let elapsed = 0;
  const background = api.background();
  api.add(view, background);
  const heading = api.label(`PROCEDURAL ARTWORK · ${page.toUpperCase()}`, { size: 22, bold: true, anchorX: 0.5 });
  api.position(heading, WIDTH / 2, 10);
  function add(actor, sync, parent = view) {
    api.add(parent, actor.view);
    actors.push(() => sync(actor, elapsed));
    tracked.push(actor.view);
    return actor;
  }
  function tile(name, index, columns = 4, rows = 3, scale = 1.5) {
    const w = WIDTH / columns;
    const h = 540 / rows;
    const x = w * ((index % columns) + 0.5),
      y = 150 + h * Math.floor(index / columns);
    const tile = api.container(),
      art = api.container();
    api.position(tile, x, y);
    api.scale(art, scale);
    api.add(tile, art);
    const caption = api.label(name, { size: 12, color: 0x8a93c0, anchorX: 0.5 });
    api.position(caption, 0, h * 0.36);
    api.add(tile, caption);
    api.add(view, tile);
    cells.push({ name, x: x - w / 2 + 3, y: y - 82, width: w - 6, height: h - 3 });
    return art;
  }
  const animal = (kind, props = {}) => ({
    kind,
    x: 0,
    y: 20,
    vx: 0,
    state: 'field',
    owner: null,
    pen: null,
    bonus: false,
    golden: false,
    onFire: false,
    ...props,
  });
  const world = createWorld(7);
  // Any renderer reaching into gameplay RNG fails immediately in the preview
  // and harness. Cosmetic effects keep their original Math.random stream.
  world.rng = () => {
    throw new Error('Artwork must not consume gameplay RNG');
  };

  if (page === 'scenery') {
    const scenery = api.createBackdrop(phase);
    api.children(scenery.view)[0].visible = false;
    add(scenery, (a, t) => a.tick(t));
    if (api.sprites) add(api.createPenForeground(), () => {});
    const stars = api.createShootingStars();
    add(stars, (a) => a.render());
    updates.push((dt) => stars.update(dt));
    const fighters = api.createTieFlyby();
    add(fighters, (a) => a.render());
    updates.push((dt) => fighters.update(dt));
  } else if (page === 'sky') {
    background.visible = false;
    const sky = api.createBackdrop(phase);
    for (const [index, child] of api.children(sky.view).entries()) child.visible = index === 0;
    api.add(view, sky.view);
  } else if (page === 'arena') {
    background.visible = false;
    const field = api.container();
    api.add(view, field);
    add(api.createBackdrop(phase), (a, t) => a.tick(t), field);
    const stars = api.createShootingStars();
    add(stars, (a) => a.render(), field);
    updates.push((dt) => stars.update(dt));
    const fighters = api.createTieFlyby();
    add(fighters, (a) => a.render(), field);
    updates.push((dt) => fighters.update(dt));
    actors.push(() => (heading.y = 105 - layout.extra));
    Object.assign(world.saucers.red, { x: 440, y: 300, vx: 260, vy: -50 });
    Object.assign(world.saucers.blue, { x: 840, y: 360, vx: -200, vy: 0 });
    world.animals.push(animal('cow', { x: 440, y: 470, state: 'carried', golden: true }), animal('lamb', { x: 460, y: 525, state: 'carried' }));
    world.animals[0].onFire = true;
    world.rockets = [{ x: 520, y: 400, angle: -0.3 }];
    world.lasers.red = { x0: 120, x1: 330, y: 540, hit: true, dir: 1 };
    world.hooks.red.carrying = world.animals.at(-2);
    world.hooks.red.second = world.animals.at(-1);
    world.hooks.blue.target = world.animals[0];
    world.hooks.blue.progress = 0.65;
    add(api.createBeamView(), (a, t) => a.sync(world, t), field);
    add(api.createProjectileView(), (a, t) => a.sync(world, t), field);
    add(api.createAnimalView(world.animals), (a, t) => a.sync(t, world.spook), field);
    for (const side of ['red', 'blue'])
      add(
        api.createSaucerView(side),
        (a, t) => a.sync(world.saucers[side], t, { look: side === 'red' ? 1 : -1, beam: true, power: side === 'red' ? 'twin' : 'shield' }),
        field,
      );
    world.drops = [{ kind: 'greenman', x: 650, y: 425, vx: 0, state: 'descending', power: 'rocket' }];
    world.wolves = [{ x: 760, y: 660, vx: -40, state: 'field', eating: 1, bored: 0 }];
    world.timeBombs = [{ x: 180, y: 660, state: 'field', fuse: 2.55 }];
    add(api.createDropsView(), (a, t) => a.sync(world.drops, t), field);
    add(api.createWolvesView(), (a, t) => a.sync(world.wolves, t), field);
    add(api.createTimeBombsView(), (a, t) => a.sync(world.timeBombs, t), field);
    if (api.sprites) add(api.createPenForeground(), () => {}, field);
    const fx = api.createEffects();
    fx.handle([{ type: 'land', delivered: true, golden: true, value: 15, pen: 'red', side: 'red', x: 150, y: 660 }]);
    add(fx, (a) => a.render(), field);
    updates.push((dt) => {
      fx.ambient(world);
      fx.update(dt);
    });
    const hud = api.createHud();
    add(hud, (a) => {
      a.view.y = -layout.extra;
      a.sync(world, { timeLeft: 8.2, match: { wins: { red: 1, blue: 2 }, results: [], rounds: 3 } });
    });
    // Shake the entire arena, including its backdrop; HUD and banners stay anchored.
    actors.push(() => {
      const offset = fx.shakeOffset();
      api.position(field, offset.x, offset.y);
    });
    const banner = api.label('ROUND READY', { size: 36, color: 0xffd76a, bold: true, anchorX: 0.5 });
    api.position(banner, 640, 180);
    api.add(view, banner);
    actors.push(() => (banner.y = 180 + menuLift()));
  } else if (page === 'saucers') {
    const poses = [
      {},
      { beam: true },
      { power: 'shield', deflect: 1 },
      { power: 'speed', momentum: 1, ramReady: true },
      { power: 'rocket', hit: 0.8 },
      { power: 'bomb' },
      { power: 'timeBomb' },
      { stun: 1 },
      { momentum: 0.5 },
      { power: 'laser' },
      { power: 'steal' },
      { beam: true, hit: 1 },
    ];
    poses.forEach((pose, i) => {
      const side = i % 2 ? 'blue' : 'red';
      add(
        api.createSaucerView(side),
        (a, t) => a.sync({ x: 0, y: 0, vx: i % 3 ? -440 : 440, vy: 160, stun: pose.stun ?? 0 }, t, { look: i % 2 ? -1 : 1, ...pose }),
        tile(`${side} ${pose.power ?? (pose.stun ? 'dizzy' : 'pilot')}`, i),
      );
    });
  } else if (page === 'animals') {
    const poses = [
      {},
      { vx: 60 },
      { vx: -60 },
      { state: 'penned', owner: 'red', pen: 'red', bonus: true },
      { state: 'penned', owner: 'blue', pen: 'blue' },
      { state: 'descending', golden: true },
      { state: 'carried', owner: 'red' },
      { state: 'falling', chute: true, onFire: true },
      { state: 'gone' },
    ];
    for (const [ki, kind] of ['cow', 'lamb'].entries())
      poses.forEach((pose, i) => {
        const obj = animal(kind, pose);
        add(
          api.createAnimalView([obj]),
          (a, t) => a.sync(t, { red: 0, blue: SPOOK.warn + 0.1 }),
          tile(`${kind} ${i}: ${pose.state ?? (pose.vx ? 'walk' : 'idle')}`, ki * poses.length + i, 6, 4),
        );
      });
    const crowded = [animal('lamb'), animal('cow')];
    add(api.createAnimalView(crowded), (a, t) => a.sync(t), tile('cow behind lamb', 18, 6, 4, 1));
  } else if (page === 'icons') {
    POWERUP.types.forEach((type, i) => {
      const icon = api.createPowerIcon(type, 28);
      api.add(tile(type, i, 5), icon);
      tracked.push(icon);
    });
  } else if (page === 'drops') {
    const poses = [
      { kind: 'greenman', state: 'descending' },
      { kind: 'greenman', state: 'field', vx: 40 },
      { kind: 'greenman', state: 'field', vx: -40 },
      { kind: 'greenman', state: 'lifting' },
      { kind: 'greenman', state: 'field', panic: 1 },
      { kind: 'greenman', state: 'gone' },
      { kind: 'package', state: 'descending' },
      { kind: 'package', state: 'field' },
      { kind: 'package', state: 'falling' },
      { kind: 'crate', state: 'descending' },
      { kind: 'crate', state: 'field' },
      { kind: 'crate', state: 'lifting' },
    ];
    poses.forEach((pose, i) => {
      const obj = { x: 0, y: 36, vx: 0, power: 'laser', ...pose };
      add(api.createDropsView(), (a, t) => a.sync([obj], t), tile(`${pose.kind} ${pose.panic ? 'panic' : pose.state}`, i, 4, 3, 1.4));
    });
  } else if (page === 'wolves') {
    const poses = [
      {},
      { vx: 60 },
      { vx: -60 },
      { eating: 1 },
      { bored: WOLF.boredAfter },
      { state: 'descending' },
      { state: 'falling', chute: true },
      { state: 'carried' },
      { state: 'gone' },
    ];
    poses.forEach((pose, i) => {
      const obj = { x: 0, y: 36, vx: 0, state: 'field', eating: 0, bored: 0, ...pose };
      add(api.createWolvesView(), (a, t) => a.sync([obj], t), tile(`wolf ${i}`, i, 3));
    });
  } else if (page === 'weapons') {
    world.rockets = [
      { x: 140, y: 150, angle: 0 },
      { x: 380, y: 150, angle: 2.5 },
      { x: 620, y: 150, angle: -1.2 },
    ];
    world.bombs = [
      { x: 850, y: 150 },
      { x: 1100, y: 150 },
    ];
    world.projectiles = [
      { x: 210, y: 255, owner: 'red', dir: 1 },
      { x: 1000, y: 255, owner: 'blue', dir: -1 },
    ];
    world.lasers = { red: { x0: 70, x1: 530, y: 340, hit: true, dir: 1 }, blue: { x0: 1210, x1: 710, y: 340, hit: true, dir: -1 } };
    add(api.createProjectileView(), (a, t) => a.sync(world, t));
    world.saucers.red = { x: 260, y: 430 };
    world.saucers.blue = { x: 990, y: 430 };
    world.hooks.red.target = animal('cow', { x: 310, y: 630 });
    world.hooks.red.progress = 0.06;
    world.hooks.blue.carrying = animal('lamb', { x: 950, y: 640 });
    world.hooks.blue.second = animal('cow', { x: 880, y: 630 });
    add(api.createBeamView(), (a, t) => a.sync(world, t));
    world.timeBombs = [2.55, 6.25, 0.4].map((fuse, i) => ({ x: 570 + 125 * i, y: 550, state: i === 1 ? 'carried' : 'field', fuse }));
    add(api.createTimeBombsView(), (a, t) => a.sync(world.timeBombs, t));
  } else if (page === 'hud') {
    [null, 'speed', 'rocket', 'laser', 'unlimited', 'timeBomb'].forEach((power, i) => {
      const w = createWorld(i);
      w.rng = world.rng;
      w.animals = [animal('cow', { state: 'penned', pen: 'red', golden: true }), animal('lamb', { state: 'penned', pen: 'blue', bonus: true })];
      Object.assign(w.weapons.red, { clip: i % 3, reload: i % 2 ? 0.5 : 0 });
      Object.assign(w.weapons.blue, { clip: 0, reload: 0.75, ammo: 0 });
      for (const side of ['red', 'blue'])
        w.powers[side] = power ? { type: power, timeLeft: ['rocket', 'timeBomb'].includes(power) ? null : i === 1 ? 2.4 : 10 } : null;
      const hud = api.createHud({ red: 'RED', blue: i % 2 ? 'CPU' : 'BLUE' });
      hud.view.y = 70 + i * 105;
      add(hud, (a) =>
        a.sync(w, { timeLeft: i % 2 ? 8.2 : 89, match: { wins: { red: i % 3, blue: 1 }, results: Array(i === 5 ? 3 : 0).fill({}), rounds: 3 } }),
      );
    });
  } else if (page === 'menus') {
    const veil = api.dimmer(0.25);
    api.add(view, veil);
    const menu = api.createMenu({
      items: [
        { id: 'sound', text: () => 'SOUND: ON' },
        { id: 'ratio', text: () => '16:9: NO (USE THE WHOLE HEIGHT)' },
        { id: 'resume', text: () => 'RESUME' },
      ],
      y0: 300,
    });
    api.add(view, menu.view);
    tracked.push(menu.view);
    const text = api.label('PAUSED\nROUND OVER · BLUE WINS\nSUDDEN DEATH', { size: 32, bold: true, anchorX: 0.5, anchorY: 0.5, align: 'center' });
    api.position(text, 640, 150);
    api.add(view, text);
    const centered = api.centerUi(view, 2);
    actors.push(() => centered.sync());
  } else if (page.startsWith('effects-')) {
    const start = (page.charCodeAt(page.length - 1) - 97) * 12;
    EFFECT_CASES.slice(start, start + 12).forEach(([type, props = {}], i) => {
      const fx = api.createEffects();
      fx.view.y = -660;
      fx.handle([{ type, side: 'red', victim: 'blue', pen: 'red', kind: 'cow', dir: 1, value: 5, x: 0, y: 660, ...props }]);
      add(
        fx,
        (a) => a.render(),
        tile(
          `${type}${props.shielded ? ' shielded' : props.big ? ' big' : props.golden ? ' golden' : props.kind === 'greenman' ? ' green' : props.stolen ? ' stolen' : props.delivered ? ' delivered' : ''}`,
          i,
          4,
          3,
          0.6,
        ),
      );
      updates.push((dt) => fx.update(dt));
    });
  }
  api.add(view, heading);
  const before = JSON.stringify(world);
  return {
    view,
    page,
    phase,
    cells,
    tracked,
    world,
    get elapsed() {
      return elapsed;
    },
    update(dt) {
      elapsed += dt;
      for (const update of updates) update(dt);
    },
    render() {
      view.y = ['arena', 'sky', 'scenery'].includes(page) ? 0 : -layout.extra;
      for (const actor of actors) actor();
      if (JSON.stringify(world) !== before) throw new Error('Artwork changed simulation state');
    },
  };
}
