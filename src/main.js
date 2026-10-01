// Boot, scaling, fixed-step loop and scene manager.

import { Application, Container, Graphics } from 'pixi.js';
import { WIDTH, STEP, MUTE_KEY, FULLSCREEN_KEY, ARENA } from './config.js';
import { fitWindow, sceneShift, layout, setFixed169, onRefit } from './layout.js';
import { endStep, onKey, pollPads, padSeenYet } from './input.js';
import { toggleMute, isMuted, unlockAudio, audioUnlocked, stopVoices, resume as resumeAudio } from './audio.js';
import { toggleFullscreen } from './fullscreen.js';
import { label, DESTROY_ALL } from './render/text.js';
import { createTitleScene } from './scenes/title.js';
import { createSession } from './session.js';

const app = new Application();
await app.init({
  resizeTo: window,
  background: 0x000000,
  antialias: true,
  // Sharp on high-DPI screens, but no more than 2x: a 3x phone or a 4K screen at
  // 2x+ would multiply the pixels to fill for no visible gain.
  resolution: Math.min(window.devicePixelRatio || 1, 2),
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

/** Every scene sits at the bottom of the screen, so the ground is always at the
 * same height; the extra height above it is sky, which saucers may use. */
function alignScene() {
  layer.y = sceneShift();
  ARENA.flightTop = -layout.extra;
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
    if (old && !old.view.parent) old.view.destroy(DESTROY_ALL);
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
setFixed169(session.ratio169);
root.addChild(mutedLabel, padLabel, soundHint);
app.renderer.on('resize', fit);
onRefit(fit); // the 16:9 setting changed
fit();
game.go(createTitleScene, session);

// An error in one frame must not leave a frozen screen: log it, go back to
// the menu and say so. If errors keep coming, stop and ask for a reload.
const errorLabel = label('', { size: 16, color: 0xff9a8a, bold: true, anchorX: 0.5, anchorY: 0.5 });
errorLabel.visible = false;
root.addChild(errorLabel);
let errorLeft = 0;
const recentErrors = [];
function recover(err) {
  console.error(err);
  const now = performance.now();
  recentErrors.push(now);
  while (recentErrors[0] < now - 5000) recentErrors.shift();
  errorLabel.position.set(WIDTH / 2, visibleHeight / 2);
  errorLabel.visible = true;
  if (recentErrors.length > 3) {
    app.ticker.stop();
    errorLabel.text = 'Something keeps going wrong. Please reload the page.';
    app.render();
    return;
  }
  errorLabel.text = 'Something went wrong, so the game went back to the menu.';
  errorLabel.y = 24;
  errorLeft = 5;
  try {
    stopVoices();
    game.go(createTitleScene, session);
  } catch (again) {
    console.error(again);
  }
}

// The start overlay: the first key press or click dismisses it. That is also the
// gesture that unlocks the sound and gives the page focus, and the press is not
// passed on to the game (it would start a match from the title screen).
const startOverlay = document.getElementById('start');
let started = !startOverlay;
if (startOverlay) {
  // No hover and a coarse pointer: a phone or tablet.
  if (window.matchMedia?.('(hover: none) and (pointer: coarse)').matches) document.getElementById('touch-note').hidden = false;
  const begin = () => {
    if (started) return;
    started = true;
    startOverlay.remove();
    window.focus();
    endStep(); // the key that got us here is not a game key press
  };
  startOverlay.addEventListener('pointerdown', begin);
  onKey(begin);
}

// Fixed-step loop.
const MAX_FRAME = 0.25;
let acc = 0;
app.ticker.add((ticker) => {
  const dt = Math.min(ticker.deltaMS / 1000, MAX_FRAME);
  try {
    acc += dt;
    while (acc >= STEP) {
      pollPads();
      if (started) scene.update(STEP);
      endStep();
      acc -= STEP;
    }
    padNoticeLeft = Math.max(0, padNoticeLeft - dt);
    padLabel.visible = padNoticeLeft > 0;
    mutedLabel.visible = isMuted(); // also changes from the pause menu
    soundHint.visible = padSeenYet() && !audioUnlocked() && !isMuted();
    scene.render();
  } catch (err) {
    acc = 0;
    endStep();
    recover(err);
  }
  errorLeft = Math.max(0, errorLeft - dt);
  if (errorLeft === 0 && app.ticker.started) errorLabel.visible = false;
});

// Handy for debugging in the console.
window.__game = {
  app,
  game,
  session,
  get scene() {
    return scene;
  },
};
