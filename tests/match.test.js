import { describe, it, expect } from 'vitest';
import { STEP, ROUND } from '../src/config.js';
import { createMatch, recordRound, roundWinner, roundNumber } from '../src/logic/match.js';
import { createTally, addRoundToTally, addMatchToTally } from '../src/logic/tally.js';
import { createRound, stepRound } from '../src/logic/round.js';

function play(results) {
  const m = createMatch();
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

  it('adds two rounds when wins are level after the scheduled rounds', () => {
    const { m, outcomes } = play(['red', 'blue', 'tie']);
    expect(outcomes[2]).toBe('extended');
    expect(m.scheduled).toBe(5);
    expect(m.over).toBe(false);
  });

  it('keeps extending: best of 3 → 5 → 7', () => {
    const { m } = play(['tie', 'tie', 'tie', 'tie', 'tie']);
    expect(m.scheduled).toBe(7);
    expect(m.over).toBe(false);
    recordRound(m, 'blue');
    expect(m.over).toBe(false); // 0-1 with one round left
    recordRound(m, 'blue');
    expect(m.over).toBe(true);
    expect(m.winner).toBe('blue');
  });

  it('ends early inside an extension', () => {
    const { m, outcomes } = play(['red', 'blue', 'tie', 'blue']);
    expect(m.scheduled).toBe(5);
    expect(outcomes[3]).toBe('continue'); // 1-2 with one left
    recordRound(m, 'tie');
    expect(m.over).toBe(true);
    expect(m.winner).toBe('blue');
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
