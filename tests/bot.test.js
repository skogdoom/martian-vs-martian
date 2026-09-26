import { describe, it, expect } from 'vitest';
import { STEP, BOT, ROUND } from '../src/config.js';
import { createBot } from '../src/logic/bot.js';
import { createRound, stepRound } from '../src/logic/round.js';
import { createRng } from '../src/logic/rng.js';
import { scores } from '../src/logic/scoring.js';
import { roundWinner } from '../src/logic/match.js';
import { createSession, startMatch, sideName, isCpu, modeName } from '../src/session.js';

/** Play one round; `red` and `blue` are difficulty names, or null for an idle player. */
function play(seed, red, blue, check = () => {}) {
  const rng = createRng(seed);
  const round = createRound(seed);
  const bots = {
    red: red && createBot('red', rng, BOT[red]),
    blue: blue && createBot('blue', rng, BOT[blue]),
  };
  while (round.phase !== 'over') {
    const elapsed = ROUND.length - round.timeLeft;
    const inputs = {};
    for (const side of ['red', 'blue']) {
      if (bots[side] && round.phase === 'play') inputs[side] = bots[side].think(round.world, STEP, elapsed);
      if (inputs[side]) check(inputs[side]);
    }
    stepRound(round, inputs, STEP);
  }
  return scores(round.world.animals);
}

describe('CPU player', () => {
  it('presses keys like a person', () => {
    play(1, 'hard', 'normal', (input) => {
      expect([-1, 0, 1]).toContain(input.x);
      expect([-1, 0, 1]).toContain(input.y);
      expect(typeof input.shoot).toBe('boolean');
      expect(typeof input.fire).toBe('boolean');
    });
  });

  it('herds animals home, even on easy', () => {
    for (const level of ['easy', 'normal', 'hard']) {
      const points = play(2, null, level);
      expect(points.blue).toBeGreaterThanOrEqual(5);
    }
  });

  it('gets stronger with difficulty', () => {
    let hardWins = 0;
    for (let seed = 1; seed <= 12; seed++) if (roundWinner(play(seed, 'easy', 'hard')) === 'blue') hardWins++;
    expect(hardWins).toBeGreaterThanOrEqual(10);
  });
});

describe('session', () => {
  it('keeps a separate tally per mode and difficulty', () => {
    const s = createSession();
    startMatch(s);
    const twoPlayer = s.tally;
    s.players = 1;
    s.difficulty = 'hard';
    startMatch(s);
    expect(s.tally).not.toBe(twoPlayer);
    const hard = s.tally;
    startMatch(s);
    expect(s.tally).toBe(hard);
    s.players = 2;
    startMatch(s);
    expect(s.tally).toBe(twoPlayer);
  });

  it('names the CPU side in a 1-player game', () => {
    const s = createSession();
    expect(sideName(s, 'blue')).toBe('BLUE');
    expect(modeName(s)).toBe('2 PLAYERS');
    s.players = 1;
    expect(isCpu(s, 'blue')).toBe(true);
    expect(isCpu(s, 'red')).toBe(false);
    expect(sideName(s, 'blue')).toBe('CPU');
    expect(sideName(s, 'red')).toBe('RED');
    expect(modeName(s)).toBe('1 PLAYER vs CPU (NORMAL)');
  });
});
