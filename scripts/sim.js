// Headless balance simulation: two bots play rounds with the real game logic
// and we report what happened, including how much power-ups swing a round.
// Used for tuning; not part of the game.
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
import { hasPower } from '../src/logic/powerup.js';

const { STEP, ARENA, SAUCER, HOOK, ANIMALS } = config;

// ---- command line -------------------------------------------------------

const args = process.argv.slice(2);
let SLOPPY = 0;
let PICKY = 0; // PICKY=1: only shoot at an opponent who is lifting or carrying
let HUNT_WITH_GUN = 0.8; // how keen bots are to chase the opponent with a laser or triple shot
const rounds = Number(args.find((a) => /^\d+$/.test(a)) ?? 300);
for (const a of args.filter((a) => a.includes('='))) {
  const [path, value] = a.split('=');
  if (path === 'SLOPPY') SLOPPY = Number(value);
  if (path === 'PICKY') PICKY = Number(value);
  if (path === 'HUNT_WITH_GUN') HUNT_WITH_GUN = Number(value);
  if (['SLOPPY', 'PICKY', 'HUNT_WITH_GUN'].includes(path)) continue;
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
function axis(pos, vel, target, gain, max) {
  const desired = Math.max(-max, Math.min(max, (target - pos) * gain));
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
    // Raid the opponent's pen with the steal power-up, or when losing in the
    // second half (what a trailing player does). Always want the green man.
    const p = scores(w.animals);
    const losing = p[side] < p[other(side)] && w.clock > config.ROUND.length / 2;
    const stealPenalty = hasPower(w.powers, side, 'steal') || losing ? -300 : 150;
    const targets = w.drop ? [...w.animals, w.drop] : w.animals;
    for (const a of targets) {
      const eligible = (a.state === 'field' || (a.state === 'penned' && a.pen !== side)) && a.hookedBy === null;
      if (!eligible) continue;
      const d = Math.abs(a.x - s.x) + (a.state === 'penned' ? stealPenalty : 0) + (a.kind === 'greenman' ? -400 : 0);
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
        const laser = hasPower(w.powers, side, 'laser');
        const armed = weapon.ammo > 0 || laser || hasPower(w.powers, side, 'triple');
        const hunter = laser || hasPower(w.powers, side, 'triple') ? Math.max(HUNT_WITH_GUN, skill.hunter) : skill.hunter;
        // With a gun power-up a carrier is worth chasing too: hits knock its animal loose.
        const prey = theirs.target || ((laser || hasPower(w.powers, side, 'triple')) && theirs.carrying);
        if (mode === 'collect' && prey && armed && rng() < hunter) mode = 'hunt';
        if (mode === 'hunt' && (!prey || !armed)) mode = 'collect';
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

      const top = SAUCER.maxSpeed * (hasPower(w.powers, side, 'speed') ? config.POWERUP.speedBoost : 1);
      const spread = hasPower(w.powers, side, 'triple') ? config.POWERUP.tripleSpread : 0;
      const aligned = Math.abs(o.y - s.y) < skill.aim + spread;
      const worthIt = PICKY ? theirs.target || theirs.carrying : theirs.target || theirs.carrying || mode === 'hunt' || rng() < 0.05;
      held = {
        x: axis(s.x, s.vx, tx + (rng() - 0.5) * 6, skill.gain, top),
        y: axis(s.y, s.vy, ty, skill.gain, top),
        shoot: aligned && worthIt && (weapon.ammo > 0 || hasPower(w.powers, side, 'triple')),
        fire: aligned && hasPower(w.powers, side, 'laser'),
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
    power: round.drop, // planned power-up, or null
    grab: null, // { side, t, diff } diff = grabber's score minus the other's at the grab
    diffAt36: null, // red minus blue at 36 s, for comeback baselines
    late: { hooks: 0, pickups: 0, shot: 0, drift: 0, laser: 0, idle: 0 }, // after 36 s
    swing: null, // change in the grabber's lead over the power-up window
    baseSwing: null, // |change in red's lead| from 38 s over the same length, no power-up
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
    w.clock = t; // for the bots
    if (t > 36) {
      for (const e of round.events) {
        if (e.type === 'hook') m.late.hooks++;
        if (e.type === 'pickup') m.late.pickups++;
        if (e.type === 'interrupt') m.late[e.reason]++;
      }
      for (const side of ['red', 'blue']) if (!w.hooks[side].target && !w.hooks[side].carrying) m.late.idle += STEP / 2;
    }
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
      else if (e.type === 'powerup') {
        const p = scores(w.animals);
        m.grab = { side: e.side, t, diff: p[e.side] - p[other(e.side)] };
      }
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
    if (m.diffAt36 === null && t >= 36) m.diffAt36 = p.red - p.blue;
    if (m.grab && m.swing === null && t >= m.grab.t + config.POWERUP.duration) {
      m.swing = p[m.grab.side] - p[other(m.grab.side)] - m.grab.diff;
    }
    if (m.base38 === undefined && t >= 38) m.base38 = p.red - p.blue;
    if (m.base38 !== undefined && m.baseSwing === null && t >= 38 + config.POWERUP.duration) {
      m.baseSwing = p.red - p.blue - m.base38;
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
  'after 36 s: hooks / pickups / broken by shot / by drift': ['hooks', 'pickups', 'shot', 'drift'].map((k) => avg((r) => r.late[k]).toFixed(1)).join(' / '),
  'after 36 s: share of time a saucer is neither lifting nor carrying': `${((100 * avg((r) => r.late.idle)) / (config.ROUND.length - 36)).toFixed(0)}%`,
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

// ---- power-ups ----------------------------------------------------------

const rate = (rs, f) => (rs.length ? `${((100 * rs.filter(f).length) / rs.length).toFixed(0)}% (n=${rs.length})` : '-');
const powerRows = {};
const withDrop = results.filter((r) => r.power);
if (withDrop.length) {
  const grabbed = withDrop.filter((r) => r.grab);
  const won = (r) => r.result === r.grab.side;
  Object.assign(powerRows, {
    'rounds with a drop': `${withDrop.length} (${pct((r) => r.power)})`,
    'green man grabbed': rate(withDrop, (r) => r.grab),
    'grabbed at (median s)': median(grabbed.map((r) => r.grab.t)),
    'grabber wins the round': rate(grabbed, won),
    'grabber wins when behind at the grab': rate(grabbed.filter((r) => r.grab.diff < 0), won),
    'grabber wins when behind by 2+': rate(grabbed.filter((r) => r.grab.diff <= -2), won),
  });
  const mean = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '-');
  for (const type of config.POWERUP.types) {
    const rs = grabbed.filter((r) => r.power === type);
    const swings = rs.map((r) => r.swing).filter((x) => x !== null);
    powerRows[`${type}: lead gained during power / wins when behind`] = `${mean(swings)} pts / ${rate(rs.filter((r) => r.grab.diff < 0), won)}`;
  }
}
// Baseline: how often the player trailing at 36 s wins when no power-up is in play.
const none = results.filter((r) => !r.power && r.diffAt36);
if (none.length) {
  const trailingWins = (r) => (r.diffAt36 < 0 ? r.result === 'red' : r.result === 'blue');
  powerRows['no power-up: trailing at 36 s wins'] = rate(none, trailingWins);
  powerRows['no power-up: trailing by 2+ at 36 s wins'] = rate(none.filter((r) => Math.abs(r.diffAt36) >= 2), trailingWins);
  const base = results.filter((r) => !r.power && r.baseSwing !== null).map((r) => r.baseSwing);
  powerRows['no power-up: lead change over the same window (avg of |x|)'] = `${(base.reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, base.length)).toFixed(2)} pts`;
}
console.log('\nPower-ups');
console.table(powerRows);
