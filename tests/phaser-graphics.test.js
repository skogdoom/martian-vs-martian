import { describe, expect, it, vi } from 'vitest';
import { createGraphicsPreferences, GRAPHICS_KEY } from '../src/phaser/graphicsPreferences.js';
import { POWERUP } from '../src/config.js';
import { FRAME_SHEETS } from '../src/phaser/sprites/adapter.js';
import world from '../assets/cartoon/world.json';
import extras from '../assets/cartoon/extras.json';
import logo from '../assets/cartoon/logo.json';
import fx from '../assets/cartoon/fx.json';

describe('graphics preferences are independent of game options', () => {
  it('defaults to cartoon and persists the classic choice through reload', () => {
    const values = new Map([['martian-vs-martian.options', '{"length":120,"rounds":7,"ratio169":true}']]);
    const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
    const preferences = createGraphicsPreferences(storage);
    expect(preferences.classic).toBe(false);
    preferences.toggle();
    expect(createGraphicsPreferences(storage).classic).toBe(true);
    expect(values.get('martian-vs-martian.options')).toBe('{"length":120,"rounds":7,"ratio169":true}');
  });

  it('continues to switch styles when reading and writing storage throw', () => {
    const blocked = () => {
      throw new Error('Storage unavailable');
    };
    const preferences = createGraphicsPreferences({ getItem: blocked, setItem: blocked });
    expect(preferences.toggle()).toBe(true);
    expect(preferences.toggle()).toBe(false);
  });

  it('rejects a malformed saved choice', () => {
    for (const value of ['{', 'null', '{"classic":"true"}', '{}']) expect(createGraphicsPreferences({ getItem: () => value }).classic).toBe(false);
  });

  it('lets review URLs override the saved choice without overwriting it', () => {
    const storage = { getItem: () => '{"classic":true}', setItem: vi.fn() };
    expect(createGraphicsPreferences(storage, '?graphics=cartoon').classic).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(createGraphicsPreferences(storage, '?graphics=classic').classic).toBe(true);
    expect(GRAPHICS_KEY).toBe('martian-vs-martian.graphics');
  });

  it('releases style listeners when their views leave the scene', () => {
    const preferences = createGraphicsPreferences(null);
    const changed = vi.fn();
    const unsubscribe = preferences.subscribe(changed);
    preferences.toggle();
    expect(changed).toHaveBeenCalledWith(true);
    unsubscribe();
    preferences.toggle();
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('cartoon atlas coverage and sampling bounds', () => {
  it('has distinct frames for every powerup and gameplay animation state', () => {
    for (const type of POWERUP.types) expect(FRAME_SHEETS[`power-${type}`]).toBeTruthy();
    for (const kind of ['cow', 'lamb']) for (const suffix of ['', '-walk-a', '-walk-b', '-aloft']) expect(FRAME_SHEETS[kind + suffix]).toBeTruthy();
    for (const side of ['red', 'blue']) for (const suffix of ['', '-blink']) expect(FRAME_SHEETS[`saucer-${side}${suffix}`]).toBeTruthy();
    for (const name of [
      'wolf',
      'wolf-walk-a',
      'wolf-walk-b',
      'wolf-eat',
      'wolf-howl',
      'alien',
      'alien-panic',
      'parachute',
      'package',
      'crate',
      'timebomb',
      'rocket',
      'bomb',
      'laser',
      'barn',
      'fence',
      'santa-hat',
      'snowflake',
      'maypole',
      'pumpkin',
      'bat',
      'battle-station',
      'fighter',
      'logo',
    ])
      expect(FRAME_SHEETS[name], name).toBeTruthy();
  });

  it('keeps frames inside power-of-two atlases with transparent sampling gutters', () => {
    const names = new Set();
    for (const atlas of [world, extras, logo, fx]) {
      const { w, h } = atlas.meta.size;
      expect(w & (w - 1)).toBe(0);
      expect(h & (h - 1)).toBe(0);
      const occupied = [];
      for (const [name, { frame: f }] of Object.entries(atlas.frames)) {
        expect(names.has(name), name).toBe(false);
        names.add(name);
        expect(f.x).toBeGreaterThanOrEqual(4);
        expect(f.y).toBeGreaterThanOrEqual(4);
        expect(f.x + f.w).toBeLessThanOrEqual(w - 4);
        expect(f.y + f.h).toBeLessThanOrEqual(h - 4);
        for (const other of occupied)
          expect(f.x >= other.x + other.w + 4 || other.x >= f.x + f.w + 4 || f.y >= other.y + other.h + 4 || other.y >= f.y + f.h + 4).toBe(true);
        occupied.push(f);
      }
    }
    expect(names.size).toBe(81);
  });
});
