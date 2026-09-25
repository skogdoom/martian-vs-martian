import { describe, it, expect } from 'vitest';
import { animalValue, penScore, scores, penCounts } from '../src/logic/scoring.js';

const animal = (kind, pen, owner) => ({ kind, pen, owner });

describe('scoring', () => {
  it('gives full value in the first deliverer pen', () => {
    expect(animalValue(animal('cow', 'red', 'red'), 'red')).toBe(2);
    expect(animalValue(animal('lamb', 'blue', 'blue'), 'blue')).toBe(1);
  });

  it('gives half value to stolen animals', () => {
    expect(animalValue(animal('cow', 'red', 'blue'), 'red')).toBe(1);
    expect(animalValue(animal('lamb', 'red', 'blue'), 'red')).toBe(0.5);
  });

  it('sums only animals in the pen', () => {
    const herd = [
      animal('cow', 'red', 'red'),
      animal('lamb', 'red', 'blue'),
      animal('cow', 'blue', 'red'),
      animal('lamb', 'blue', 'blue'),
      animal('cow', null, null),
      animal('lamb', null, 'red'), // being carried
    ];
    expect(penScore(herd, 'red')).toBe(2.5);
    expect(scores(herd)).toEqual({ red: 2.5, blue: 2 });
    expect(penCounts(herd, 'red')).toEqual({ cows: 1, lambs: 1 });
    expect(penCounts(herd, 'blue')).toEqual({ cows: 1, lambs: 1 });
  });
});
