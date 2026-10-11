// Milestone 3 render-only review preview; game scene flow follows in milestone 4.
import { WIDTH, HEIGHT } from '../config.js';
import { layout, setFixed169 } from '../layout.js';
import { createRng } from '../logic/rng.js';
import { wasPressed } from '../input.js';
import { createArt } from './art.js';
import { buildArtwork, ARTWORK_PAGES } from './artwork-fixtures.js';
import * as backdrop from './render/backdrop.js';
import * as saucers from './render/saucerView.js';
import * as animals from './render/animalView.js';
import * as powerups from './render/powerupView.js';
import * as wolves from './render/wolfView.js';
import * as bombs from './render/timeBombView.js';
import * as projectiles from './render/projectileView.js';
import * as effects from './render/effects.js';
import * as hud from './render/hud.js';
import * as menu from './render/menu.js';
import * as ui from './render/uiLayer.js';
import * as shootingStars from './render/shootingStars.js';
import * as tieFlyby from './render/tieFlyby.js';

export function createArtwork(host, page, phase, cosmeticSeed, audit = false) {
  const query = new URLSearchParams(location.search);
  page ??= query.get('art') ?? 'arena';
  phase ??= query.get('moon') ?? backdrop.moonPhase;
  const scope = host.presentation.scope();
  const art = createArt(scope, cosmeticSeed === undefined ? { audit } : { random: createRng(cosmeticSeed), audit });
  try {
    const api = {
      ...art,
      children: (node) => node.list,
      position: (node, x, y) => node.setPosition(x, y),
      scale: (node, x, y = x) => node.setScale(x, y),
      background: () => art.graphics((draw) => draw.rect(0, -400, WIDTH, HEIGHT + 800, { fill: 0x101c3d })),
    };
    for (const module of [backdrop, saucers, animals, powerups, wolves, bombs, projectiles, effects, hud, menu, ui, shootingStars, tieFlyby]) {
      for (const [name, fn] of Object.entries(module))
        if (typeof fn === 'function' && (name.startsWith('create') || ['centerUi', 'dimmer'].includes(name)))
          api[name] = (...args) => fn(art, ...args);
    }
    const fixture = buildArtwork(api, page, phase);
    art.add(scope.root, fixture.view);
    const help = art.label('← / → artwork page   P: freeze   R: restart   V: 16:9   seasonal: ?date=12-24', {
      size: 12,
      color: 0xcfd6ff,
      anchorX: 0.5,
      anchorY: 1,
    });
    help.setPosition(640, 710);
    art.add(scope.root, help);
    let paused = false;
    return {
      ...fixture,
      view: scope.root,
      fixture,
      get elapsed() {
        return fixture.elapsed;
      },
      art,
      update(dt) {
        if (wasPressed('KeyV')) {
          host.session.ratio169 = !layout.fixed169;
          setFixed169(host.session.ratio169);
        }
        if (wasPressed('KeyP')) paused = !paused;
        const direction = (wasPressed('ArrowRight') ? 1 : 0) - (wasPressed('ArrowLeft') ? 1 : 0);
        if (direction) {
          host.go(createArtwork, ARTWORK_PAGES[(ARTWORK_PAGES.indexOf(page) + direction + ARTWORK_PAGES.length) % ARTWORK_PAGES.length], phase);
          return;
        }
        if (wasPressed('KeyR')) {
          host.go(createArtwork, page, phase);
          return;
        }
        if (!paused) fixture.update(dt);
      },
      render() {
        if (!paused) fixture.render();
        help.y = 710;
        help.visible = !this.testing;
      },
      destroy() {
        scope.dispose();
      },
    };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
