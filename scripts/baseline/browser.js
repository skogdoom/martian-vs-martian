// Development-only harness. Never imported by the application's entry.
import { STEP, ARENA } from '../../src/config.js';
import { setFixed169, layout } from '../../src/layout.js';
import { endStep, pollPads, isDown } from '../../src/input.js';
import { isMuted, toggleMute, stopVoices } from '../../src/audio.js';
import { startMatch } from '../../src/session.js';
import { recordRound } from '../../src/logic/match.js';
import { spawnDrop, spawnWolf, spawnGolden, spawnCrate } from '../../src/logic/world.js';
import { createAnimal } from '../../src/logic/animal.js';
import { createRocket, createBomb } from '../../src/logic/ordnance.js';
import { grantPower } from '../../src/logic/powerup.js';
import { createTitleScene } from '../../src/scenes/title.js';
import { createSettingsScene } from '../../src/scenes/settings.js';
import { createPlayScene } from '../../src/scenes/play.js';
import { createTallyScene } from '../../src/scenes/tally.js';

const runtime = window.__game;
runtime.app.ticker.stop();
if (!isMuted()) toggleMute();
// Dismiss through the actual overlay handler; screenshots do not validate unlock.
document.getElementById('start')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
endStep();

function key(code, type = 'keydown') {
  if ((type === 'keydown' && isDown(code)) || (type === 'keyup' && !isDown(code))) return;
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
}

export function advance(steps) {
  for (let i = 0; i < steps; i++) {
    pollPads();
    runtime.scene.update(STEP);
    endStep();
    // Preserve render-driven animation bookkeeping, including animal walk phases.
    runtime.scene.render();
  }
  runtime.app.render();
}

function stress(world) {
  for (let i = world.animals.length; i < 24; i++) world.animals.push(createAnimal(`stress-${i}`, i % 2 ? 'cow' : 'lamb', 250 + i * 28));
  world.animals.forEach((a, i) => Object.assign(a, { x: 230 + i * 34, onFire: true, golden: i % 3 === 0 }));
  grantPower(world.powers, 'red', 'laser');
  grantPower(world.powers, 'blue', 'laser');
  world.powers.red.timeLeft = world.powers.blue.timeLeft = null;
  Object.assign(world.saucers.red, { x: 400, y: 300, vx: 0, vy: 0 });
  Object.assign(world.saucers.blue, { x: 750, y: 300, vx: 0, vy: 0 });
  spawnWolf(world);
  spawnGolden(world, 'red');
  spawnCrate(world, 'red');
  spawnDrop(world, 'speed', true);
  key('Space');
  key('Enter');
}

export function prepare(kind, options = {}) {
  window.dispatchEvent(new Event('blur'));
  endStep();
  stopVoices();
  window.__baselineClock.reset();
  Object.assign(runtime.session, { players: 2, difficulty: 'normal', length: 90, rounds: 3, ...options });
  runtime.session.ratio169 = Boolean(options.ratio169);
  setFixed169(runtime.session.ratio169);
  startMatch(runtime.session);
  if (kind === 'title') runtime.game.go(createTitleScene, runtime.session);
  else if (kind === 'settings') runtime.game.go(createSettingsScene, runtime.session);
  else {
    if (kind === 'sudden-death') for (let i = 0; i < runtime.session.rounds; i++) recordRound(runtime.session.match, 'tie');
    runtime.game.go(createPlayScene, runtime.session);
    if (kind !== 'countdown') advance(180);
    if (options.power) {
      const world = runtime.scene.round.world;
      if (['cowRain', 'lambRain'].includes(options.power)) {
        spawnDrop(world, options.power, true);
        const drop = world.drops.at(-1);
        Object.assign(drop, { state: 'field', y: ARENA.groundY, vx: 0 });
        Object.assign(world.saucers.red, { x: drop.x, y: ARENA.flightBottom - 10 });
        advance(65); // Actual package collection produces bursts and falling animals.
      } else {
        grantPower(world.powers, 'red', options.power);
        Object.assign(world.saucers.red, { x: 400, y: 300 });
        Object.assign(world.saucers.blue, { x: 750, y: 300 });
        key('Space');
      }
    }
    if (kind === 'stress') stress(runtime.scene.round.world);
    if (kind === 'pause') {
      advance(120);
      key('KeyP');
      advance(1);
      key('KeyP', 'keyup');
    }
    if (kind === 'result' || kind === 'tally') {
      // Finish through the actual play scene's scoring/adoption path.
      const { round } = runtime.scene;
      Object.assign(round.world.animals[0], { state: 'penned', pen: 'red', owner: 'red', x: 90, vx: 0 });
      round.timeLeft = STEP;
      advance(1);
      if (kind === 'tally') runtime.game.go(createTallyScene, runtime.session);
    }
  }
  const steps = options.steps ?? (kind === 'pause' ? 0 : kind === 'result' || kind === 'tally' ? 90 : 60);
  advance(steps);
  return inspect();
}

function objects(root) {
  return 1 + (root.children?.reduce((n, child) => n + objects(child), 0) ?? 0);
}

export function inspect() {
  const { app, session, scene } = runtime;
  const gl = app.renderer.gl;
  const debug = gl?.getExtension('WEBGL_debug_renderer_info');
  return {
    epoch: window.__baselineClock.epoch,
    cosmeticSeed: window.__baselineClock.cosmeticSeed,
    moonPhase: runtime.moonPhase,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    canvas: { width: app.canvas.width, height: app.canvas.height },
    resolution: app.renderer.resolution,
    renderer: app.renderer.constructor.name,
    gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
    extraSky: layout.extra,
    flightTop: ARENA.flightTop,
    objects: objects(scene.view),
    textures: app.renderer.texture?.managedTextures?.length ?? null,
    options: { players: session.players, difficulty: session.difficulty, length: session.length, rounds: session.rounds, ratio169: session.ratio169 },
    phase: scene.round?.phase ?? null,
    sound: 'muted; no trusted audio-unlock gesture',
  };
}

const distribution = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null;
  return { samples: sorted.length, p50: p(0.5), p95: p(0.95), p99: p(0.99), max: sorted.at(-1) ?? null };
};

export async function measure({ profile, warmupMs = 5000, durationMs = 60000 }) {
  prepare(profile === 'stress' ? 'stress' : 'play', { length: 120, steps: 0 });
  window.__baselineClock.live();
  const { app } = runtime;
  const scene = runtime.scene;
  const update = scene.update;
  const render = scene.render;
  const submit = app.renderer.render;
  const gl = app.renderer.gl;
  const draws = {};
  let calls = 0;
  for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    if (gl?.[method]) {
      draws[method] = gl[method];
      gl[method] = function (...args) {
        calls++;
        return draws[method].apply(this, args);
      };
    }
  }
  let step = 0;
  let work = { update: 0, view: 0, submit: 0 };
  const frames = [];
  const start = performance.now();
  scene.update = (dt) => {
    const at = performance.now();
    if (profile === 'stress') {
      const w = scene.round.world;
      Object.assign(w.saucers.red, { x: 400, y: 300, vx: 0, vy: 0 });
      Object.assign(w.saucers.blue, { x: 750, y: 300, vx: 0, vy: 0 });
      if (step % 90 === 0) {
        w.rockets.push(createRocket(w.saucers.red, w.saucers.blue));
        w.bombs.push(createBomb({ ...w.saucers.red, x: 1180 }));
      }
    } else {
      for (const [code, held] of [
        ['KeyD', step % 240 < 120],
        ['KeyA', step % 240 >= 120],
        ['ArrowLeft', step % 240 < 120],
        ['ArrowRight', step % 240 >= 120],
      ])
        key(code, held ? 'keydown' : 'keyup');
      if (step % 30 === 0) key('Space');
      else key('Space', 'keyup');
    }
    step++;
    update(dt);
    work.update += performance.now() - at;
  };
  scene.render = () => {
    const at = performance.now();
    render();
    work.view += performance.now() - at;
  };
  app.renderer.render = function (...args) {
    const at = performance.now();
    const result = submit.apply(this, args);
    work.submit += performance.now() - at;
    return result;
  };
  let previous = null;
  const result = await new Promise((resolve) => {
    app.ticker.start();
    function sample(now) {
      if (previous !== null && now - start >= warmupMs) frames.push({ interval: now - previous, ...work, calls });
      previous = now;
      work = { update: 0, view: 0, submit: 0 };
      calls = 0;
      if (now - start < warmupMs + durationMs) requestAnimationFrame(sample);
      else resolve(frames);
    }
    requestAnimationFrame(sample);
  });
  app.ticker.stop();
  scene.update = update;
  scene.render = render;
  app.renderer.render = submit;
  for (const [method, fn] of Object.entries(draws)) gl[method] = fn;
  window.dispatchEvent(new Event('blur'));
  endStep();
  if (runtime.scene !== scene) throw new Error('Measured scene changed unexpectedly');
  return {
    profile,
    warmupMs,
    durationMs,
    fixedStepsIncludingWarmup: step,
    metadata: inspect(),
    frameIntervalMs: distribution(result.map((f) => f.interval)),
    updateCpuMs: distribution(result.map((f) => f.update)),
    viewCpuMs: distribution(result.map((f) => f.view)),
    renderSubmissionCpuMs: distribution(result.map((f) => f.submit)),
    totalCpuMs: distribution(result.map((f) => f.update + f.view + f.submit)),
    drawCalls: distribution(result.map((f) => f.calls)),
    framesOver33ms: result.filter((f) => f.interval > 33.34).length,
    meanFps: (result.length * 1000) / result.reduce((sum, f) => sum + f.interval, 0),
    jsHeapBytes: performance.memory?.usedJSHeapSize ?? null,
    gpuMemoryBytes: null,
    caveats: [
      'CPU includes harness input/stress setup and instrumentation overhead.',
      'Submission timing excludes asynchronous GPU execution.',
      'rAF intervals describe this headless runner, not a physical display.',
      'GPU memory and internal particle counts are not exposed by the application.',
    ],
  };
}
