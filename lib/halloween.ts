/** Last moment the Halloween banner shows: end of 31 Oct 2026 in India (IST, UTC+5:30). */
export const HALLOWEEN_ENDS_AT = Date.parse("2026-10-31T23:59:59.999+05:30");

export function halloweenActive(now: number) {
  return now <= HALLOWEEN_ENDS_AT;
}

export const HALLOWEEN_DISMISS_KEY = "gridfinity:halloween-2026-dismissed";
