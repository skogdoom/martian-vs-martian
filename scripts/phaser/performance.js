// Measurement-only helper; never imported by the game's entry.
const runtime = window.__game;
const phaser = runtime.engine === 'phaser';
const held = new Set();
const key = (code, down) => {
  if (held.has(code) === down) return;
  if (down) held.add(code);
  else held.delete(code);
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }));
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const distribution = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null;
  return { samples: sorted.length, p50: p(0.5), p95: p(0.95), p99: p(0.99), max: sorted.at(-1) ?? null };
};
const count = (node) => 1 + (node.list ?? node.children ?? []).reduce((sum, child) => sum + count(child), 0);

export function inspect() {
  const { app, scene } = runtime;
  const gl = app.renderer.gl;
  const debug = gl?.getExtension('WEBGL_debug_renderer_info');
  const textures = phaser ? app.textures.getTextureKeys().length : app.renderer.texture?.managedTextures?.length;
  return {
    engine: phaser ? 'phaser' : 'pixi',
    sound: window.AudioContext ? 'page service available' : 'audio disabled for graphics benchmark',
    viewport: [innerWidth, innerHeight],
    dpr: devicePixelRatio,
    backing: [app.canvas.width, app.canvas.height],
    gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    objects: count(scene.view),
    textures,
    effects: scene.diagnostics?.effects ?? null,
    textureWrappers: app.renderer.glTextureWrappers?.length ?? null,
    world: scene.round
      ? {
          phase: scene.round.phase,
          timeLeft: scene.round.timeLeft,
          animals: scene.round.world.animals.length,
          projectiles: scene.round.world.projectiles.length,
          rockets: scene.round.world.rockets.length,
          bombs: scene.round.world.bombs.length,
          beams: Object.values(scene.round.world.hooks).filter((h) => h.target || h.carrying).length,
        }
      : null,
    paint: runtime.game.presentation?.metrics ?? null,
    jsHeapBytes: performance.memory?.usedJSHeapSize ?? null,
  };
}

export async function measure({ profile = 'ordinary', durationMs = 60000, warmupMs = 5000, fixtureBase = location.href }) {
  if (!runtime.scene.round) throw Error('Start a real match before measuring');
  const { app, scene } = runtime;
  const round = scene.round;
  round.length = 120;
  round.timeLeft = 120;
  const world = round.world;
  const source = new URL('src/logic/', fixtureBase);
  const [{ spawnDrop, spawnWolf, spawnGolden, spawnCrate }, { createAnimal }, { createRocket, createBomb }, { grantPower }] = await Promise.all([
    import(new URL('world.js', source)),
    import(new URL('animal.js', source)),
    import(new URL('ordnance.js', source)),
    import(new URL('powerup.js', source)),
  ]);
  if (profile === 'crowded' || profile === 'stress') {
    for (let i = world.animals.length; i < 24; i++) world.animals.push(createAnimal(`stress-${i}`, i % 2 ? 'cow' : 'lamb', 250 + i * 28));
    world.animals.forEach((a, i) => Object.assign(a, { x: 230 + i * 34, onFire: profile === 'stress', golden: profile === 'stress' && i % 3 === 0 }));
  }
  if (profile === 'crowded')
    world.animals.forEach((a, i) =>
      Object.assign(a, { state: 'penned', pen: i % 2 ? 'red' : 'blue', owner: i % 2 ? 'red' : 'blue', x: i % 2 ? 30 + i * 5 : 1120 + i * 5, y: 660 }),
    );
  if (profile === 'stress') {
    grantPower(world.powers, 'red', 'laser');
    grantPower(world.powers, 'blue', 'laser');
    world.powers.red.timeLeft = world.powers.blue.timeLeft = null;
    spawnWolf(world);
    spawnGolden(world, 'red');
    spawnCrate(world, 'red');
    spawnDrop(world, 'speed', true);
  }
  if (profile === 'animal-rain') {
    spawnDrop(world, 'cowRain', true);
    const drop = world.drops.at(-1);
    Object.assign(drop, { state: 'field', y: 660, vx: 0 });
    Object.assign(world.saucers.red, { x: drop.x, y: 470, vx: 0, vy: 0 });
  }
  const liftAnimals = profile === 'abduction' ? [world.animals[0], world.animals[1]] : null;
  let step = 0,
    calls = 0,
    uploads = 0,
    readbacks = 0;
  let work = { update: 0, view: 0, frame: 0, submission: 0 };
  const frames = [],
    restorers = [];
  function wrap(object, method, category) {
    const original = object[method];
    object[method] = function (...args) {
      const start = performance.now();
      try {
        return original.apply(this, args);
      } finally {
        work[category] += performance.now() - start;
      }
    };
    restorers.push(() => (object[method] = original));
  }
  const update = scene.update;
  scene.update = function (dt) {
    const start = performance.now();
    if (profile === 'stress') {
      Object.assign(world.saucers.red, { x: 400, y: 300, vx: 0, vy: 0 });
      Object.assign(world.saucers.blue, { x: 750, y: 300, vx: 0, vy: 0 });
      key('Space', true);
      key('Enter', true);
      if (step % 90 === 0) {
        world.rockets.push(createRocket(world.saucers.red, world.saucers.blue));
        world.bombs.push(createBomb({ ...world.saucers.red, x: 1180 }));
      }
    } else if (profile === 'abduction') {
      for (const [i, side] of ['red', 'blue'].entries()) {
        const a = liftAnimals[i],
          h = world.hooks[side];
        const x = i ? 880 : 400;
        if ((!h.target && !h.carrying) || (h.carrying && step % 120 === 0)) {
          Object.assign(h, { target: null, carrying: null, second: null, progress: 0 });
          Object.assign(a, { state: 'field', pen: null, hookedBy: null, x, y: 660, vx: 0 });
        }
        Object.assign(world.saucers[side], { x, y: 470 + Math.sin(step / 45) * 30, vx: 0, vy: 0 });
      }
    } else if (profile !== 'animal-rain') {
      for (const [code, down] of [
        ['KeyD', step % 240 < 120],
        ['KeyA', step % 240 >= 120],
        ['ArrowLeft', step % 240 < 120],
        ['ArrowRight', step % 240 >= 120],
        ['Space', step % 30 === 0],
      ])
        key(code, down);
    }
    step++;
    update(dt);
    work.update += performance.now() - start;
  };
  restorers.push(() => (scene.update = update));
  const getPixels = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (...args) {
    readbacks++;
    return getPixels.apply(this, args);
  };
  restorers.push(() => (CanvasRenderingContext2D.prototype.getImageData = getPixels));
  wrap(scene, 'render', 'view');
  wrap(app.renderer, 'render', 'submission');
  // Phaser binds Game.step during boot. Wrap TimeStep.callback, not app.step.
  wrap(phaser ? app.loop : app.ticker, phaser ? 'callback' : 'update', 'frame');
  const gl = app.renderer.gl;
  for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'texImage2D', 'texSubImage2D']) {
    if (!gl?.[method]) continue;
    const original = gl[method];
    gl[method] = function (...args) {
      if (method.startsWith('tex')) uploads++;
      else calls++;
      return original.apply(this, args);
    };
    restorers.push(() => (gl[method] = original));
  }
  const longTasks = [];
  const observer =
    typeof PerformanceObserver === 'function'
      ? new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((r) => ({ start: r.startTime, duration: r.duration }))))
      : null;
  if (observer && PerformanceObserver.supportedEntryTypes?.includes('longtask')) observer.observe({ type: 'longtask' });
  const start = performance.now();
  let previous = null;
  try {
    await new Promise((resolve) => {
      function sample(now) {
        if (previous !== null && now - start >= warmupMs) frames.push({ interval: now - previous, ...work, calls, uploads, readbacks });
        previous = now;
        work = { update: 0, view: 0, frame: 0, submission: 0 };
        calls = uploads = readbacks = 0;
        if (now - start < warmupMs + durationMs) requestAnimationFrame(sample);
        else resolve();
      }
      requestAnimationFrame(sample);
    });
  } finally {
    for (const restore of restorers.reverse()) restore();
    observer?.disconnect();
    window.dispatchEvent(new Event('blur'));
    held.clear();
  }
  if (runtime.scene !== scene) throw Error('Measured scene changed');
  if (!frames.length) throw Error('No measured frames');
  return {
    profile,
    durationMs,
    warmupMs,
    fixedStepsIncludingWarmup: step,
    metadata: inspect(),
    frameIntervalMs: distribution(frames.map((f) => f.interval)),
    updateCpuMs: distribution(frames.map((f) => f.update)),
    viewCpuMs: distribution(frames.map((f) => f.view)),
    renderSubmissionCpuMs: distribution(frames.map((f) => f.submission)),
    totalCpuMs: distribution(frames.map((f) => f.frame)),
    drawCalls: distribution(frames.map((f) => f.calls)),
    uploads: distribution(frames.map((f) => f.uploads)),
    pixelReadbacks: distribution(frames.map((f) => f.readbacks)),
    meanFps: (frames.length * 1000) / frames.reduce((sum, f) => sum + f.interval, 0),
    framesOver33ms: frames.filter((f) => f.interval > 33.34).length,
    longTasks: longTasks.filter((r) => r.start >= start + warmupMs),
    caveats: [
      'rAF intervals are browser callback intervals, not physical scanout measurements.',
      'CPU includes fixture/input and instrumentation; submission excludes asynchronous GPU work.',
      'GPU bytes are estimates where exposed; browser-native GPU memory is unavailable.',
    ],
  };
}

export async function start() {
  document.getElementById('start')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await pause(1000);
  runtime.session.length = 120;
  runtime.session.rounds = 3;
  key('Digit2', true);
  key('Digit2', false);
  key('KeyM', true);
  key('KeyM', false);
  window.__resetCosmetics?.();
  key('Enter', true);
  key('Enter', false);
  const deadline = performance.now() + 60000;
  while (runtime.scene.round?.phase !== 'play') {
    if (performance.now() > deadline) throw Error('Match did not reach play');
    if (!runtime.scene.round) {
      key('Enter', true);
      key('Enter', false);
    }
    await pause(250);
  }
}
