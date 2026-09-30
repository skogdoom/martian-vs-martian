// Headless balance simulation: two bots play rounds with the real game logic
// and we report what happened, including how much power-ups swing a round.
// Used for tuning; not part of the game.
//
//   npm run sim                  default: 300 rounds
//   npm run sim -- 1000          more rounds
//   npm run sim -- 300 HOOK.stillSpeed=50 SAUCER.drag=4   try overrides
//   npm run sim -- 500 RED=easy BLUE=hard                  pit CPU difficulties
//
// Bots press keys like people do (-1/0/+1 per axis), re-decide every
// ~0.1 s, and have a bit of aim and steering noise.

import * as config from '../src/config.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { scores } from '../src/logic/scoring.js';
import { roundWinner } from '../src/logic/match.js';
import { createRng } from '../src/logic/rng.js';
import { createBot } from '../src/logic/bot.js';

const { STEP, ANIMALS } = config;

// ---- command line -------------------------------------------------------

const args = process.argv.slice(2);
let SLOPPY = 0;
let PICKY = 0; // PICKY=1: only shoot at an opponent who is lifting or carrying
let HUNT_WITH_GUN = 0.8; // how keen bots are to chase the opponent with a laser or triple shot
const LEVELS = { red: null, blue: null }; // RED=easy BLUE=hard: named difficulties instead of random skill
const rounds = Number(args.find((a) => /^\d+$/.test(a)) ?? 300);
for (const a of args.filter((a) => a.includes('='))) {
  const [path, value] = a.split('=');
  if (path === 'SLOPPY') SLOPPY = Number(value);
  if (path === 'PICKY') PICKY = Number(value);
  if (path === 'HUNT_WITH_GUN') HUNT_WITH_GUN = Number(value);
  if (path === 'RED' || path === 'BLUE') LEVELS[path.toLowerCase()] = value;
  if (['SLOPPY', 'PICKY', 'HUNT_WITH_GUN', 'RED', 'BLUE'].includes(path)) continue;
  const keys = path.split('.');
  let obj = config;
  for (const k of keys.slice(0, -1)) obj = obj[k];
  obj[keys.at(-1)] = Number(value);
  console.log(`override ${path} = ${value}`);
}

// Reference time for "late game" and comeback baselines: about when the
// last green man is usually grabbed.
const PIVOT = Math.round(config.ROUND.length * config.POWERUP.dropTimes.at(-1) + 6);

// ---- bots ---------------------------------------------------------------

const other = (side) => (side === 'red' ? 'blue' : 'red');

/** A random skill in the range the tuning runs used, or a named difficulty (RED=hard). */
function skillFor(side, rng) {
  const named = LEVELS[side];
  if (named) return { ...config.BOT[named] };
  return {
    gain: 2.5 + rng() * 2.5,
    react: 0.08 + rng() * 0.1,
    aim: 10 + rng() * 10,
    hunter: rng() * 0.7,
    huntWithGun: HUNT_WITH_GUN,
    picky: Boolean(PICKY),
    sloppy: SLOPPY,
    jitter: 6,
    raid: true,
    carryLow: rng() < 0.5,
  };
}

// ---- run ----------------------------------------------------------------

function simulate(seed) {
  const rng = createRng(seed);
  const round = createRound(seed);
  const w = round.world;
  const bots = { red: createBot('red', rng, skillFor('red', rng)), blue: createBot('blue', rng, skillFor('blue', rng)) };
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
    rams: 0,
    ramDrops: 0, // animals knocked loose by a ram
    bumpRepeats: 0, // bumps within 0.3 s of the previous one
    lastBump: -1,
    dry: 0,
    fieldEmptyAt: null,
    firstDelivery: null,
    ammoOutAt: { red: null, blue: null },
    leadChanges: 0,
    lastScoreChange: 0,
    hasDrops: round.drops.some((d) => d.power), // any green man planned this round
    leadAtCheck: null, // |lead| at the golden check point
    golden: null, // { trailing, deliveredBy, diffBefore } when a golden animal dropped
    crates: [], // { for: side that ran out, t, grabbedBy }
    splats: 0,
    wolf: null, // { eatenField, eatenPen, penDrops: { own, theirs }, left }
    timeBombs: [], // { owner, moves, outcome: 'theirs' | 'own' | 'field' | 'held' | null, count }
    spooked: 0,
    fieldRestocks: 0,
    grabs: [], // { side, t, power, diff, swing }: diff = grabber's lead at the grab, swing = lead gained over the power-up's duration
    diffAtPivot: null, // red minus blue at PIVOT, for comeback baselines
    late: { hooks: 0, pickups: 0, shot: 0, drift: 0, laser: 0, rocket: 0, ram: 0, idle: 0 }, // after PIVOT
    baseSwing: null, // change in red's lead from PIVOT + 2 s over the power-up's length, no power-up
  };
  let leader = 'tie';
  let lastPoints = '0:0';
  const hookedAt = { red: 0, blue: 0 };
  const bumpedAt = { red: -1, blue: -1 };
  let t = 0;

  while (round.phase !== 'over') {
    const inputs = round.phase === 'play' ? { red: bots.red.think(w, STEP, t), blue: bots.blue.think(w, STEP, t) } : {};
    stepRound(round, inputs, STEP);
    if (round.phase !== 'play' && round.phase !== 'over') continue;
    t += STEP;
    if (t > PIVOT) {
      for (const e of round.events) {
        if (e.type === 'hook') m.late.hooks++;
        if (e.type === 'pickup') m.late.pickups++;
        if (e.type === 'interrupt') m.late[e.reason]++;
      }
      for (const side of ['red', 'blue']) if (!w.hooks[side].target && !w.hooks[side].carrying) m.late.idle += STEP / 2;
    }
    for (const e of round.events) {
      if (e.type === 'land' && e.id === 'golden' && e.delivered && m.golden && !m.golden.deliveredBy) m.golden.deliveredBy = e.pen;
      // Paid-out gold lifted back out of the trailer's pen by the leader.
      if (e.type === 'pickup' && m.golden && m.golden.deliveredBy === m.golden.trailing && e.side !== m.golden.trailing) {
        if (w.hooks[e.side].carrying?.id === 'golden') m.golden.stolenBack = true;
      }
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
      else if (e.type === 'pickup') {
        m.pickups++;
        if (e.kind === 'timebomb' && m.timeBombs.length) m.timeBombs.at(-1).moves++;
      }
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
      else if (e.type === 'ram' && !e.shielded) {
        m.rams++;
        m.ramDrops += round.events.filter((x) => x.type === 'knockLoose' && x.side === e.victim).length;
      }
      else if (e.type === 'dryFire') m.dry++;
      else if (e.type === 'splat') m.splats++;
      else if (e.type === 'timeBombDrop') m.timeBombs.push({ owner: e.side, moves: 0, outcome: null, count: 0 });
      else if (e.type === 'timeBombHeld' && m.timeBombs.length) m.timeBombs.at(-1).outcome = 'held';
      else if (e.type === 'bombBlast' && e.timed && m.timeBombs.length) {
        const b = m.timeBombs.at(-1);
        b.outcome = !e.pen ? 'field' : e.pen === b.owner ? 'own' : 'theirs';
        b.count = e.count;
      }
      else if (e.type === 'wolfIncoming') m.wolf = { eatenField: 0, eatenPen: 0, own: 0, theirs: 0, left: false };
      else if (e.type === 'wolfEat') m.wolf[e.pen ? 'eatenPen' : 'eatenField']++;
      else if (e.type === 'wolfLand' && e.pen && e.by) m.wolf[e.pen === e.by ? 'own' : 'theirs']++;
      else if (e.type === 'wolfLeaves') m.wolf.left = true;
      else if (e.type === 'spooked') m.spooked++;
      else if (e.type === 'restock' && e.reason === 'emptyField') m.fieldRestocks++;
      else if (e.type === 'crateIncoming') m.crates.push({ for: e.side, t, grabbedBy: null });
      else if (e.type === 'ammoCrate') {
        const c = m.crates.find((c) => !c.grabbedBy);
        if (c) c.grabbedBy = e.side;
      } else if (e.type === 'goldenIncoming') {
        const p = scores(w.animals);
        m.golden = { trailing: e.side, deliveredBy: null, diffBefore: p[e.side] - p[other(e.side)] };
      } else if (e.type === 'powerup') {
        const p = scores(w.animals);
        m.grabs.push({ side: e.side, t, power: e.power, diff: p[e.side] - p[other(e.side)], swing: null });
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
    if (m.leadAtCheck === null && t >= config.ROUND.length * config.GOLDEN.checkAt) m.leadAtCheck = Math.abs(p.red - p.blue);
    if (m.diffAtPivot === null && t >= PIVOT) m.diffAtPivot = p.red - p.blue;
    for (const g of m.grabs) {
      if (g.swing === null && t >= g.t + config.POWERUP.duration) g.swing = p[g.side] - p[other(g.side)] - g.diff;
    }
    if (m.baseStart === undefined && t >= PIVOT + 2) m.baseStart = p.red - p.blue;
    if (m.baseStart !== undefined && m.baseSwing === null && t >= PIVOT + 2 + config.POWERUP.duration) {
      m.baseSwing = p.red - p.blue - m.baseStart;
    }
    if (m.fieldEmptyAt === null && w.animals.every((a) => a.state !== 'field')) m.fieldEmptyAt = t;
    for (const side of ['red', 'blue']) {
      if (m.ammoOutAt[side] === null && w.weapons[side].ammo === 0) m.ammoOutAt[side] = t;
    }
  }
  const points = scores(w.animals);
  return { ...m, points, result: roundWinner(points), inPens: w.animals.filter((a) => a.pen).length, herd: w.animals.length };
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
  'animals splatted (knocked loose too high)': avg((r) => r.splats).toFixed(2),
  'animals spooked out of a pen': avg((r) => r.spooked).toFixed(2),
  'field restocks (empty for too long)': avg((r) => r.fieldRestocks).toFixed(2),
  'animals in pens at the end': `${avg((r) => r.inPens).toFixed(1)} (herd of ${ANIMALS.cows + ANIMALS.lambs}, ${avg((r) => r.herd).toFixed(1)} with restocks)`,
  'first delivery (median s)': median(results.map((r) => r.firstDelivery)),
  'field emptied (median s)': `${median(results.map((r) => r.fieldEmptyAt))} (${pct((r) => r.fieldEmptyAt !== null)} of rounds)`,
  'shots per player': (avg((r) => r.shots) / 2).toFixed(1),
  'hit rate': `${((100 * avg((r) => r.hits)) / Math.max(1, avg((r) => r.shots))).toFixed(0)}%`,
  [`after ${PIVOT} s: hooks / pickups / broken by shot / by drift`]: ['hooks', 'pickups', 'shot', 'drift'].map((k) => avg((r) => r.late[k]).toFixed(1)).join(' / '),
  [`after ${PIVOT} s: share of time a saucer is neither lifting nor carrying`]: `${((100 * avg((r) => r.late.idle)) / (config.ROUND.length - PIVOT)).toFixed(0)}%`,
  'lead changes per round': avg((r) => r.leadChanges).toFixed(2),
  'score still changing in the last 10 s': pct((r) => r.lastScoreChange > config.ROUND.length - 10),
  'ammo used up (median s)': median(results.flatMap((r) => [r.ammoOutAt.red, r.ammoOutAt.blue])),
  bumps: `${avg((r) => r.bumps).toFixed(1)} (${avg((r) => r.bumpRepeats).toFixed(1)} within 0.3 s of the last)`,
  'rams (animals knocked loose by them)': `${avg((r) => r.rams).toFixed(2)} (${avg((r) => r.ramDrops).toFixed(2)})`,
  'final score (avg per player)': (avg((r) => r.points.red + r.points.blue) / 2).toFixed(2),
  'winning margin (avg)': avg((r) => Math.abs(r.points.red - r.points.blue)).toFixed(2),
  'red wins / blue wins / ties': `${pct((r) => r.result === 'red')} / ${pct((r) => r.result === 'blue')} / ${pct((r) => r.result === 'tie')}`,
});

function ROUND_LENGTH() {
  return config.ROUND.length;
}

// ---- the wolf -----------------------------------------------------------

const wolfRounds = results.filter((r) => r.wolf);
const wavg = (f) => (wolfRounds.reduce((s, r) => s + f(r.wolf), 0) / Math.max(1, wolfRounds.length)).toFixed(2);
console.log('\nThe wolf');
console.table({
  'rounds with a wolf': `${wolfRounds.length} (${((100 * wolfRounds.length) / results.length).toFixed(0)}%)`,
  'lambs eaten in the field (avg)': wavg((w) => w.eatenField),
  'lambs eaten in a pen (avg)': wavg((w) => w.eatenPen),
  "dropped in the opponent's pen / own pen (avg)": `${wavg((w) => w.theirs)} / ${wavg((w) => w.own)}`,
  'got bored and left before the end': `${((100 * wolfRounds.filter((r) => r.wolf.left).length) / Math.max(1, wolfRounds.length)).toFixed(0)}%`,
});

// ---- time bombs ---------------------------------------------------------

const tbs = results.flatMap((r) => r.timeBombs);
const share = (o) => `${((100 * tbs.filter((b) => b.outcome === o).length) / Math.max(1, tbs.length)).toFixed(0)}%`;
console.log('\nTime bombs');
console.table({
  'time bombs dropped': tbs.length,
  'lifted again (avg times)': (tbs.reduce((s, b) => s + b.moves, 0) / Math.max(1, tbs.length)).toFixed(2),
  "went off in the opponent's pen / dropper's own pen": `${share('theirs')} / ${share('own')}`,
  'in the field / in a beam / not before the end': `${share('field')} / ${share('held')} / ${share(null)}`,
  'animals blown out per pen blast': (tbs.filter((b) => b.outcome === 'theirs' || b.outcome === 'own').reduce((s, b) => s + b.count, 0) / Math.max(1, tbs.filter((b) => b.outcome === 'theirs' || b.outcome === 'own').length)).toFixed(2),
});

// ---- power-ups ----------------------------------------------------------

const rate = (rs, f) => (rs.length ? `${((100 * rs.filter(f).length) / rs.length).toFixed(0)}% (n=${rs.length})` : '-');
const powerRows = {};
const withDrop = results.filter((r) => r.hasDrops);
if (withDrop.length) {
  const grabs = results.flatMap((r) => r.grabs.map((g) => ({ ...g, result: r.result })));
  const won = (g) => g.result === g.side;
  Object.assign(powerRows, {
    'rounds with at least one drop': `${withDrop.length} (${pct((r) => r.hasDrops)})`,
    'green men grabbed per round': avg((r) => r.grabs.length).toFixed(2),
    'grabber wins the round': rate(grabs, won),
    'grabber wins when behind at the grab': rate(grabs.filter((g) => g.diff < 0), won),
    'grabber wins when behind by 2+': rate(grabs.filter((g) => g.diff <= -2), won),
  });
  const mean = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '-');
  for (const type of config.POWERUP.types) {
    const gs = grabs.filter((g) => g.power === type);
    const swings = gs.map((g) => g.swing).filter((x) => x !== null);
    powerRows[`${type}: lead gained during power / wins when behind`] = `${mean(swings)} pts / ${rate(gs.filter((g) => g.diff < 0), won)}`;
  }
}
// Baseline: how often the player trailing at PIVOT wins when no power-up is in play.
const none = results.filter((r) => !r.hasDrops && r.diffAtPivot);
if (none.length) {
  const trailingWins = (r) => (r.diffAtPivot < 0 ? r.result === 'red' : r.result === 'blue');
  powerRows[`no power-up: trailing at ${PIVOT} s wins`] = rate(none, trailingWins);
  powerRows[`no power-up: trailing by 2+ at ${PIVOT} s wins`] = rate(none.filter((r) => Math.abs(r.diffAtPivot) >= 2), trailingWins);
  const base = results.filter((r) => !r.hasDrops && r.baseSwing !== null).map((r) => r.baseSwing);
  powerRows['no power-up: lead change over the same window (avg of |x|)'] = `${(base.reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, base.length)).toFixed(2)} pts`;
}
console.log('\nPower-ups');
console.table(powerRows);

// ---- golden animals -----------------------------------------------------

{
  const leads = results.map((r) => r.leadAtCheck).filter((x) => x !== null);
  const share = (n) => `${((100 * leads.filter((x) => x >= n).length) / leads.length).toFixed(0)}%`;
  const dropped = results.filter((r) => r.golden);
  const trailerWins = (r) => r.result === r.golden.trailing;
  const trailerTies = (r) => r.result === 'tie';
  const byTrailer = dropped.filter((r) => r.golden.deliveredBy === r.golden.trailing);
  const byLeader = dropped.filter((r) => r.golden.deliveredBy && r.golden.deliveredBy !== r.golden.trailing);
  console.log('\nGolden animals');
  console.table({
    [`lead at ${Math.round(config.ROUND.length * config.GOLDEN.checkAt)} s: 2+ / 3+ / 4+ / 5+`]: [2, 3, 4, 5].map(share).join(' / '),
    'rounds with a golden animal': `${dropped.length} (${pct((r) => r.golden)})`,
    'delivered by the trailing player': rate(dropped, (r) => r.golden.deliveredBy === r.golden.trailing),
    'delivered by the leader': rate(dropped, (r) => r.golden.deliveredBy && r.golden.deliveredBy !== r.golden.trailing),
    'trailing player wins / ties (all golden rounds)': `${rate(dropped, trailerWins)} / ${rate(dropped, trailerTies)}`,
    '  when the trailer delivered it': `${rate(byTrailer, trailerWins)} / ${rate(byTrailer, trailerTies)}`,
    '  when the leader delivered it': `${rate(byLeader, trailerWins)} / ${rate(byLeader, trailerTies)}`,
    '  trailer delivered it, then the leader stole it back': rate(byTrailer, (r) => r.golden.stolenBack),
  });
}

// ---- ammo crates --------------------------------------------------------

{
  const crates = results.flatMap((r) => r.crates);
  console.log('\nAmmo crates');
  console.table({
    'rounds with a crate': pct((r) => r.crates.length > 0),
    'crates per round (avg)': avg((r) => r.crates.length).toFixed(2),
    'dropped at (median s)': median(crates.map((c) => c.t)),
    'grabbed by the player who ran out': rate(crates, (c) => c.grabbedBy === c.for),
    'grabbed by the other player': rate(crates, (c) => c.grabbedBy && c.grabbedBy !== c.for),
    'not grabbed': rate(crates, (c) => !c.grabbedBy),
  });
}
