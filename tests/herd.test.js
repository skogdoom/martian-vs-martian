import { describe, it, expect } from 'vitest';
import { ANIMALS, WIDTH } from '../src/config.js';
import { createHerd, herdKinds } from '../src/logic/animal.js';

describe('the starting herd', () => {
  it('has the configured cows and lambs', () => {
    const herd = createHerd();
    expect(herd.filter((a) => a.kind === 'cow')).toHaveLength(ANIMALS.cows);
    expect(herd.filter((a) => a.kind === 'lamb')).toHaveLength(ANIMALS.lambs);
  });

  it('is a mirror image, so neither player starts nearer the cows', () => {
    const herd = createHerd();
    herd.forEach((a, i) => {
      const twin = herd[herd.length - 1 - i];
      expect(twin.kind).toBe(a.kind);
      expect(a.x + twin.x).toBeCloseTo(WIDTH, 5);
    });
  });

  it('mirrors for other herd sizes too, alternating kinds in each half', () => {
    const short = (k) => k.map((x) => (x === 'cow' ? 'C' : 'L')).join('');
    expect(short(herdKinds(4, 5))).toBe('LCLCLCLCL');
    expect(short(herdKinds(4, 7))).toBe('LCLCLLLCLCL');
    expect(short(herdKinds(3, 4))).toBe('LCLCLCL');
    expect(short(herdKinds(6, 2))).toBe('CLCCCCLC');
  });
});
