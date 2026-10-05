// Special days: a full, smiling moon in a Santa hat and snow at Christmas,
// fireworks on New Year's Eve, maypoles for flagpoles at Swedish midsummer.
// The date is today's, or for trying it out, the `date` query parameter:
// ?date=2026-12-24, or just ?date=12-31 (month and day, this year).

/** Read a `date` query value. Returns { year, month, day } (month 1-12), or
 * null if there is none or it isn't a real date. Without a year, `thisYear`. */
export function parseDateParam(value, thisYear = new Date().getFullYear()) {
  const m = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const year = m[1] ? Number(m[1]) : thisYear;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null; // e.g. 02-30
  return { year, month, day };
}

/** Swedish midsummer: Midsummer Eve is the Friday between 19 and 25 June,
 * Midsummer Day the Saturday after it. */
export function isMidsummer({ year, month, day }) {
  if (month !== 6) return false;
  const weekday = new Date(year, 5, day).getDay(); // 5 Friday, 6 Saturday
  return (weekday === 5 && day >= 19 && day <= 25) || (weekday === 6 && day >= 20 && day <= 26);
}

/** The occasion on a date: 'christmas', 'newYearsEve', 'midsummer' or null. */
export function occasionFor(date) {
  const { month, day } = date;
  if (month === 12 && (day === 24 || day === 25)) return 'christmas';
  if (month === 12 && day === 31) return 'newYearsEve';
  if (isMidsummer(date)) return 'midsummer';
  return null;
}

/** The date the game runs on: the query parameter if it is a real date, otherwise today. */
export function gameDate(search = globalThis.location?.search ?? '', now = new Date()) {
  let param = null;
  try {
    param = parseDateParam(new URLSearchParams(search).get('date'), now.getFullYear());
  } catch {
    // no usable query string: today it is
  }
  return param ?? { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** Picked once when the page loads, like the moon's phase. */
export const occasion = occasionFor(gameDate());
