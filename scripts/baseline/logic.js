// Frozen migration references, generated only by an explicit --write.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { STEP, ARENA, BOT, POWERUP } from '../../src/config.js';
import { createWorld, stepWorld, spawnDrop, spawnWolf, spawnGolden, spawnCrate } from '../../src/logic/world.js';
import { createRound, stepRound } from '../../src/logic/round.js';
import { createBot } from '../../src/logic/bot.js';
import { createRng } from '../../src/logic/rng.js';
import { scores } from '../../src/logic/scoring.js';
import { createSession, startMatch } from '../../src/session.js';
import { recordRound, addRoundStats } from '../../src/logic/match.js';
import { addRoundToTally, addMatchToTally } from '../../src/logic/tally.js';

export const fixturePath = new URL('../../baselines/pixi/logic.json', import.meta.url);
const LOW = ARENA.flightBottom - 10;

// References use collection/index, not entity.id: drops and crates reuse IDs.
// Defining entries are expanded; hook targets/carrying become explicit references.
export function snapshot(world, round = null) {
  const refs = new Map();
  for (const [key, value] of Object.entries(world)) {
    if (Array.isArray(value) && key !== 'events') value.forEach((v, i) => v && typeof v === 'object' && refs.set(v, `${key}/${i}`));
  }
  for (const side of ['red', 'blue']) refs.set(world.saucers[side], `saucers/${side}`);
  function encode(value, expand = false) {
    if (typeof value === 'function') return { $function: 'seeded-rng' };
    if (typeof value === 'number' && !Number.isFinite(value)) {
      if (Number.isNaN(value)) throw new Error('NaN baseline state');
      return { $number: value > 0 ? 'Infinity' : '-Infinity' }; // sinceHit starts at Infinity.
    }
    if (!value || typeof value !== 'object') return value;
    if (!expand && refs.has(value)) return { $ref: refs.get(value) };
    if (Array.isArray(value)) return value.map((v) => encode(v));
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, encode(value[key])]),
    );
  }
  const state = {};
  for (const key of Object.keys(world).sort()) {
    const value = world[key];
    state[key] =
      Array.isArray(value) && key !== 'events'
        ? value.map((v) => encode(v, true))
        : key === 'saucers'
          ? Object.fromEntries(['red', 'blue'].map((side) => [side, encode(value[side], true)]))
          : encode(value);
  }
  return {
    world: state,
    scores: scores(world.animals),
    round: round ? encode(Object.fromEntries(Object.entries(round).filter(([key]) => key !== 'world'))) : null,
  };
}

function recorder(seed = 7, length = null) {
  const round = length === null ? null : createRound(seed, length);
  const world = round?.world ?? createWorld(seed);
  const digest = createHash('sha256');
  const result = { seed, length, step: STEP, actions: [], inputRuns: [], events: [], checkpoints: [], steps: 0 };
  function mark(label) {
    result.checkpoints.push({ step: result.steps, label, state: snapshot(world, round) });
  }
  function action(label, fn) {
    fn();
    result.actions.push({ step: result.steps, label });
    mark(label);
  }
  function advance(steps, input = {}) {
    for (let i = 0; i < steps; i++) {
      const values = typeof input === 'function' ? input(result.steps) : input;
      const encoded = JSON.stringify(values);
      const last = result.inputRuns.at(-1);
      if (last && JSON.stringify(last.input) === encoded) last.steps++;
      else result.inputRuns.push({ at: result.steps, steps: 1, input: JSON.parse(encoded) });
      if (round) stepRound(round, values, STEP);
      else stepWorld(world, values, STEP);
      result.steps++;
      const state = snapshot(world, round);
      digest.update(JSON.stringify({ step: result.steps, input: values, state }) + '\n');
      const events = round?.events ?? world.events;
      if (events.length) result.events.push({ step: result.steps, values: JSON.parse(JSON.stringify(events)) });
      if ([1, 60, 180, 600].includes(result.steps)) mark('fixed-step');
    }
  }
  function finish(required = []) {
    const seen = new Set(result.events.flatMap((frame) => frame.values.map((e) => e.type)));
    for (const type of required) if (!seen.has(type)) throw new Error(`Scenario never exercised ${type}`);
    mark('final');
    return { ...result, requiredEvents: required, stateTraceSha256: digest.digest('hex') };
  }
  mark('initial');
  return { world, round, action, advance, finish };
}

const hover = (s, x, y = LOW) => Object.assign(s, { x, y, vx: 0, vy: 0 });
const shoot = { red: { x: 0, y: 0, shoot: true } };
function pens(w, side = 'blue') {
  w.animals.forEach((a, i) =>
    Object.assign(a, {
      state: 'penned',
      pen: side,
      owner: side,
      x: side === 'blue' ? 1130 + (i % 4) * 30 : 30 + (i % 4) * 30,
      y: ARENA.groundY,
      vx: 0,
    }),
  );
}

export const scenarios = {
  'lift-deliver': () => {
    const r = recorder();
    r.action('hover over first cow', () => {
      hover(r.world.saucers.blue, 1000, 100);
      hover(r.world.saucers.red, r.world.animals.find((a) => a.kind === 'cow').x);
    });
    r.advance(180);
    r.action('fly carrying cow to red pen', () => hover(r.world.saucers.red, 90));
    r.advance(120);
    return r.finish(['hook', 'pickup', 'deliver', 'land']);
  },
  theft: () => {
    const r = recorder();
    r.action('first cow belongs to blue; red hovers over it', () => {
      Object.assign(
        r.world.animals.find((a) => a.kind === 'cow'),
        { state: 'penned', pen: 'blue', owner: 'blue', x: 1170, vx: 0 },
      );
      hover(r.world.saucers.blue, 600, 100);
      hover(r.world.saucers.red, 1170);
    });
    r.advance(180);
    r.action('fly stolen cow to red pen', () => hover(r.world.saucers.red, 90));
    r.advance(120);
    return r.finish(['pickup', 'deliver', 'land']);
  },
  'release-splat': () => {
    const r = recorder();
    r.action('hover over first cow', () => {
      hover(r.world.saucers.blue, 1000, 100);
      hover(r.world.saucers.red, r.world.animals.find((a) => a.kind === 'cow').x);
    });
    r.advance(180);
    r.action('carry cow high into field', () => hover(r.world.saucers.red, 640, 100));
    r.advance(1, shoot);
    r.advance(180);
    return r.finish(['pickup', 'release', 'splat']);
  },
  ram: () => {
    const r = recorder();
    r.action('red accelerates toward stationary blue', () => {
      hover(r.world.saucers.red, 60, 300);
      hover(r.world.saucers.blue, 1050, 300);
    });
    r.advance(240, { red: { x: 1, y: 0 } });
    return r.finish(['ram']);
  },
  daze: () => {
    const r = recorder();
    r.action('align targets', () => hover(r.world.saucers.red, 400, 300));
    for (let i = 0; i < 3; i++) {
      r.action('restore blue position before next shot', () => hover(r.world.saucers.blue, 700, 300));
      r.advance(1, shoot);
      r.advance(44);
    }
    return r.finish(['shot', 'hit', 'dazed']);
  },
  restock: () => {
    const r = recorder();
    r.action('all starting animals gone', () => r.world.animals.forEach((a) => (a.state = 'gone')));
    r.advance(600);
    return r.finish(['restock']);
  },
  'wolf-timebomb': () => {
    const r = recorder();
    r.action('blue pen populated; time bomb released above pen; wolf parachutes in', () => {
      pens(r.world);
      hover(r.world.saucers.blue, 640, 100);
      hover(r.world.saucers.red, 1180, 300);
      r.world.powers.red = { type: 'timeBomb', timeLeft: null };
      spawnWolf(r.world);
      Object.assign(r.world.wolves[0], { x: 1160, y: 500, state: 'falling', chute: true, droppedBy: 'red' });
    });
    r.advance(1, shoot);
    r.advance(900);
    return r.finish(['timeBombDrop', 'timeBombLand', 'bombBlast', 'wolfLand']);
  },
  'golden-crate': () => {
    const r = recorder();
    r.action('blue leads; golden animal descends', () => {
      pens(r.world);
      hover(r.world.saucers.red, 640, 100);
      hover(r.world.saucers.blue, 700, 100);
      spawnGolden(r.world, 'red');
    });
    r.advance(600);
    r.action('red lifts golden animal', () => hover(r.world.saucers.red, r.world.animals.at(-1).x));
    r.advance(180);
    r.action('deliver gold to red pen', () => hover(r.world.saucers.red, 90));
    r.advance(120);
    r.action('red has no ammunition; crate descends', () => {
      Object.assign(r.world.weapons.red, { ammo: 0, clip: 0 });
      hover(r.world.saucers.red, 640, 100);
      spawnCrate(r.world, 'red');
    });
    r.advance(600);
    r.action('red lifts crate', () => hover(r.world.saucers.red, r.world.drops.at(-1).x));
    r.advance(120);
    return r.finish(['pickup', 'land', 'ammoCrate']);
  },
};

for (const power of POWERUP.types) {
  scenarios[`power-${power}`] = () => {
    const r = recorder();
    r.action(`collect mystery package containing ${power}`, () => {
      pens(r.world);
      hover(r.world.saucers.blue, 1000, 100);
      spawnDrop(r.world, power, true);
      const drop = r.world.drops[0];
      Object.assign(drop, { state: 'field', y: ARENA.groundY, vx: 0 });
      hover(r.world.saucers.red, drop.x);
    });
    r.advance(120);
    if (['twin', 'steal', 'parachute'].includes(power)) {
      r.action('lift animals from blue pen with collected power', () => hover(r.world.saucers.red, 1130));
      r.advance(240);
      r.action('carry to red pen, or release high under parachute', () =>
        hover(r.world.saucers.red, power === 'parachute' ? 640 : 90, power === 'parachute' ? 100 : LOW),
      );
      r.advance(power === 'parachute' ? 1 : 120, power === 'parachute' ? shoot : {});
      r.advance(600);
      return r.finish(['powerup', 'pickup', power === 'parachute' ? 'chuteOpen' : 'deliver', 'land']);
    }
    r.action('exercise power against blue', () => {
      hover(r.world.saucers.red, power === 'bomb' || power === 'timeBomb' ? 1180 : 400, 300);
      hover(r.world.saucers.blue, 700, 300);
    });
    r.advance(240, (i) => ({ red: { x: power === 'speed' ? 1 : 0, y: 0, shoot: i % 12 === 0, fire: true } }));
    return r.finish([POWERUP.instant.includes(power) ? 'animalRain' : 'powerup']);
  };
}

for (const length of [60, 90, 120]) {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    scenarios[`bots-${difficulty}-${length}`] = () => {
      const r = recorder(314159, length);
      const bots = {
        red: createBot('red', createRng(2718), BOT[difficulty], length),
        blue: createBot('blue', createRng(1618), BOT[difficulty], length),
      };
      r.advance((length + 3) * 60, () => {
        const elapsed = length - r.round.timeLeft;
        return r.round.phase === 'play' ? Object.fromEntries(['red', 'blue'].map((side) => [side, bots[side].think(r.world, STEP, elapsed)])) : {};
      });
      return r.finish(['countdown', 'go', 'roundEnd']);
    };
  }
}

export function sessionTrace() {
  const session = createSession();
  const trace = [];
  for (const rounds of [1, 3, 5, 7]) {
    session.rounds = rounds;
    startMatch(session);
    for (let i = 0; i < rounds; i++) recordRound(session.match, 'tie');
    trace.push({ rounds, stage: 'sudden-death', match: structuredClone(session.match) });
    const world = createWorld(7);
    pens(world, 'red');
    addRoundToTally(session.tally, world.animals);
    addRoundStats(session.match, { red: { cowsSplatted: 2, lambsSplatted: 1, dazed: 3 }, blue: { cowsSplatted: 1, lambsSplatted: 0, dazed: 2 } });
    recordRound(session.match, 'red');
    addMatchToTally(session.tally, session.match);
    trace.push({ rounds, stage: 'winner', match: structuredClone(session.match), tally: structuredClone(session.tally) });
  }
  startMatch(session);
  trace.push({ stage: 'play-again', match: structuredClone(session.match), tally: structuredClone(session.tally) });
  session.players = 1;
  session.difficulty = 'hard';
  startMatch(session);
  trace.push({ stage: 'switch-to-solo-hard', tally: structuredClone(session.tally) });
  session.players = 2;
  startMatch(session);
  trace.push({ stage: 'return-to-two-players', tally: structuredClone(session.tally) });
  return trace;
}

export function generate() {
  return {
    schema: 1,
    engine: 'pixi',
    logicCommit: 'a6b49901ea7279514a960baf15d5141bee04e4f0',
    scenarios: Object.fromEntries(Object.entries(scenarios).map(([name, run]) => [name, run()])),
    session: sessionTrace(),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const actual = generate();
  if (process.argv.includes('--write')) {
    await mkdir(new URL('.', fixturePath), { recursive: true });
    await writeFile(fixturePath, JSON.stringify(actual, null, 2) + '\n');
    console.log(`Wrote ${Object.keys(actual.scenarios).length} logic scenarios`);
  } else {
    const expected = JSON.parse(await readFile(fixturePath, 'utf8'));
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error('Baseline drift: investigate; do not regenerate to make verification pass.');
    console.log(`Verified ${Object.keys(actual.scenarios).length} logic scenarios and session trace`);
  }
}
