// Boot, scaling, fixed-step loop and scene manager.

import { Application, Container, Graphics } from 'pixi.js';
import { WIDTH, STEP, MUTE_KEY, FULLSCREEN_KEY, ARENA } from './config.js';
import { fitWindow, sceneShift, layout } from './layout.js';
import { endStep, onKey, pollPads, padSeenYet } from './input.js';
import { toggleMute, isMuted, unlockAudio, audioUnlocked, resume as resumeAudio } from './audio.js';
import { toggleFullscreen } from './fullscreen.js';
import { label } from './render/text.js';
import { createTitleScene } from './scenes/title.js';
import { createSession } from './session.js';

const app = new Application();
await app.init({
  resizeTo: window,
  background: 0x000000,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});
document.body.appendChild(app.canvas);

// Everything is drawn into `root`, 1280 logical px wide and as tall as the
// window allows (see layout.js). The scene sits in `layer` inside it.
const root = new Container();
const rootMask = new Graphics();
root.addChild(rootMask);
root.mask = rootMask;
const layer = new Container();
root.addChild(layer);
app.stage.addChild(root);

let visibleHeight = 720;
function fit() {
  const f = fitWindow(app.screen.width, app.screen.height);
  visibleHeight = f.visible;
  root.scale.set(f.scale);
  root.position.set(f.x, f.y);
  rootMask.clear().rect(0, 0, WIDTH, f.visible).fill(0xffffff);
  alignScene();
  // The notices along the bottom edge.
  mutedLabel.position.set(WIDTH / 2, visibleHeight - 10);
  soundHint.position.set(WIDTH / 2, visibleHeight - 10);
  padLabel.position.set(WIDTH / 2, visibleHeight - 32);
}

// Scene manager. A scene is { view, update(dt), render(), destroy?() }.
// A new scene may adopt the previous scene's view (e.g. as a backdrop);
// otherwise the old view is destroyed.
let scene = null;

/** Put the scene in the middle of the screen (menus) or at the bottom (the arena),
 * and let the arena's saucers use the extra sky above it. */
function alignScene() {
  const bottom = scene?.align === 'bottom';
  layer.y = sceneShift(scene?.align);
  ARENA.flightTop = bottom ? -layout.extra : 0;
}

const game = {
  go(factory, ...args) {
    const old = scene;
    if (old) {
      layer.removeChild(old.view);
      old.destroy?.();
    }
    scene = factory(game, ...args);
    layer.addChild(scene.view);
    alignScene();
    if (old && !old.view.parent) old.view.destroy({ children: true });
  },
};

// Sound toggle, with a small reminder while muted. It sits above every scene.
const mutedLabel = label('SOUND OFF  (M)', { size: 13, color: 0xcfd6ff, anchorX: 0.5, anchorY: 1 });
mutedLabel.position.set(WIDTH / 2, 710);
mutedLabel.visible = false;
// Audio needs a user gesture to start, and may need one again after the
// browser suspends it, so every key press and click tries to wake it up.
onKey(unlockAudio);
window.addEventListener('pointerdown', unlockAudio);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resumeAudio();
});

onKey((code) => {
  if (code === MUTE_KEY) toggleMute();
  // Must run inside the key event: browsers only allow full screen from a user gesture.
  if (code === FULLSCREEN_KEY) toggleFullscreen();
});
app.canvas.addEventListener('dblclick', toggleFullscreen);

// Browsers only start sound from a key press or a click, not from a controller
// button. Until it runs, say so (once a controller has been used).
const soundHint = label('NO SOUND YET: PRESS ANY KEY OR CLICK THE PAGE ONCE', { size: 13, color: 0xffd76a, anchorX: 0.5, anchorY: 1 });
soundHint.position.set(WIDTH / 2, 710);
soundHint.visible = false;

// Controllers coming and going.
const padLabel = label('', { size: 14, color: 0x6cff6c, anchorX: 0.5, anchorY: 1 });
padLabel.position.set(WIDTH / 2, 688);
let padNoticeLeft = 0;
function padNotice(text) {
  padLabel.text = text;
  padNoticeLeft = 3;
}
window.addEventListener('gamepadconnected', (e) => padNotice(`CONTROLLER CONNECTED: ${String(e.gamepad.id).slice(0, 40)}`));
window.addEventListener('gamepaddisconnected', () => padNotice('CONTROLLER DISCONNECTED'));

// Lives for the page: reloading resets the tally.
const session = createSession();
root.addChild(mutedLabel, padLabel, soundHint);
app.renderer.on('resize', fit);
fit();
game.go(createTitleScene, session);

// Fixed-step loop.
const MAX_FRAME = 0.25;
let acc = 0;
app.ticker.add((ticker) => {
  acc += Math.min(ticker.deltaMS / 1000, MAX_FRAME);
  while (acc >= STEP) {
    pollPads();
    scene.update(STEP);
    endStep();
    acc -= STEP;
  }
  padNoticeLeft = Math.max(0, padNoticeLeft - Math.min(ticker.deltaMS / 1000, MAX_FRAME));
  padLabel.visible = padNoticeLeft > 0;
  mutedLabel.visible = isMuted(); // also changes from the pause menu
  soundHint.visible = padSeenYet() && !audioUnlocked() && !isMuted();
  scene.render();
});

// Handy for debugging in the console.
window.__game = { app, game, session, get scene() { return scene; } };
