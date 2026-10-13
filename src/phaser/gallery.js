import { createDrawing } from './drawing.js';
import { saucer, animal, wolf, parachute, skyTexture } from './representatives.js';
import { GALLERY_ITEMS, GALLERY_BACKGROUND, TEXT_LINES, tilePosition } from './gallery-fixtures.js';
import { layout, setFixed169 } from '../layout.js';
import { wasPressed } from './input.js';
import { dimmer, centerUi } from './uiLayer.js';

/** Static primitive gallery; no game rules or cosmetic RNG run here. */
export function createGallery(host) {
  const scope = host.presentation.scope();
  const view = scope.root;
  scope.graphics().fillStyle(GALLERY_BACKGROUND).fillRect(0, -400, 1280, 1520);
  scope.label('PHASER DRAWING GALLERY', { size: 24, bold: true, anchorX: 0.5 }).setPosition(640, 16);
  const tiles = [];
  for (const [index, name] of GALLERY_ITEMS.entries()) {
    const { x, y } = tilePosition(index);
    const tile = scope.container().setPosition(x, y);
    const caption = scope.label(name.toUpperCase(), { size: 13, color: 0x8a93c0, anchorX: 0.5 }, tile).setPosition(0, 62);
    let art;
    if (name.startsWith('saucer-')) art = saucer(scope, host.presentation, name.slice(7), tile).setScale(2);
    else if (name === 'cow' || name === 'lamb') art = animal(scope, host.presentation, name, tile).setPosition(0, 40).setScale(2);
    else if (name === 'wolf') art = wolf(scope, host.presentation, tile).setPosition(0, 40).setScale(2);
    else if (name === 'parachute') art = parachute(scope, host.presentation, tile).setPosition(0, 100).setScale(1.7);
    else if (name === 'gradient') {
      // A miniature of the full padded sky; stop at 0.55 is retained exactly.
      const holder = scope
        .container(tile)
        .setPosition(-130, -65)
        .setScale(260 / 1280, 120 / 1060);
      art = scope.image(skyTexture(host.presentation), holder).setPosition(0, 400);
    } else if (name.startsWith('text-')) {
      art = scope.label(
        TEXT_LINES,
        { size: 22, bold: name === 'text-center', anchorX: 0.5, anchorY: 0.5, align: name === 'text-center' ? 'center' : 'left' },
        tile,
      );
    } else if (name === 'glow') {
      art = scope.container(tile);
      const g = createDrawing(scope, host.presentation, 'glow', art);
      g.ellipse(-25, 0, 55, 35, { fill: 0xe5484d, alpha: 0.3 });
      g.ellipse(25, 0, 55, 35, { fill: 0x3e8ef7, alpha: 0.35 });
      art.setAlpha(0.7);
    } else if (name === 'paths') {
      art = scope.container(tile);
      const g = createDrawing(scope, host.presentation, 'paths', art);
      g.roundRect(-90, -40, 70, 60, 12, { fill: 0xf6f2e8, stroke: 0xe5484d, width: 3 });
      g.star(45, -5, 5, 30, 12, { fill: 0xffd76a, stroke: 0x8a6a1a, width: 2 });
      g.curve(
        [
          ['moveTo', -90, 40],
          ['bezierCurveTo', -30, -15, 40, 90, 95, 25],
        ],
        { stroke: 0x6cff6c, width: 5, cap: 'round' },
      );
    } else if (name === 'nested-tint') {
      const outer = scope.container(tile).setAlpha(0.65).setRotation(0.12);
      art = animal(scope, host.presentation, 'cow', outer).setScale(-1.8, 1.8).setPosition(0, 38);
      scope.tint(outer, 0xffcf3a);
      scope.tint(art, 0xb8a898);
    }
    tiles.push({ name, view: tile, art, caption });
  }
  // Exercise the UI helpers without covering the gallery during comparisons.
  const uiTest = scope.container().setVisible(false);
  dimmer(scope, 0.6, uiTest);
  scope.label('UI OWNERSHIP', { size: 18 }, uiTest);
  const centered = centerUi(scope, uiTest, 1);
  return {
    view,
    scope,
    tiles,
    update() {
      if (wasPressed('KeyV')) {
        host.session.ratio169 = !layout.fixed169;
        setFixed169(host.session.ratio169);
      }
    },
    render() {
      view.y = -layout.extra;
      centered.sync();
    },
  };
}
