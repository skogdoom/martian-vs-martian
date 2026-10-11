// Real view/texture lifecycle checks for the complete milestone 3 artwork.
import { createArt } from '../../src/phaser/art.js';
import { ARTWORK_PAGES } from '../../src/phaser/artwork-fixtures.js';
import { createSaucerView } from '../../src/phaser/render/saucerView.js';
import { createAnimalView } from '../../src/phaser/render/animalView.js';
import { createDropsView } from '../../src/phaser/render/powerupView.js';
import { createProjectileView } from '../../src/phaser/render/projectileView.js';
import { createEffects } from '../../src/phaser/render/effects.js';

export async function checkArtworkOwnership(host) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const empty = () => ({ view: host.make.container({ add: false }), update() {}, render() {} });
  const count = (node) => 1 + (node.list ?? []).reduce((n, child) => n + count(child), 0);
  const snapshot = () => ({
    objects: count(host.root),
    display: host.sys.displayList.length,
    updates: host.sys.updateList.getActive().length,
    textures: host.textures.getTextureKeys().length,
    gpu: host.game.renderer.glTextureWrappers?.length ?? 0,
    store: host.presentation.stats,
  });
  host.go(empty);
  const baseline = JSON.stringify(snapshot());
  const pages = new Map();
  for (let i = 0; i < 100; i++) {
    const page = ARTWORK_PAGES[i % ARTWORK_PAGES.length];
    host.go(host.artworkFactory, page, 'waxing', 12345);
    host.logical.render();
    for (let frame = 0; frame < 6; frame++) {
      host.logical.fixture.update(1 / 60);
      host.logical.render();
    }
    const views = count(host.logical.view);
    pages.set(page, views);
    host.go(empty);
    assert(JSON.stringify(snapshot()) === baseline, `Artwork lifecycle grew after cycle ${i}: ${JSON.stringify(snapshot())}`);
    // Real transitions occur in separate browser tasks. Let native canvas/GPU
    // housekeeping and garbage collection run between cycles, without advancing
    // game time or bypassing texture creation/destruction.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const scope = host.presentation.scope();
  const art = createArt(scope);
  const moving = art.graphics();
  art.draw(moving).circle(0.3, 0.7, 3.25, { fill: 0xffffff, alpha: 0.5 });
  const movingUploads = art.uploads;
  for (let i = 0; i < 100; i++)
    art
      .draw(moving)
      .clear()
      .circle(i * 0.173, i * 0.297, 3.25, { fill: 0xffffff, alpha: (i + 1) / 100 });
  assert(art.uploads === movingUploads, 'Position/alpha-only particles rebaked their texture');
  const rectangle = art.graphics();
  art.draw(rectangle).rect(0, -400, 1280, 1520, { fill: 0x101c3d });
  const pixel = rectangle.list[0];
  assert(pixel.texture.source[0].width === 1 && pixel.texture.source[0].height === 1, 'Solid rectangle allocated a large paint canvas');
  const rectangleUploads = art.uploads;
  for (let i = 0; i < 100; i++)
    art
      .draw(rectangle)
      .clear()
      .rect(i, -400, i * 12, i + 1, { fill: 0x101c3d });
  assert(
    art.uploads === rectangleUploads && pixel.scaleX === 1188 && pixel.scaleY === 100,
    'Changing rectangle dimensions rebaked or changed its native transform',
  );
  const s = createSaucerView(art, 'red');
  const state = { x: 0, y: 0, vx: 0, vy: 0, stun: 0 };
  s.sync(state, 1.25);
  const uploads = art.uploads;
  for (let i = 0; i < 100; i++) s.sync(state, 1.25);
  assert(art.uploads === uploads, 'Unchanged pilot/lights were uploaded again');
  const a = { kind: 'cow', x: 0, y: 0, vx: 0, state: 'field', owner: null };
  const herd = createAnimalView(art, [a]);
  const drops = createDropsView(art);
  const drop = { x: 0, y: 0, vx: 0, state: 'field', kind: 'crate' };
  for (let i = 0; i < 100; i++) {
    a.state = drop.state = i % 2 ? 'field' : 'gone';
    herd.sync(i / 60);
    drops.sync([drop], i / 60);
  }
  assert(drops.size === 1 && herd.view.list.length === 1, 'Object identity cache allocated repeatedly');
  const shots = createProjectileView(art);
  const world = { rockets: [{ x: 0, y: 0, angle: 0 }], bombs: [{ x: 0, y: 0 }], lasers: { red: null, blue: null }, projectiles: [] };
  shots.sync(world, 0);
  const pooled = shots.view.list.slice(1);
  const keys = pooled.map((node) => node.list[0].texture.key);
  for (let i = 0; i < 100; i++) {
    world.rockets[0].x = i;
    world.bombs[0].y = i;
    shots.sync(world, i / 60);
  }
  assert(shots.view.list.length === 3 && pooled.every((node, i) => node.list[0].texture.key === keys[i]), 'Rocket/bomb pools recreated textures');
  world.rockets = [];
  world.bombs = [];
  shots.sync(world, 2);
  assert(
    pooled.every((node) => !node.visible),
    'Unused rocket/bomb slots stayed visible',
  );
  // Owned mutable images retain their key and update tinted variants safely.
  const bounds = { x: -5, y: -5, width: 10, height: 10 };
  const image = scope.bitmap(bounds, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, -5, 10, 10);
  });
  const holder = scope.container();
  scope.attach(holder, image);
  art.tint(holder, 0xffcf3a);
  let paintKey;
  for (let i = 0; i < 100; i++) {
    scope.repaint(image, bounds, (ctx) => {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#808080';
      ctx.fillRect(-5, -5, 10, 10);
    });
    const pixel = image.texture.getContext().getImageData(5, 5, 1, 1).data;
    assert(pixel[0] === (i % 2 ? 255 : 128), 'Mutable base did not refresh its tinted pixels');
    const stats = host.presentation.stats;
    assert(stats.variants === (i === 0 ? stats.variants : paintKey), 'Mutable tint variants accumulated');
    paintKey = stats.variants;
  }
  const fx = createEffects(art);
  for (let i = 0; i < 40; i++) fx.handle([{ type: 'dazed', x: 0, y: 0, side: 'red' }]);
  assert(fx.view.list.length === 13, 'Popup cap is not twelve');
  fx.update(2);
  fx.render();
  assert(fx.view.list.length === 1, 'Expired popup texts survived');
  scope.dispose();
  scope.dispose();
  assert(drops.size === 0 && JSON.stringify(snapshot()) === baseline, 'Cached/mutable resources survived disposal');
  return {
    scene_cycles: 100,
    pages: Object.fromEntries(pages),
    unchanged_draw_reuses: 100,
    object_cache_reuses: 100,
    projectile_pool_reuses: 100,
    solid_rectangle_resize_reuses: 100,
    mutable_tint_repaints: 100,
    popup_cap: 12,
    baseline: JSON.parse(baseline),
    textures_and_objects_plateau: true,
  };
}
