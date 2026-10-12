// Meaningful cache aliasing/lifetime assertions against the real presentation.
import { createPresentation } from '../../src/phaser/presentation.js';
import { createArt } from '../../src/phaser/art.js';
export function checkCache(host) {
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  host.game.events.emit('postrender');
  const baseline = host.textures.getTextureKeys().length;
  const store = createPresentation(host),
    scope = store.scope();
  const art = createArt(scope),
    a = art.graphics(),
    b = art.graphics();
  const draw = (view, color, radius = 4) => art.draw(view).clear().circle(20, 20, radius, { fill: color, alpha: 0.5 });
  draw(a, 0xff0000);
  draw(b, 0xff0000);
  assert(a.list[0].texture.key === b.list[0].texture.key, 'identical recipes did not share');
  draw(a, 0x00ff00);
  assert(a.list[0].texture.key !== b.list[0].texture.key, 'changing one shared bitmap mutated the other');
  const red = b.list[0].texture.key,
    green = a.list[0].texture.key;
  draw(b, 0x00ff00);
  host.game.events.emit('postrender');
  assert(store.metrics.retainedRecipes === 1, 'unused animation recipe was not retained');
  draw(a, 0xff0000);
  assert(a.list[0].texture.key === red && b.list[0].texture.key === green, 'slot permutation rebaked or lost recipes');
  const stable = store.stats.textures;
  for (let i = 0; i < 100; i++) {
    draw(a, i % 2 ? 0xff0000 : 0x00ff00);
    draw(b, i % 2 ? 0x00ff00 : 0xff0000);
    host.game.events.emit('postrender');
    assert(store.stats.textures === stable, 'permutations accumulated cached textures');
  }
  // Unique, short-lived recipes cannot leave an unbounded retained cache.
  for (let i = 0; i < 100; i++) {
    draw(a, i + 1, 5 + i / 100);
    host.game.events.emit('postrender');
    assert(store.stats.textures <= 66 && store.metrics.retainedRecipes <= 64, 'recipe retention exceeded its count budget');
    assert(store.metrics.retainedRgbaBytes <= 4 * 1024 * 1024, 'recipe retention exceeded its byte budget');
  }
  assert(a.list[0].texture.imageData === undefined, 'immutable recipe allocated an unused pixel buffer');
  const box = { x: 0, y: 0, width: 256, height: 256 };
  const fill = (ctx) => ctx.fillRect(0, 0, 256, 256);
  const budget = scope.bitmap(box, fill, { resolution: 1, cacheKey: 'budget-start' });
  for (let i = 0; i < 24; i++) {
    scope.repaint(budget, box, fill, { resolution: 1, cacheKey: `budget-${i}` });
    host.game.events.emit('postrender');
    assert(store.metrics.retainedRgbaBytes <= 4 * 1024 * 1024, 'byte budget failed before count budget');
  }
  let rejected = false;
  try {
    scope.repaint(budget, box, fill);
  } catch {
    rejected = true;
  }
  assert(rejected, 'cached immutable recipe allowed mutable repaint');
  const parent = scope.container();
  art.add(parent, a);
  scope.tint(parent, 0x808080);
  assert(host.game.renderer.gl ? a.list[0].tintTopLeft === 0x808080 : store.stats.variants === 1, 'inherited tint failed for this renderer');
  scope.dispose();
  assert(store.stats.textures === 0 && store.metrics.cachedRecipes === 0, 'cache survived scope disposal');
  store.dispose();
  assert(host.textures.getTextureKeys().length === baseline, 'temporary store leaked resources');
  return {
    shared_recipes: true,
    copy_on_change: true,
    permutation_reuses: 100,
    cross_frame_reuse: true,
    bounded_unique_recipes: 100,
    byte_budget_checked: true,
    immutable_pixel_copy_avoided: true,
    inherited_tint: true,
    disposal: true,
  };
}
