// src/server/lib/conflict/time.util.ts

/**
 * Validates that startAt < endAt for an event.
 */
export function isValidEventInterval(startAt: Date, endAt: Date): boolean {
  return startAt.getTime() < endAt.getTime()
}

/**
 * End-exclusive overlap check.
 * Returns true if intervals [aStart, aEnd) and [bStart, bEnd) overlap.
 */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

/**
 * Calculates temporal overlap ratio.
 * overlapRatio = overlapDuration / min(duration(A), duration(B))
 * Clamped to [0,1].
 */
export function calculateOverlapRatio(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  if (!intervalsOverlap(aStart, aEnd, bStart, bEnd)) return 0.0

  const overlapStart = Math.max(aStart.getTime(), bStart.getTime())
  const overlapEnd = Math.min(aEnd.getTime(), bEnd.getTime())
  
  const overlapDuration = Math.max(0, overlapEnd - overlapStart)

  const durationA = aEnd.getTime() - aStart.getTime()
  const durationB = bEnd.getTime() - bStart.getTime()

  const minDuration = Math.min(durationA, durationB)
  
  if (minDuration <= 0) return 0.0

  const ratio = overlapDuration / minDuration
  return Math.min(Math.max(ratio, 0.0), 1.0)
}

/**
 * Tight turnaround check.
 * Returns true if the sequential gap is 0 <= gap < 30 minutes.
 * A sequential gap means one event ends before or when the other starts.
 */
export function isTightTurnaround(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  const gapThresholdMs = 30 * 60 * 1000 // 30 minutes in ms
  
  // Case 1: A ends before B starts
  if (aEnd.getTime() <= bStart.getTime()) {
    const gap = bStart.getTime() - aEnd.getTime()
    return gap >= 0 && gap < gapThresholdMs
  }
  
  // Case 2: B ends before A starts
  if (bEnd.getTime() <= aStart.getTime()) {
    const gap = aStart.getTime() - bEnd.getTime()
    return gap >= 0 && gap < gapThresholdMs
  }
  
  return false
}
