// Headless balance simulation: two bots play rounds with the real game logic
// and we report what happened. Used for the tuning pass; not part of the game.
//
//   npm run sim                  default: 300 rounds
//   npm run sim -- 1000          more rounds
//   npm run sim -- 300 HOOK.stillSpeed=50 SAUCER.drag=4   try overrides
//
// Bots press keys like people do (-1/0/+1 per axis), re-decide every
// ~0.1 s, and have a bit of aim and steering noise.

import * as config from '../src/config.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { scores } from '../src/logic/scoring.js';
import { roundWinner } from '../src/logic/match.js';
import { createRng } from '../src/logic/rng.js';
import { canHook } from '../src/logic/hook.js';

const { STEP, ARENA, SAUCER, HOOK, ANIMALS } = config;

// ---- command line -------------------------------------------------------

const args = process.argv.slice(2);
let SLOPPY = 0;
let PICKY = 0; // PICKY=1: only shoot at an opponent who is lifting or carrying
const rounds = Number(args.find((a) => /^\d+$/.test(a)) ?? 300);
for (const a of args.filter((a) => a.includes('='))) {
  const [path, value] = a.split('=');
  if (path === 'SLOPPY' || path === 'PICKY') {
    if (path === 'SLOPPY') SLOPPY = Number(value);
    else PICKY = Number(value);
    continue;
  }
  const keys = path.split('.');
  let obj = config;
  for (const k of keys.slice(0, -1)) obj = obj[k];
  obj[keys.at(-1)] = Number(value);
  console.log(`override ${path} = ${value}`);
}

// ---- bot ----------------------------------------------------------------

const other = (side) => (side === 'red' ? 'blue' : 'red');
const LOW = ARENA.flightBottom - 12; // hover height for hooking

/** Digital steering toward `target` on one axis: press, release or brake. */
function axis(pos, vel, target, gain) {
  const desired = Math.max(-SAUCER.maxSpeed, Math.min(SAUCER.maxSpeed, (target - pos) * gain));
  const dv = desired - vel;
  return Math.abs(dv) < 30 ? 0 : Math.sign(dv);
}

function createBot(side, rng) {
  const skill = {
    gain: 2.5 + rng() * 2.5, // how hard it steers toward targets
    react: 0.08 + rng() * 0.1, // seconds between decisions
    aim: 10 + rng() * 10, // how close in height before firing
    hunter: rng() * 0.7, // chance to go after an opponent that is lifting
    // Share of lifts where the player lets go of the keys once the beam grabs,
    // instead of holding position. Set with SLOPPY=0.5 (default 0).
    sloppy: SLOPPY,
  };
  let letGo = false;
  let lifting = null; // the animal of the lift we decided `letGo` for
  let wait = 0;
  let held = { x: 0, y: 0, shoot: false };
  let mode = 'collect';

  function pickTarget(w, s) {
    let best = null;
    let bestD = Infinity;
    for (const a of w.animals) {
      const eligible = (a.state === 'field' || (a.state === 'penned' && a.pen !== side)) && a.hookedBy === null;
      if (!eligible) continue;
      const d = Math.abs(a.x - s.x) + (a.state === 'penned' ? 150 : 0);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  return {
    skill,
    think(w, dt) {
      wait -= dt;
      if (wait > 0) return { ...held, shoot: false };
      wait = skill.react;

      const s = w.saucers[side];
      const o = w.saucers[other(side)];
      const hook = w.hooks[side];
      const theirs = w.hooks[other(side)];
      const weapon = w.weapons[side];
      let tx = s.x;
      let ty = s.y;

      if (hook.carrying) {
        const pen = ARENA.pens[side];
        tx = (pen.left + pen.right) / 2;
        ty = 360;
        mode = 'collect';
      } else if (hook.target) {
        if (lifting !== hook.target) {
          lifting = hook.target;
          letGo = rng() < skill.sloppy;
        }
        if (letGo) {
          held = { x: 0, y: 0, shoot: false };
          return held;
        }
        tx = hook.target.x;
        ty = s.y;
      } else {
        if (mode === 'collect' && theirs.target && weapon.ammo > 0 && rng() < skill.hunter) mode = 'hunt';
        if (mode === 'hunt' && (!theirs.target || weapon.ammo === 0)) mode = 'collect';
        if (mode === 'hunt') {
          tx = s.x;
          ty = o.y;
        } else {
          const a = pickTarget(w, s);
          if (a) {
            tx = a.x;
            ty = Math.abs(a.x - s.x) > 120 ? 380 : LOW;
          }
        }
      }

      const aligned = Math.abs(o.y - s.y) < skill.aim;
      const worthIt = PICKY ? theirs.target || theirs.carrying : theirs.target || theirs.carrying || mode === 'hunt' || rng() < 0.05;
      held = {
        x: axis(s.x, s.vx, tx + (rng() - 0.5) * 6, skill.gain),
        y: axis(s.y, s.vy, ty, skill.gain),
        shoot: aligned && worthIt && weapon.ammo > 0,
      };
      return held;
    },
  };
}

// ---- run ----------------------------------------------------------------

function simulate(seed) {
  const rng = createRng(seed);
  const round = createRound(seed);
  const w = round.world;
  const bots = { red: createBot('red', rng), blue: createBot('blue', rng) };
  const m = {
    hooks: 0,
    accidental: 0, // hook broken by drift within 0.25 s
    driftAfterBump: 0, // hook broken by drift after the saucers bumped mid-lift
    drift: 0,
    shotInterrupts: 0,
    pickups: 0,
    deliveries: 0,
    steals: 0,
    shots: 0,
    hits: 0,
    bumps: 0,
    bumpRepeats: 0, // bumps within 0.3 s of the previous one
    lastBump: -1,
    dry: 0,
    fieldEmptyAt: null,
    firstDelivery: null,
    ammoOutAt: { red: null, blue: null },
    leadChanges: 0,
    lastScoreChange: 0,
  };
  let leader = 'tie';
  let lastPoints = '0:0';
  const hookedAt = { red: 0, blue: 0 };
  const bumpedAt = { red: -1, blue: -1 };
  let t = 0;

  while (round.phase !== 'over') {
    const inputs = round.phase === 'play' ? { red: bots.red.think(w, STEP), blue: bots.blue.think(w, STEP) } : {};
    stepRound(round, inputs, STEP);
    if (round.phase !== 'play' && round.phase !== 'over') continue;
    t += STEP;
    for (const e of round.events) {
      if (e.type === 'hook') {
        m.hooks++;
        hookedAt[e.side] = t;
      } else if (e.type === 'interrupt' && e.reason === 'drift') {
        m.drift++;
        if (t - hookedAt[e.side] < 0.25) m.accidental++;
        if (bumpedAt[e.side] >= hookedAt[e.side]) m.driftAfterBump++;
      } else if (e.type === 'interrupt') m.shotInterrupts++;
      else if (e.type === 'pickup') m.pickups++;
      else if (e.type === 'land' && e.delivered) {
        m.deliveries++;
        if (e.stolen) m.steals++;
        m.firstDelivery ??= t;
      } else if (e.type === 'shot') m.shots++;
      else if (e.type === 'hit') m.hits++;
      else if (e.type === 'bump') {
        m.bumps++;
        if (t - m.lastBump < 0.3) m.bumpRepeats++;
        m.lastBump = t;
        bumpedAt.red = bumpedAt.blue = t;
      }
      else if (e.type === 'dryFire') m.dry++;
    }
    const p = scores(w.animals);
    const key = `${p.red}:${p.blue}`;
    if (key !== lastPoints) {
      lastPoints = key;
      m.lastScoreChange = t;
      const now = roundWinner(p);
      if (now !== 'tie' && leader !== 'tie' && now !== leader) m.leadChanges++;
      if (now !== 'tie') leader = now;
    }
    if (m.fieldEmptyAt === null && w.animals.every((a) => a.state !== 'field')) m.fieldEmptyAt = t;
    for (const side of ['red', 'blue']) {
      if (m.ammoOutAt[side] === null && w.weapons[side].ammo === 0) m.ammoOutAt[side] = t;
    }
  }
  const points = scores(w.animals);
  return { ...m, points, result: roundWinner(points), inPens: w.animals.filter((a) => a.pen).length };
}

const results = [];
for (let i = 0; i < rounds; i++) results.push(simulate(1000 + i));

const avg = (f) => results.reduce((s, r) => s + f(r), 0) / results.length;
const pct = (f) => `${((100 * results.filter(f).length) / results.length).toFixed(0)}%`;
const median = (xs) => {
  const v = xs.filter((x) => x !== null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)].toFixed(1) : '-';
};

const hooks = avg((r) => r.hooks);
console.log(`\n${rounds} rounds, ${ROUND_LENGTH()} s each\n`);
console.table({
  'hooks started': hooks.toFixed(1),
  '  broken by drift': `${avg((r) => r.drift).toFixed(1)} (${((100 * avg((r) => r.drift)) / hooks).toFixed(0)}% of hooks)`,
  '  broken by drift < 0.25 s (accidental)': `${avg((r) => r.accidental).toFixed(1)} (${((100 * avg((r) => r.accidental)) / hooks).toFixed(0)}%)`,
  '  broken by drift after a bump mid-lift': avg((r) => r.driftAfterBump).toFixed(1),
  '  broken by a shot': avg((r) => r.shotInterrupts).toFixed(1),
  'pickups completed': avg((r) => r.pickups).toFixed(1),
  deliveries: avg((r) => r.deliveries).toFixed(1),
  '  of which stolen': avg((r) => r.steals).toFixed(1),
  'animals in pens at the end': `${avg((r) => r.inPens).toFixed(1)} of ${ANIMALS.cows + ANIMALS.lambs}`,
  'first delivery (median s)': median(results.map((r) => r.firstDelivery)),
  'field emptied (median s)': `${median(results.map((r) => r.fieldEmptyAt))} (${pct((r) => r.fieldEmptyAt !== null)} of rounds)`,
  'shots per player': (avg((r) => r.shots) / 2).toFixed(1),
  'hit rate': `${((100 * avg((r) => r.hits)) / Math.max(1, avg((r) => r.shots))).toFixed(0)}%`,
  'lead changes per round': avg((r) => r.leadChanges).toFixed(2),
  'score still changing in the last 10 s': pct((r) => r.lastScoreChange > config.ROUND.length - 10),
  'ammo used up (median s)': median(results.flatMap((r) => [r.ammoOutAt.red, r.ammoOutAt.blue])),
  bumps: `${avg((r) => r.bumps).toFixed(1)} (${avg((r) => r.bumpRepeats).toFixed(1)} within 0.3 s of the last)`,
  'final score (avg per player)': (avg((r) => r.points.red + r.points.blue) / 2).toFixed(2),
  'winning margin (avg)': avg((r) => Math.abs(r.points.red - r.points.blue)).toFixed(2),
  'red wins / blue wins / ties': `${pct((r) => r.result === 'red')} / ${pct((r) => r.result === 'blue')} / ${pct((r) => r.result === 'tie')}`,
});

function ROUND_LENGTH() {
  return config.ROUND.length;
}
