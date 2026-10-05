// Special days: a Santa hat on the moon and snow at Christmas, fireworks on
// New Year's Eve. The date is today's, or for trying it out, the `date` query
// parameter: ?date=2026-12-24 or just ?date=12-31 (month and day).

/** Read a `date` query value. Returns { month, day } (month 1-12), or null if
 * there is none or it isn't a real date. */
export function parseDateParam(value) {
  const m = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const year = m[1] ? Number(m[1]) : 2024; // a leap year, so 02-29 is allowed without one
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null; // e.g. 02-30
  return { month, day };
}

/** The occasion on a date: 'christmas', 'newYearsEve' or null. */
export function occasionFor({ month, day }) {
  if (month === 12 && (day === 24 || day === 25)) return 'christmas';
  if (month === 12 && day === 31) return 'newYearsEve';
  return null;
}

/** The date the game runs on: the query parameter if it is a real date, otherwise today. */
export function gameDate(search = globalThis.location?.search ?? '', now = new Date()) {
  let param = null;
  try {
    param = parseDateParam(new URLSearchParams(search).get('date'));
  } catch {
    // no usable query string: today it is
  }
  return param ?? { month: now.getMonth() + 1, day: now.getDate() };
}

/** Picked once when the page loads, like the moon's phase. */
export const occasion = occasionFor(gameDate());
