// Browser assertions against real Phaser objects, including host adoption.
import { createPresentation } from '../../src/phaser/presentation.js';
import { createListView } from '../../src/phaser/listView.js';
import { dimmer, centerUi } from '../../src/phaser/uiLayer.js';
import { createGallery } from '../../src/phaser/gallery.js';
import { layout } from '../../src/layout.js';

export function checkOwnership(host, referenceLabel) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const throws = (fn) => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };
  const count = (node) => 1 + (node.list ?? []).reduce((sum, child) => sum + count(child), 0);
  const snapshot = () => ({
    objects: count(host.root),
    display: host.sys.displayList.length,
    updates: host.sys.updateList.getActive().length,
    textures: host.textures.getTextureKeys().length,
    gpuTextures: host.game.renderer.glTextureWrappers?.length ?? 0,
    store: host.presentation.stats,
  });
  const baseline = snapshot();
  const store = createPresentation(host);
  const bounds = { x: -10, y: -5, width: 20, height: 10 };
  const draw = (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -5, 20, 10);
  };
  const shared = store.shared('ownership-white', bounds, draw);
  const warmed = snapshot();
  for (let i = 0; i < 100; i++) {
    const scope = store.scope();
    host.layer.add(scope.root);
    const holder = scope.container().setAlpha(0.5).setRotation(0.2).setScale(-1, 1);
    const sharedImage = scope.image(shared, holder);
    const privateImage = scope.bitmap(bounds, draw, undefined, holder);
    assert(sharedImage.originX === 0.5 && sharedImage.originY === 0.5 && sharedImage.displayWidth === 20, 'bitmap origin/resolution changed');
    scope.tint(holder, 0xffcf3a);
    scope.tint(privateImage, 0xb8a898);
    assert(store.stats.variants === (host.game.renderer.gl ? 0 : 2), 'tint variants do not match the renderer');
    assert(host.game.renderer.gl || privateImage.tintTopLeft === 0xffffff, 'Canvas tint relies on WebGL-only native tint');
    // Reparenting changes inherited tint without destroying either texture.
    const other = scope.container();
    scope.attach(other, privateImage, 0);
    assert(other.list[0] === privateImage && !privateImage.displayList, 'child registered twice or reordered');
    assert(privateImage.texture.key !== sharedImage.texture.key, 'private texture unexpectedly shared');
    scope.tint(privateImage, 0xffffff);
    const label = scope.label('RED ↑ BLUE\n∞ × — !', { size: 22, bold: true, anchorX: 1, anchorY: 0.5, align: 'right' });
    const labelKey = label.texture.key;
    assert(
      label.style.resolution === 2 &&
        label.height === referenceLabel.height &&
        Math.abs(label.width - referenceLabel.width) < 1 &&
        label.originX === 1,
      `label metrics/resolution/origin changed: ${JSON.stringify({ cycle: i, height: label.height, metrics: label.style.metrics, resolution: label.style.resolution, origin: label.originX })}`,
    );
    label.setText('MUTATED ×\n∞');
    scope.tint(label, 0xffcf3a);
    assert(label.style.color === '#ffcf3a', 'label tint changed its alpha or base colour');
    let destroyed = 0;
    for (const node of [scope.root, holder, sharedImage, privateImage, label]) node.once('destroy', () => destroyed++);
    const uiView = scope.container();
    const background = dimmer(scope, 0.6, uiView);
    const uiLabel = scope.label('CENTERED UI', {}, uiView);
    const ui = centerUi(scope, uiView, 1);
    ui.sync();
    assert(ui.ui.y === -layout.extra / 2 && uiView.list[0] === background && ui.ui.list[0] === uiLabel, 'UI lift or child order changed');
    scope.dispose();
    scope.dispose();
    assert(destroyed === 5 && scope.disposed, 'view destruction ran more than once');
    assert(!host.textures.exists(labelKey), 'native text texture leaked');
    assert(throws(() => scope.bitmap(bounds, draw)) && throws(() => scope.container()), 'disposed scope allocated resources');
    assert(store.stats.textures === 1 && store.stats.references === 0 && store.stats.variants === 0, 'scene-owned texture/variant leaked');
    assert(JSON.stringify(snapshot()) === JSON.stringify(warmed), 'objects or texture keys accumulated during 100 disposal cycles');
  }
  // A cached object/slot can be hidden and reused without another allocation.
  const pool = store.scope();
  let allocations = 0;
  let pooled;
  const list = createListView(pool, () => {
    allocations++;
    pooled = pool.image(shared);
    return { view: pooled, sync: (obj) => pooled.setVisible(!obj.gone) };
  });
  const slot = { gone: false };
  for (let i = 0; i < 100; i++) {
    slot.gone = i % 2 === 0;
    list.sync([slot], i);
    assert(pooled.visible !== slot.gone, 'cached object visibility changed');
  }
  assert(allocations === 1 && list.size === 1, 'pooled object allocated repeatedly');
  pool.dispose();
  assert(list.size === 0, 'cached object map retained disposed views');
  store.dispose();
  store.dispose();
  assert(throws(() => store.scope()) && store.stats.textures === 0, 'disposed store retained textures or allowed a scope');
  assert(JSON.stringify(snapshot()) === JSON.stringify(baseline), 'store disposal retained shared textures');

  // Exercise the real host transition: logical cleanup precedes adoption.
  const old = host.presentation.scope();
  const image = old.bitmap(bounds, draw);
  const adoptedKey = image.texture.key;
  let imageDestroyed = 0;
  let logicalDisposed = 0;
  image.once('destroy', () => imageDestroyed++);
  host.go(() => ({ view: old.root, update() {}, render() {}, destroy: () => logicalDisposed++ }));
  const next = host.presentation.scope();
  host.go(() => {
    next.attach(next.root, old.root);
    return { view: next.root, update() {}, render() {} };
  });
  assert(logicalDisposed === 1 && !old.disposed && image.scene && host.textures.exists(adoptedKey), 'host destroyed the adopted result view');
  assert(
    throws(() => host.presentation.dispose()),
    'live resources could be freed prematurely',
  );
  host.go(createGallery);
  assert(imageDestroyed === 1 && old.disposed && next.disposed && !host.textures.exists(adoptedKey), 'adopted view was not freed exactly once');
  const galleryBaseline = snapshot();
  for (let i = 0; i < 100; i++) {
    host.go(createGallery);
    host.logical.render();
    assert(JSON.stringify(snapshot()) === JSON.stringify(galleryBaseline), 'gallery transitions accumulated textures/objects');
  }
  const report = {
    scope_cycles: 100,
    gallery_transitions: 100,
    pooled_slot_reuses: 100,
    adoption_survives_old_disposer: true,
    destruction_once: true,
    private_and_text_textures_released: true,
    shared_textures_retained_until_host_disposal: true,
    baseline: galleryBaseline,
  };
  const app = host.game;
  app.destroy(true);
  app.step(100000, 0);
  assert(host.disposed && host.presentation.stats.textures === 0 && !window.__game, 'host disposal retained presentation resources');
  assert(document.querySelectorAll('canvas').length === 0, 'host canvas retained');
  report.host_disposal = true;
  return report;
}
