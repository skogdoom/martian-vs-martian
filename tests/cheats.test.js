import { describe, it, expect } from 'vitest';
import { CHEAT_CODES, createCheatListener, createCheats, toggleCheat } from '../src/cheats.js';
import { createRound } from '../src/logic/round.js';

/** Type `codes`; returns what the listener said for each. */
function type(codes, listener = createCheatListener()) {
  return codes.map((c) => listener.push(c));
}

describe('cheat codes', () => {
  it('the Konami code completes the golden herd', () => {
    const out = type(CHEAT_CODES.goldenHerd);
    expect(out.at(-1).done).toBe('goldenHerd');
    expect(out.slice(0, -1).every((r) => r.done === null)).toBe(true);
  });

  it('IDKFA completes the lasers', () => {
    expect(type(['KeyI', 'KeyD', 'KeyK', 'KeyF', 'KeyA']).at(-1).done).toBe('lasers');
  });

  it('IDDQD completes the shields, even though it starts like IDKFA', () => {
    const out = type(['KeyI', 'KeyD', 'KeyD', 'KeyQ', 'KeyD']);
    expect(out.at(-1).done).toBe('shields');
    expect(out.map((r) => r.swallow)).toEqual([false, true, true, true, true]);
  });

  it('works after other keys, and after a false start', () => {
    expect(type(['ArrowDown', 'KeyX', 'KeyI', 'KeyD', 'KeyI', 'KeyD', 'KeyK', 'KeyF', 'KeyA']).at(-1).done).toBe('lasers');
    expect(type(['ArrowUp', ...CHEAT_CODES.goldenHerd]).at(-1).done).toBe('goldenHerd');
  });

  it('a wrong key breaks it', () => {
    expect(type(['KeyI', 'KeyD', 'KeyX', 'KeyF', 'KeyA']).at(-1).done).toBe(null);
  });

  it('swallows keys only once a code is clearly being typed', () => {
    // IDKFA: everything after the I, so F doesn't go full screen and D and A don't change the menu.
    expect(type(['KeyI', 'KeyD', 'KeyK', 'KeyF', 'KeyA']).map((r) => r.swallow)).toEqual([false, true, true, true, true]);
    // Konami: the arrows still move the menu; the A after the B doesn't.
    const konami = type(CHEAT_CODES.goldenHerd).map((r) => r.swallow);
    expect(konami.slice(0, 9).every((s) => !s)).toBe(true);
    expect(konami.at(-1)).toBe(true);
    // Ordinary menu use is never swallowed.
    expect(type(['KeyD', 'KeyA', 'KeyF', 'Enter', 'ArrowDown']).some((r) => r.swallow)).toBe(false);
  });

  it('can be typed again (to switch it back off)', () => {
    const l = createCheatListener();
    type(CHEAT_CODES.lasers, l);
    expect(type(CHEAT_CODES.lasers, l).at(-1).done).toBe('lasers');
  });
});

describe('cheats in a round', () => {
  it('lasers and shields exclude each other: one power-up each', () => {
    const cheats = createCheats();
    expect(toggleCheat(cheats, 'lasers')).toBe(true);
    expect(toggleCheat(cheats, 'shields')).toBe(true);
    expect(cheats).toMatchObject({ lasers: false, shields: true });
    expect(toggleCheat(cheats, 'goldenHerd')).toBe(true);
    expect(cheats.shields).toBe(true);
    expect(toggleCheat(cheats, 'shields')).toBe(false);
  });

  it('every round starts with them', () => {
    const plain = createRound(1);
    expect(plain.world.powers).toEqual({ red: null, blue: null });
    expect(plain.world.animals.some((a) => a.golden)).toBe(false);
    const r = createRound(1, 90, { goldenHerd: true, shields: true });
    expect(r.world.powers.red?.type).toBe('shield');
    expect(r.world.powers.blue?.type).toBe('shield');
    expect(r.world.animals.every((a) => a.golden)).toBe(true);
    expect(createRound(1, 90, { lasers: true }).world.powers.blue?.type).toBe('laser');
  });
});
