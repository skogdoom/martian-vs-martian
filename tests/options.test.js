import { describe, it, expect } from 'vitest';
import { LENGTHS, ROUNDS, DEFAULT_OPTIONS, step, sanitize, loadOptions, saveOptions, ammoFor, pickOptions } from '../src/options.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    data,
  };
}

describe('options', () => {
  it('picks the options out of a session', () => {
    expect(pickOptions({ length: 60, rounds: 1, ratio169: true, players: 2 })).toEqual({ length: 60, rounds: 1, ratio169: true });
  });

  it('offers 60/90/120 s and best of 1/3/5/7, defaulting to 90 s and best of 3', () => {
    expect(LENGTHS).toEqual([60, 90, 120]);
    expect(ROUNDS).toEqual([1, 3, 5, 7]);
    expect(DEFAULT_OPTIONS).toEqual({ length: 90, rounds: 3, ratio169: false });
  });

  it('steps through a list and stops at the ends', () => {
    expect(step(LENGTHS, 90, 1)).toBe(120);
    expect(step(LENGTHS, 120, 1)).toBe(120);
    expect(step(LENGTHS, 90, -1)).toBe(60);
    expect(step(LENGTHS, 60, -1)).toBe(60);
    expect(step(ROUNDS, 3, 1)).toBe(5);
    expect(step(ROUNDS, 1, -1)).toBe(1);
    expect(step(ROUNDS, 4, 1)).toBe(3); // not on offer: from the first
    expect(step(LENGTHS, undefined, -1)).toBe(60);
  });

  it('scales the ammo with the round length', () => {
    expect(LENGTHS.map(ammoFor)).toEqual([16, 24, 32]);
  });

  it('replaces anything not on offer with the default', () => {
    expect(sanitize({ length: 75, rounds: 4 })).toEqual(DEFAULT_OPTIONS);
    expect(sanitize(null)).toEqual(DEFAULT_OPTIONS);
    expect(sanitize({ length: 60, rounds: 7 })).toEqual({ length: 60, rounds: 7, ratio169: false });
    expect(sanitize({ ratio169: true }).ratio169).toBe(true);
    expect(sanitize({ ratio169: 'yes' }).ratio169).toBe(false);
  });

  it('is saved and loaded', () => {
    const storage = fakeStorage();
    saveOptions({ length: 120, rounds: 5, ratio169: true }, storage);
    expect(loadOptions(storage)).toEqual({ length: 120, rounds: 5, ratio169: true });
  });

  it('survives missing, broken or blocked storage', () => {
    expect(loadOptions(null)).toEqual(DEFAULT_OPTIONS);
    expect(loadOptions(fakeStorage({ 'martian-vs-martian.options': '{nope' }))).toEqual(DEFAULT_OPTIONS);
    const blocked = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('full');
      },
    };
    expect(loadOptions(blocked)).toEqual(DEFAULT_OPTIONS);
    expect(() => saveOptions({ length: 60, rounds: 1 }, blocked)).not.toThrow();
  });
});
