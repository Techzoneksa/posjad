// Shared Saudi business-day helper. Isomorphic (server + client).
//
// Asia/Riyadh is UTC+3 with no DST, so we shift by +3h instead of parsing
// locale strings. NEVER use `new Date(date.toLocaleString(..., { timeZone }))`
// — it produces an Invalid Date in many runtimes.

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Today in Riyadh as YYYY-MM-DD (Gregorian). */
export function riyadhToday(): string {
  return new Date(Date.now() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

/** Convert a UTC Date/ISO to its Riyadh-local YYYY-MM-DD. */
export function toRiyadhDay(value: Date | string | number): string {
  const ms = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(ms)) return riyadhToday();
  return new Date(ms + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

/** [startUtcIso, endUtcIso) covering a single Riyadh business day. */
export function riyadhDayRange(date?: string): { from: string; to: string } {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : riyadhToday();
  const fromUtc = new Date(`${d}T00:00:00+03:00`);
  const toUtc = new Date(fromUtc.getTime() + 24 * 60 * 60 * 1000);
  return { from: fromUtc.toISOString(), to: toUtc.toISOString() };
}

/** Date prefix used for daily order/invoice numbering (YYYYMMDD, Riyadh). */
export function riyadhDatePrefix(value: Date | string | number = Date.now()): string {
  return toRiyadhDay(value).replace(/-/g, "");
}
