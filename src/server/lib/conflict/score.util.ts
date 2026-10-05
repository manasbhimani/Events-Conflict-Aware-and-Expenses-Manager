// src/server/lib/conflict/score.util.ts
import { ConflictSeverity, EventType } from '@prisma/client'

export function calculateSizeFactor(attendeesA: number, attendeesB: number): number {
  // Normalize the size factor to [0,1].
  // We'll use Math.min(A+B, 1000) / 1000 to sensibly cap very large numbers without throwing NaN
  const total = Math.max(0, attendeesA) + Math.max(0, attendeesB)
  const MAX_EXPECTED = 1000
  return Math.min(total, MAX_EXPECTED) / MAX_EXPECTED
}

export function calculateSameTypeFactor(typeA: EventType, typeB: EventType): number {
  return typeA === typeB ? 1.0 : 0.0
}

export function calculateConflictScore(
  jaccardAudience: number,
  overlapRatio: number,
  sameType: number,
  sizeFactor: number
): number {
  const score = 0.4 * jaccardAudience + 0.3 * overlapRatio + 0.2 * sameType + 0.1 * sizeFactor
  return Math.min(Math.max(score, 0.0), 1.0)
}

export function determineSeverity(score: number): ConflictSeverity {
  if (score >= 0.70) return 'HIGH'
  if (score >= 0.40) return 'MEDIUM'
  return 'LOW'
}
