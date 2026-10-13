import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { scenarios, sessionTrace, fixturePath, snapshot } from '../scripts/baseline/logic.js';
import { createWorld, spawnDrop } from '../src/logic/world.js';

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));

describe('preserved Pixi migration baseline', () => {
  for (const [name, run] of Object.entries(scenarios)) {
    it(`replays ${name} with the original input, ordered events and state trace`, () => {
      expect(run()).toEqual(fixture.scenarios[name]);
    });
  }
  it('preserves sudden death and per-mode tally through play again', () => {
    expect(sessionTrace()).toEqual(fixture.session);
  });
  it('distinguishes two entities with the same application ID in hook references', () => {
    const world = createWorld(7);
    spawnDrop(world, 'laser', true);
    spawnDrop(world, 'shield', true);
    world.hooks.red.target = world.drops[1];
    expect(snapshot(world).world.hooks.red.target).toEqual({ $ref: 'drops/1' });
  });
});
