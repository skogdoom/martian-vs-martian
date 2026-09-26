// Boot, scaling, fixed-step loop and scene manager.

import { Application, Container, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT, STEP, MUTE_KEY } from './config.js';
import { endStep, onKey } from './input.js';
import { toggleMute } from './audio.js';
import { label } from './render/text.js';
import { createTitleScene } from './scenes/title.js';
import { createTally } from './logic/tally.js';

const app = new Application();
await app.init({
  resizeTo: window,
  background: 0x000000,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});
document.body.appendChild(app.canvas);

// Everything is drawn into `root` at the 1280x720 logical resolution.
const root = new Container();
const rootMask = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(0xffffff);
root.addChild(rootMask);
root.mask = rootMask;
app.stage.addChild(root);

function fit() {
  const w = app.screen.width;
  const h = app.screen.height;
  const scale = Math.min(w / WIDTH, h / HEIGHT);
  root.scale.set(scale);
  root.position.set(Math.round((w - WIDTH * scale) / 2), Math.round((h - HEIGHT * scale) / 2));
}
app.renderer.on('resize', fit);
fit();

// Scene manager. A scene is { view, update(dt), render(), destroy?() }.
// A new scene may adopt the previous scene's view (e.g. as a backdrop);
// otherwise the old view is destroyed.
let scene = null;
const game = {
  go(factory, ...args) {
    const old = scene;
    if (old) {
      root.removeChild(old.view);
      old.destroy?.();
    }
    scene = factory(game, ...args);
    root.addChildAt(scene.view, 1); // above the mask, below the mute label
    if (old && !old.view.parent) old.view.destroy({ children: true });
  },
};

// Sound toggle, with a small reminder while muted. It sits above every scene.
const mutedLabel = label('SOUND OFF  (M)', { size: 13, color: 0xcfd6ff, anchorX: 0.5, anchorY: 1 });
mutedLabel.position.set(WIDTH / 2, HEIGHT - 10);
mutedLabel.visible = false;
onKey((code) => {
  if (code === MUTE_KEY) mutedLabel.visible = toggleMute();
});

// Lives for the page: reloading resets the tally.
const session = { tally: createTally(), match: null };
root.addChild(mutedLabel);
game.go(createTitleScene, session);

// Fixed-step loop.
const MAX_FRAME = 0.25;
let acc = 0;
app.ticker.add((ticker) => {
  acc += Math.min(ticker.deltaMS / 1000, MAX_FRAME);
  while (acc >= STEP) {
    scene.update(STEP);
    endStep();
    acc -= STEP;
  }
  scene.render();
});

// Handy for debugging in the console.
window.__game = { app, game, session, get scene() { return scene; } };
