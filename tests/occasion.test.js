import { describe, it, expect } from 'vitest';
import { parseDateParam, occasionFor, gameDate, isMidsummer } from '../src/occasion.js';

describe('the date parameter', () => {
  it('takes a full date, or month and day in this year', () => {
    expect(parseDateParam('2026-12-24', 2030)).toEqual({ year: 2026, month: 12, day: 24 });
    expect(parseDateParam('12-31', 2030)).toEqual({ year: 2030, month: 12, day: 31 });
    expect(parseDateParam('7-4', 2030)).toEqual({ year: 2030, month: 7, day: 4 });
    expect(parseDateParam('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it('ignores anything that is not a real date', () => {
    for (const bad of [null, undefined, '', 'christmas', '2026-13-01', '12-32', '2026-02-30', '2025-02-29', '12/24']) {
      expect(parseDateParam(bad, 2026)).toBe(null);
    }
  });
});

describe('occasions', () => {
  const on = (year, month, day) => occasionFor({ year, month, day });

  it("Christmas on the 24th and 25th of December, New Year's Eve on the 31st", () => {
    expect(on(2026, 12, 24)).toBe('christmas');
    expect(on(2026, 12, 25)).toBe('christmas');
    expect(on(2026, 12, 31)).toBe('newYearsEve');
    expect(on(2026, 12, 26)).toBe(null);
    expect(on(2027, 1, 1)).toBe(null);
  });

  it('Swedish midsummer: the Friday between 19 and 25 June and the Saturday after', () => {
    // Midsummer Eve: 2026-06-19, 2027-06-25, 2025-06-20.
    for (const [y, d] of [
      [2026, 19],
      [2027, 25],
      [2025, 20],
    ]) {
      expect(on(y, 6, d)).toBe('midsummer');
      expect(on(y, 6, d + 1)).toBe('midsummer'); // Midsummer Day
      expect(on(y, 6, d + 2)).toBe(null);
      expect(on(y, 6, d - 1)).toBe(null);
    }
    // A Friday in June outside the window is not midsummer.
    expect(isMidsummer({ year: 2026, month: 6, day: 12 })).toBe(false);
    expect(isMidsummer({ year: 2026, month: 6, day: 26 })).toBe(false);
  });

  it('Halloween on 31 October', () => {
    expect(on(2026, 10, 31)).toBe('halloween');
    expect(on(2026, 10, 30)).toBe(null);
    expect(on(2026, 11, 1)).toBe(null);
  });

  it('4 May', () => {
    expect(on(2026, 5, 4)).toBe('mayTheFourth');
    expect(on(2026, 5, 5)).toBe(null);
    expect(on(2026, 4, 5)).toBe(null);
  });

  it('the game date is the parameter if there is a good one, otherwise today', () => {
    const now = new Date(2026, 5, 15); // 15 June 2026
    expect(gameDate('?date=12-25', now)).toEqual({ year: 2026, month: 12, day: 25 });
    expect(gameDate('?other=1&date=2027-12-31', now)).toEqual({ year: 2027, month: 12, day: 31 });
    expect(gameDate('?date=nonsense', now)).toEqual({ year: 2026, month: 6, day: 15 });
    expect(gameDate('', now)).toEqual({ year: 2026, month: 6, day: 15 });
  });
});
