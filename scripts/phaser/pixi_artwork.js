// Independent references: all artwork comes from the unchanged Pixi factories.
import { Container, Graphics } from 'pixi.js';
import { buildArtwork } from '../../src/phaser/artwork-fixtures.js';
import * as saucers from '../../src/render/saucerView.js';
import * as animals from '../../src/render/animalView.js';
import * as powerups from '../../src/render/powerupView.js';
import * as wolves from '../../src/render/wolfView.js';
import * as bombs from '../../src/render/timeBombView.js';
import * as projectiles from '../../src/render/projectileView.js';
import * as effects from '../../src/render/effects.js';
import * as hud from '../../src/render/hud.js';
import * as menu from '../../src/render/menu.js';
import * as ui from '../../src/render/uiLayer.js';
import * as shootingStars from '../../src/render/shootingStars.js';
import * as tieFlyby from '../../src/render/tieFlyby.js';
import { occasion } from '../../src/occasion.js';
import { label } from '../../src/render/text.js';

export async function installPixiArtwork(page, phase = 'waxing') {
  const app = window.__game.app;
  app.ticker.stop();
  // Moon phase is selected once at module load. Import an unchanged copy with
  // a controlled first cosmetic sample, then reset the stream for the factory.
  const random = Math.random;
  Math.random = () => (['waning', 'quarter', 'waxing', 'full'].indexOf(phase) + 0.5) / 4;
  let backdrop;
  try {
    const moduleUrl = new URL('../../src/render/backdrop.js', import.meta.url);
    moduleUrl.searchParams.set('artwork-phase', phase);
    backdrop = await import(/* @vite-ignore */ moduleUrl.href);
  } finally {
    Math.random = random;
  }
  if (!['christmas', 'halloween'].includes(occasion) && backdrop.moonPhase !== phase) throw new Error('Reference moon phase was not selected');
  window.__baselineClock.reset();
  const api = {
    children: (node) => node.children,
    container: () => new Container(),
    add: (parent, ...children) => parent.addChild(...children),
    position: (node, x, y) => node.position.set(x, y),
    scale: (node, x, y = x) => node.scale.set(x, y),
    label,
    background: () => new Graphics().rect(0, -400, 1280, 1520).fill(0x101c3d),
  };
  for (const module of [backdrop, saucers, animals, powerups, wolves, bombs, projectiles, effects, hud, menu, ui, shootingStars, tieFlyby]) {
    for (const [name, fn] of Object.entries(module))
      if (typeof fn === 'function' && (name.startsWith('create') || ['centerUi', 'dimmer'].includes(name))) api[name] = fn;
  }
  let fixture;
  window.__game.game.go(() => (fixture = buildArtwork(api, page, phase)));
  return { page, phase: backdrop.moonPhase, cells: fixture.cells };
}
