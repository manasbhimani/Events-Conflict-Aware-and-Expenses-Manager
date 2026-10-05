import { describe, it, expect } from 'vitest'
import { EventType } from '@prisma/client'
import { calculateConflictScore, determineSeverity, calculateSizeFactor, calculateSameTypeFactor } from '@/server/lib/conflict/score.util'

describe('Conflict Score Utils', () => {
  it('calculateConflictScore uses exact weighted calculation', () => {
    // 0.4 * 0.5 + 0.3 * 1.0 + 0.2 * 1.0 + 0.1 * 0.8
    // = 0.20 + 0.30 + 0.20 + 0.08 = 0.78
    expect(calculateConflictScore(0.5, 1.0, 1.0, 0.8)).toBe(0.78)
  })

  it('clamps score to [0, 1]', () => {
    expect(calculateConflictScore(2.0, 2.0, 2.0, 2.0)).toBe(1.0)
    expect(calculateConflictScore(-1.0, -1.0, -1.0, -1.0)).toBe(0.0)
  })

  it('determineSeverity returns correct thresholds', () => {
    expect(determineSeverity(0.70)).toBe('HIGH')
    expect(determineSeverity(0.85)).toBe('HIGH')
    expect(determineSeverity(0.69)).toBe('MEDIUM')
    expect(determineSeverity(0.40)).toBe('MEDIUM')
    expect(determineSeverity(0.39)).toBe('LOW')
    expect(determineSeverity(0.10)).toBe('LOW')
  })

  it('calculateSizeFactor normalizes properly', () => {
    expect(calculateSizeFactor(250, 250)).toBe(0.5) // (250+250)/1000 = 0.5
    expect(calculateSizeFactor(600, 600)).toBe(1.0) // clamped to 1.0
    expect(calculateSizeFactor(0, 0)).toBe(0.0)
  })

  it('calculateSameTypeFactor works', () => {
    expect(calculateSameTypeFactor(EventType.WORKSHOP, EventType.WORKSHOP)).toBe(1.0)
    expect(calculateSameTypeFactor(EventType.WORKSHOP, EventType.HACKATHON)).toBe(0.0)
  })
})
