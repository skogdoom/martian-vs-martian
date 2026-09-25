// Boot, scaling, fixed-step loop and scene manager.

import { Application, Container, Graphics } from 'pixi.js';
import { WIDTH, HEIGHT, STEP } from './config.js';
import { endStep } from './input.js';
import { createPlayScene } from './scenes/play.js';

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

// Scene manager. A scene is { view, update(dt), render(), destroy() }.
let scene = null;
const game = {
  go(factory, ...args) {
    if (scene) {
      root.removeChild(scene.view);
      scene.destroy?.();
    }
    scene = factory(game, ...args);
    root.addChild(scene.view);
  },
};

game.go(createPlayScene);

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
window.__game = { app, game, get scene() { return scene; } };
