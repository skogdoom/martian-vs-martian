// Prepare static recipes before active play, using the real artwork factories.
// A separate cosmetic RNG leaves actual sprite phases and logic RNG untouched.
import { createArt } from './art.js';
import { createWolfSprite } from './render/wolfView.js';
import { createGreenManView, createPackageView, createCrateView, drawRocket, drawBomb, POWER_NAMES } from './render/powerupView.js';
import { createTimeBombSprite } from './render/timeBombView.js';

export function warmGameplayArt(presentation, parent) {
  const scope = presentation.scope();
  scope.root.name = 'prewarmed-art';
  scope.root.visible = false;
  scope.attach(parent, scope.root);
  const art = createArt(scope, { random: () => 0.5 });
  createWolfSprite(art);
  createPackageView(art);
  createCrateView(art);
  createTimeBombSprite(art);
  for (const power of Object.keys(POWER_NAMES)) {
    const sprite = createGreenManView(art);
    sprite.sync({ state: 'field', power, x: 0, y: 660, vx: 0 }, 0);
  }
  drawRocket(art, art.graphics(), 26, 0.8);
  drawBomb(art, art.graphics(), 9);
  // The hidden root owns its textures until the play/result tree is destroyed.
  // Actual arriving sprites share these immutable recipes, including on WebGL
  // restoration. No phantom objects enter the simulation or update list.
  return scope.root;
}
