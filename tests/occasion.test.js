import { describe, it, expect } from 'vitest';
import { parseDateParam, occasionFor, gameDate } from '../src/occasion.js';

describe('the date parameter', () => {
  it('takes a full date or just month and day', () => {
    expect(parseDateParam('2026-12-24')).toEqual({ month: 12, day: 24 });
    expect(parseDateParam('12-31')).toEqual({ month: 12, day: 31 });
    expect(parseDateParam('7-4')).toEqual({ month: 7, day: 4 });
    expect(parseDateParam('02-29')).toEqual({ month: 2, day: 29 });
  });

  it('ignores anything that is not a real date', () => {
    for (const bad of [null, undefined, '', 'christmas', '2026-13-01', '12-32', '2026-02-30', '2025-02-29', '12/24']) {
      expect(parseDateParam(bad)).toBe(null);
    }
  });
});

describe('occasions', () => {
  it("Christmas on the 24th and 25th of December, New Year's Eve on the 31st", () => {
    expect(occasionFor({ month: 12, day: 24 })).toBe('christmas');
    expect(occasionFor({ month: 12, day: 25 })).toBe('christmas');
    expect(occasionFor({ month: 12, day: 31 })).toBe('newYearsEve');
    expect(occasionFor({ month: 12, day: 26 })).toBe(null);
    expect(occasionFor({ month: 1, day: 1 })).toBe(null);
  });

  it('the game date is the parameter if there is a good one, otherwise today', () => {
    const now = new Date(2026, 5, 15); // 15 June
    expect(gameDate('?date=12-25', now)).toEqual({ month: 12, day: 25 });
    expect(gameDate('?other=1&date=2026-12-31', now)).toEqual({ month: 12, day: 31 });
    expect(gameDate('?date=nonsense', now)).toEqual({ month: 6, day: 15 });
    expect(gameDate('', now)).toEqual({ month: 6, day: 15 });
  });
});
