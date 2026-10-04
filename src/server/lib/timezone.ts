/**
 * Timezone utilities for the ACM Incursion system.
 *
 * CANONICAL RULE:
 * All timestamps in the database are stored as UTC.
 * The application-facing timezone is Asia/Kolkata (IST, UTC+5:30).
 *
 * Conversion utilities will be fleshed out when needed by services.
 * These stubs document the intention and prevent accidental misuse.
 */

export const APP_TIMEZONE = 'Asia/Kolkata' as const
export const DB_TIMEZONE = 'UTC' as const

/**
 * Converts a UTC Date object to an IST-formatted display string.
 * For DISPLAY ONLY. Never use the result as a stored timestamp.
 */
export function toISTDisplay(utcDate: Date): string {
  return utcDate.toLocaleString('en-IN', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Returns current UTC timestamp.
 * Use this instead of `new Date()` throughout the codebase to make
 * timezone intent explicit.
 */
export function nowUtc(): Date {
  return new Date()
}

/**
 * Validates that startAt < endAt for an event.
 * Uses end-exclusive interval semantics.
 */
export function isValidEventInterval(startAt: Date, endAt: Date): boolean {
  return startAt < endAt
}

/**
 * End-exclusive overlap check.
 * Returns true if intervals [aStart, aEnd) and [bStart, bEnd) overlap.
 *
 * Two events at 10:00-11:00 and 11:00-12:00 will return FALSE.
 * This is the canonical overlap formula for the conflict engine.
 */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}
