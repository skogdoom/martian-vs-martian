// Independent references use the unchanged real Pixi view factories.
import { Container, Graphics, FillGradient } from 'pixi.js';
import { createSaucerView } from '../../src/render/saucerView.js';
import { createAnimalView } from '../../src/render/animalView.js';
import { createWolfSprite } from '../../src/render/wolfView.js';
import { drawParachute } from '../../src/render/powerupView.js';
import { label } from '../../src/render/text.js';
import { layout } from '../../src/layout.js';
import { GALLERY_ITEMS, GALLERY_TIME, GALLERY_BACKGROUND, TEXT_LINES, tilePosition } from '../../src/phaser/gallery-fixtures.js';

function animal(kind) {
  const a = { kind, x: 0, y: 0, vx: 0, state: 'field', owner: null, onFire: false, golden: false, bonus: false };
  const sprite = createAnimalView([a]);
  sprite.sync(GALLERY_TIME);
  return sprite.view;
}

export function installPixiGallery() {
  const app = window.__game.app;
  app.ticker.stop();
  const tiles = [];
  const view = new Container();
  view.addChild(new Graphics().rect(0, -400, 1280, 1520).fill(GALLERY_BACKGROUND));
  const heading = label('PHASER DRAWING GALLERY', { size: 24, bold: true, anchorX: 0.5 });
  heading.position.set(640, 16);
  view.addChild(heading);
  for (const [index, name] of GALLERY_ITEMS.entries()) {
    const { x, y } = tilePosition(index);
    const tile = new Container();
    tile.position.set(x, y);
    const caption = label(name.toUpperCase(), { size: 13, color: 0x8a93c0, anchorX: 0.5 });
    caption.position.set(0, 62);
    tile.addChild(caption);
    let art;
    if (name.startsWith('saucer-')) {
      const side = name.slice(7);
      const sprite = createSaucerView(side);
      sprite.sync({ x: 0, y: -Math.sin(GALLERY_TIME * 3 + (side === 'red' ? 0 : 1.7)) * 1.5, vx: 0, vy: 0, stun: 0 }, GALLERY_TIME, {
        look: side === 'red' ? 1 : -1,
        beam: true,
      });
      art = sprite.view;
      art.scale.set(2);
    } else if (name === 'cow' || name === 'lamb') {
      art = animal(name);
      art.position.set(0, 40);
      art.scale.set(2);
    } else if (name === 'wolf') {
      const sprite = createWolfSprite();
      sprite.sync({ x: 0, y: 0, vx: 0, state: 'field', eating: 0, bored: 0 }, GALLERY_TIME);
      art = sprite.view;
      art.position.set(0, 40);
      art.scale.set(2);
    } else if (name === 'parachute') {
      art = new Graphics();
      drawParachute(art);
      art.position.set(0, 100);
      art.scale.set(1.7);
    } else if (name === 'gradient') {
      const gradient = new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: 0x050817 },
          { offset: 0.55, color: 0x15204a },
          { offset: 1, color: 0x3b2f5e },
        ],
        textureSpace: 'local',
      });
      art = new Graphics().rect(0, -400, 1280, 1060).fill(gradient);
      art.position.set(-130, -65 + 400 * (120 / 1060));
      art.scale.set(260 / 1280, 120 / 1060);
    } else if (name.startsWith('text-')) {
      art = label(TEXT_LINES, {
        size: 22,
        bold: name === 'text-center',
        anchorX: 0.5,
        anchorY: 0.5,
        align: name === 'text-center' ? 'center' : 'left',
      });
    } else if (name === 'glow') {
      art = new Graphics()
        .ellipse(-25, 0, 55, 35)
        .fill({ color: 0xe5484d, alpha: 0.3 })
        .ellipse(25, 0, 55, 35)
        .fill({ color: 0x3e8ef7, alpha: 0.35 });
      art.alpha = 0.7;
    } else if (name === 'paths') {
      art = new Graphics().roundRect(-90, -40, 70, 60, 12).fill(0xf6f2e8).stroke({ color: 0xe5484d, width: 3 });
      art.star(45, -5, 5, 30, 12).fill(0xffd76a).stroke({ color: 0x8a6a1a, width: 2 });
      art.moveTo(-90, 40).bezierCurveTo(-30, -15, 40, 90, 95, 25).stroke({ color: 0x6cff6c, width: 5, cap: 'round' });
    } else if (name === 'nested-tint') {
      const outer = new Container();
      outer.alpha = 0.65;
      outer.rotation = 0.12;
      outer.tint = 0xffcf3a;
      const child = animal('cow');
      child.scale.set(-1.8, 1.8);
      child.position.set(0, 38);
      child.tint = 0xb8a898;
      outer.addChild(child);
      art = outer;
    }
    tile.addChild(art);
    view.addChild(tile);
    tiles.push({ name, view: tile, art, caption });
  }
  window.__game.game.go(() => ({
    view,
    tiles,
    update() {},
    render() {
      view.y = -layout.extra;
    },
  }));
  window.__game.scene.render();
  app.render();
  return tiles.map(({ name, art }) => ({
    name,
    bounds: { x: art.getBounds().x, y: art.getBounds().y, width: art.getBounds().width, height: art.getBounds().height },
  }));
}
