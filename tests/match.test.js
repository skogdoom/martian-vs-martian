import { describe, it, expect } from 'vitest';
import { STEP, ROUND } from '../src/config.js';
import { createMatch, recordRound, roundWinner, roundNumber, isSuddenDeath } from '../src/logic/match.js';
import { createTally, addRoundToTally, addMatchToTally } from '../src/logic/tally.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { createWorld, stepWorld, spawnCrate } from '../src/logic/world.js';
import { addAmmo } from '../src/logic/weapon.js';
import { ammoFor } from '../src/options.js';

function play(results, rounds = 3) {
  const m = createMatch(rounds);
  const outcomes = results.map((r) => recordRound(m, r));
  return { m, outcomes };
}

describe('round winner', () => {
  it('compares scores, including half points', () => {
    expect(roundWinner({ red: 3, blue: 2.5 })).toBe('red');
    expect(roundWinner({ red: 0, blue: 0.5 })).toBe('blue');
    expect(roundWinner({ red: 2, blue: 2 })).toBe('tie');
  });
});

describe('match rules', () => {
  it('is best of 3 and ends early at 2-0', () => {
    const { m, outcomes } = play(['red', 'red']);
    expect(outcomes).toEqual(['continue', 'over']);
    expect(m.winner).toBe('red');
    expect(m.scheduled).toBe(3);
  });

  it('plays all 3 rounds when the first two are split', () => {
    const { m, outcomes } = play(['red', 'blue', 'blue']);
    expect(outcomes).toEqual(['continue', 'continue', 'over']);
    expect(m.winner).toBe('blue');
  });

  it('gives no one a win on a tie', () => {
    const { m } = play(['tie']);
    expect(m.wins).toEqual({ red: 0, blue: 0 });
    expect(roundNumber(m)).toBe(2);
  });

  it('ends early once the leader cannot be caught, even with ties', () => {
    // 1-0 with one round left: blue can still level.
    const a = play(['tie', 'red']);
    expect(a.m.over).toBe(false);
    // 1-0 after all three rounds.
    const b = play(['tie', 'red', 'tie']);
    expect(b.m.over).toBe(true);
    expect(b.m.winner).toBe('red');
  });

  it('goes to sudden death when wins are level after the scheduled rounds', () => {
    const { m, outcomes } = play(['red', 'blue', 'tie']);
    expect(outcomes[2]).toBe('extended');
    expect(m.scheduled).toBe(4);
    expect(m.rounds).toBe(3);
    expect(m.over).toBe(false);
    expect(isSuddenDeath(m)).toBe(true);
  });

  it('keeps playing one round at a time until someone wins one', () => {
    const { m } = play(['red', 'blue', 'tie', 'tie', 'tie']);
    expect(m.scheduled).toBe(6);
    expect(m.over).toBe(false);
    expect(recordRound(m, 'blue')).toBe('over');
    expect(m.winner).toBe('blue');
  });

  it('ends early inside sudden death only on a win', () => {
    const { m, outcomes } = play(['red', 'blue', 'tie', 'red']);
    expect(outcomes[3]).toBe('over');
    expect(m.winner).toBe('red');
  });

  it('refuses rounds after the match is over', () => {
    const { m } = play(['red', 'red']);
    expect(() => recordRound(m, 'blue')).toThrow();
  });
});

describe('tally', () => {
  it('counts pen contents per round and match wins', () => {
    const t = createTally();
    const herd = [
      { kind: 'cow', pen: 'red' },
      { kind: 'lamb', pen: 'red' },
      { kind: 'lamb', pen: 'blue' },
      { kind: 'cow', pen: null },
    ];
    addRoundToTally(t, herd);
    addRoundToTally(t, herd);
    expect(t.cows).toEqual({ red: 2, blue: 0 });
    expect(t.lambs).toEqual({ red: 2, blue: 2 });
    addMatchToTally(t, { winner: 'blue' });
    expect(t.matchWins).toEqual({ red: 0, blue: 1 });
  });
});

describe('round timing', () => {
  it('counts down 3-2-1 with the world frozen, then plays for the round length', () => {
    const r = createRound(1);
    const events = [];
    let steps = 0;
    const x = r.world.animals[0].x;
    while (r.phase !== 'over' && steps < 10000) {
      stepRound(r, { red: { x: 1, y: 0, shoot: false } }, STEP);
      events.push(...r.events.filter((e) => ['countdown', 'go', 'roundEnd'].includes(e.type)));
      steps++;
      if (r.phase === 'countdown') {
        expect(r.world.saucers.red.vx).toBe(0);
        expect(r.world.animals[0].x).toBe(x);
      }
    }
    expect(events.map((e) => e.n ?? e.type)).toEqual([3, 2, 1, 'go', 'roundEnd']);
    expect(steps * STEP).toBeCloseTo(ROUND.countdown + ROUND.length, 1);
  });
});

describe('best of 1, 5 and 7', () => {
  it('best of 1: the first win takes it', () => {
    const { m, outcomes } = play(['blue'], 1);
    expect(outcomes).toEqual(['over']);
    expect(m.winner).toBe('blue');
  });

  it('best of 1: a tie is followed by sudden death', () => {
    const { m, outcomes } = play(['tie'], 1);
    expect(outcomes).toEqual(['extended']);
    expect(isSuddenDeath(m)).toBe(true);
    expect(recordRound(m, 'red')).toBe('over');
    expect(m.winner).toBe('red');
  });

  it('best of 5 needs three wins and ends as soon as they are in', () => {
    const { m, outcomes } = play(['red', 'blue', 'red', 'tie', 'red'], 5);
    expect(outcomes).toEqual(['continue', 'continue', 'continue', 'continue', 'over']);
    expect(m.winner).toBe('red');
  });

  it('best of 5 ends early when the rest cannot change it', () => {
    const { m, outcomes } = play(['blue', 'blue', 'blue'], 5);
    expect(outcomes[2]).toBe('over');
    expect(m.results).toHaveLength(3);
  });

  it('best of 7 goes the distance when it stays close', () => {
    const results = ['red', 'blue', 'red', 'blue', 'red', 'blue', 'tie'];
    const { m, outcomes } = play(results, 7);
    expect(outcomes.slice(0, 6)).toEqual(Array(6).fill('continue'));
    expect(outcomes[6]).toBe('extended');
    expect(m.scheduled).toBe(8);
  });

  it('the default is best of 3', () => {
    expect(createMatch().rounds).toBe(3);
  });
});

describe('round lengths', () => {
  for (const length of [60, 90, 120]) {
    it(`${length} s: counts down, plays ${length} s, and scales its timed events`, () => {
      const r = createRound(1, length);
      expect(r.length).toBe(length);
      expect(r.timeLeft).toBe(length);
      let steps = 0;
      let wolf = null;
      const drops = [];
      while (r.phase !== 'over' && steps < 20000) {
        stepRound(r, {}, STEP);
        steps++;
        if (r.phase !== 'play') continue;
        for (const e of r.events) if (e.type === 'dropIncoming') drops.push(length - r.timeLeft);
        if (r.events.some((e) => e.type === 'wolfIncoming')) wolf = length - r.timeLeft;
      }
      expect(steps * STEP).toBeCloseTo(ROUND.countdown + length, 1);
      if (wolf !== null) expect(wolf / length).toBeGreaterThan(0.2);
      for (const t of drops) expect(t / length).toBeGreaterThan(0.25);
    });
  }

  it('120 s rounds plan a third green-man drop, shorter ones two', () => {
    expect(createRound(1, 60).drops).toHaveLength(2);
    expect(createRound(1, 90).drops).toHaveLength(2);
    expect(createRound(1, 120).drops).toHaveLength(3);
  });

  it('ammo scales with the length: 16, 24 and 32 shots', () => {
    expect(ammoFor(60)).toBe(16);
    expect(ammoFor(90)).toBe(24);
    expect(ammoFor(120)).toBe(32);
    for (const length of [60, 90, 120]) {
      const r = createRound(1, length);
      expect(r.world.weapons.red.ammo).toBe(ammoFor(length));
      expect(r.world.weapons.blue.cap).toBe(ammoFor(length));
    }
  });

  it('the ammo crate refills half the ammo, up to the cap', () => {
    for (const length of [60, 90, 120]) {
      const w = createWorld(1, { ammo: ammoFor(length) });
      w.saucers.blue.y = 100;
      spawnCrate(w, 'red');
      for (let t = 0; t < 12 && !w.events.some((e) => e.type === 'dropLanded'); t += STEP) stepWorld(w, {}, STEP);
      const crate = w.drops[0];
      w.weapons.red.ammo = 0;
      Object.assign(w.saucers.red, { x: crate.x, y: 470, vx: 0, vy: 0 });
      for (let t = 0; t < 3 && !w.events.some((e) => e.type === 'ammoCrate'); t += STEP) stepWorld(w, {}, STEP);
      expect(w.weapons.red.ammo).toBe(ammoFor(length) / 2);
    }
    const w = createWorld(1, { ammo: 12 });
    addAmmo(w.weapons.red, 100);
    expect(w.weapons.red.ammo).toBe(12);
  });
});
