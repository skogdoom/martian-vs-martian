import Phaser from 'phaser';
import { WIDTH, ARENA, MUTE_KEY, FULLSCREEN_KEY } from '../config.js';
import { fitWindow, sceneShift, layout, onRefit, setFixed169 } from '../layout.js';
import { onKey, pollPads, endStep, padSeenYet } from '../input.js';
import { unlockAudio, resume, toggleMute, isMuted, audioUnlocked, stopVoices } from '../audio.js';
import { toggleFullscreen } from '../fullscreen.js';
import { createSession } from '../session.js';
import { createFixedLoop, createFrameClock } from './clock.js';
import { createPreview } from './preview.js';
import { createPresentation } from './presentation.js';
import { createGallery } from './gallery.js';
import { stabilizeTextureSampling } from './textureSampling.js';

class Host extends Phaser.Scene {
  constructor() {
    super('host');
  }

  create() {
    stabilizeTextureSampling(this.game.renderer);
    this.root = this.add.container();
    this.layer = this.add.container();
    this.root.add(this.layer);
    this.logical = null;
    this.presentation = createPresentation(this);
    this.session = createSession();
    this.disposers = [];
    this.recentErrors = [];
    this.errorLeft = 0;
    this.padLeft = 0;
    this.halted = false;
    this.disposed = false;
    this.started = !document.getElementById('start');
    setFixed169(this.session.ratio169);
    this.muted = this.text('SOUND OFF  (M)', 13, '#cfd6ff').setOrigin(0.5, 1);
    this.soundHint = this.text('NO SOUND YET: PRESS ANY KEY OR CLICK THE PAGE ONCE', 13, '#ffd76a').setOrigin(0.5, 1);
    this.padLabel = this.text('', 14, '#6cff6c').setOrigin(0.5, 1);
    this.errorLabel = this.text('', 16, '#ff9a8a').setOrigin(0.5).setVisible(false);
    this.root.add([this.muted, this.soundHint, this.padLabel, this.errorLabel]);
    this.frames = createFrameClock(performance.now());
    this.loop = createFixedLoop({
      poll: pollPads,
      update: (dt) => {
        if (this.started) this.logical?.update(dt);
      },
      clear: endStep,
      render: () => this.logical?.render(),
    });
    this.disposers.push(
      onRefit(() => this.fit()),
      onKey(unlockAudio),
    );
    this.listen(window, 'pointerdown', unlockAudio);
    this.listen(document, 'visibilitychange', () => {
      if (!document.hidden) resume();
    });
    this.disposers.push(
      onKey((code, { swallowed }) => {
        if (swallowed) return;
        if (code === MUTE_KEY) toggleMute();
        if (code === FULLSCREEN_KEY) toggleFullscreen();
      }),
    );
    this.listen(this.game.canvas, 'dblclick', toggleFullscreen);
    this.listen(window, 'resize', () => this.fit());
    this.listen(window, 'gamepadconnected', (e) => this.padNotice(`CONTROLLER CONNECTED: ${String(e.gamepad.id).slice(0, 40)}`));
    this.listen(window, 'gamepaddisconnected', () => this.padNotice('CONTROLLER DISCONNECTED'));
    const start = document.getElementById('start');
    if (start) {
      if (window.matchMedia?.('(hover: none) and (pointer: coarse)').matches) document.getElementById('touch-note').hidden = false;
      const begin = () => {
        if (this.started) return;
        this.started = true;
        start.remove();
        window.focus();
        this.loop.reset();
        this.frames.reset(performance.now());
      };
      this.listen(start, 'pointerdown', begin);
      this.disposers.push(onKey(begin));
    }
    this.fit();
    const gallery = new URLSearchParams(window.location.search).get('gallery') === 'primitives';
    this.go(gallery ? createGallery : createPreview);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.dispose());
    window.__game = {
      engine: 'phaser',
      app: this.game,
      game: this,
      session: this.session,
      get scene() {
        return this.game.logical;
      },
    };
  }

  text(value, size, color) {
    return this.add.text(0, 0, value, { fontFamily: 'monospace', fontSize: `${size}px`, color, align: 'center', resolution: 2 });
  }

  listen(target, event, fn) {
    target.addEventListener(event, fn);
    this.disposers.push(() => target.removeEventListener(event, fn));
  }

  go(factory, ...args) {
    const old = this.logical;
    this.logical = null;
    if (old) {
      this.layer.remove(old.view);
      old.destroy?.();
    }
    try {
      this.logical = factory(this, ...args);
      this.layer.add(this.logical.view);
    } finally {
      if (old && !old.view.parentContainer) old.view.destroy();
    }
    this.layer.y = sceneShift();
  }

  fit() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const f = fitWindow(w, h);
    this.dpr = dpr;
    this.fitted = f;
    // Phaser 4 has no Pixi-style resolution option. Game size is backing pixels;
    // Scale.NONE zoom controls CSS size, while the camera maps logical units once.
    if (this.scale.zoom !== 1 / dpr) this.scale.setZoom(1 / dpr);
    const backingWidth = Math.round(w * dpr);
    const backingHeight = Math.round(h * dpr);
    if (this.game.canvas.width !== backingWidth || this.game.canvas.height !== backingHeight) this.scale.resize(backingWidth, backingHeight);
    this.game.canvas.style.width = `${w}px`;
    this.game.canvas.style.height = `${h}px`;
    this.cameras.main.setViewport(f.x * dpr, f.y * dpr, WIDTH * f.scale * dpr, f.visible * f.scale * dpr);
    this.cameras.main
      .setOrigin(0, 0)
      .setScroll(0, 0)
      .setZoom(f.scale * dpr);
    // The camera viewport clips both renderers, including scenery outside root.
    this.layer.y = sceneShift();
    ARENA.flightTop = -layout.extra;
    this.muted.setPosition(WIDTH / 2, f.visible - 10);
    this.soundHint.setPosition(WIDTH / 2, f.visible - 10);
    this.padLabel.setPosition(WIDTH / 2, f.visible - 32);
    this.errorLabel.setPosition(WIDTH / 2, this.halted ? f.visible / 2 : 24);
  }

  padNotice(value) {
    this.padLabel.setText(value);
    this.padLeft = 3;
  }

  update(time) {
    if (this.halted) return;
    // Deliberately ignore Phaser's reset/smoothed delta after visibility/focus.
    const deltaMS = this.frames.delta(time);
    try {
      if (this.dpr !== Math.min(window.devicePixelRatio || 1, 2)) this.fit();
      const { dt } = this.loop.advance(deltaMS);
      this.padLeft = Math.max(0, this.padLeft - dt);
      this.errorLeft = Math.max(0, this.errorLeft - dt);
      this.padLabel.setVisible(this.padLeft > 0);
      this.muted.setVisible(isMuted());
      this.soundHint.setVisible(padSeenYet() && !audioUnlocked() && !isMuted());
      if (this.errorLeft === 0) this.errorLabel.setVisible(false);
    } catch (err) {
      this.loop.reset();
      this.recover(err);
    }
  }

  recover(err) {
    console.error(err);
    stopVoices();
    const now = performance.now();
    this.recentErrors = this.recentErrors.filter((at) => at >= now - 5000);
    this.recentErrors.push(now);
    this.errorLabel.setVisible(true);
    if (this.recentErrors.length > 3) {
      this.halted = true;
      this.errorLabel.setPosition(WIDTH / 2, this.fitted.visible / 2).setText('Something keeps going wrong. Please reload the page.');
      // Current frame renders the notice; subsequent animation frames stop.
      this.game.loop.sleep();
      return;
    }
    this.errorLeft = 5;
    this.errorLabel.setPosition(WIDTH / 2, 24).setText('Something went wrong, so the game went back to the menu.');
    try {
      this.go(createPreview);
      this.logical.render();
    } catch (again) {
      this.recover(again);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const fn of this.disposers.splice(0)) fn();
    this.logical?.destroy?.();
    this.logical = null;
    // Cleanup may be called before or after Phaser's display-list shutdown.
    this.root.destroy();
    this.presentation.dispose();
    this.loop.reset();
    stopVoices();
    if (window.__game?.game === this) delete window.__game;
  }
}

const canvasFallback = new URLSearchParams(window.location.search).get('renderer') === 'canvas';
const app = new Phaser.Game({
  type: canvasFallback ? Phaser.CANVAS : Phaser.AUTO,
  backgroundColor: '#000000',
  banner: false,
  autoFocus: false,
  width: window.innerWidth,
  height: window.innerHeight,
  scale: { mode: Phaser.Scale.NONE, autoRound: false },
  render: { antialias: true, antialiasGL: true, roundPixels: false },
  fps: { smoothStep: false },
  input: { keyboard: false, gamepad: false, mouse: false, touch: false },
  audio: { noAudio: true },
  scene: Host,
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app.destroy(true);
    // Destruction is deferred to a frame; a halted loop needs waking to dispose.
    app.loop.wake();
  });
  // Reload clears Phaser's page-level visibility handlers as well as our modules.
  import.meta.hot.accept(() => window.location.reload());
}
