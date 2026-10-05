import { describe, it, expect } from 'vitest'
import { isValidEventInterval, intervalsOverlap, calculateOverlapRatio, isTightTurnaround } from '@/server/lib/conflict/time.util'

describe('Conflict Time Utils', () => {
  describe('intervalsOverlap', () => {
    it('detects exact overlap', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T12:00:00Z')
      expect(intervalsOverlap(aStart, aEnd, aStart, aEnd)).toBe(true)
    })

    it('detects partial overlap', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T12:00:00Z')
      const bStart = new Date('2026-10-01T11:00:00Z')
      const bEnd = new Date('2026-10-01T13:00:00Z')
      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

    it('detects nested overlap', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T14:00:00Z')
      const bStart = new Date('2026-10-01T11:00:00Z')
      const bEnd = new Date('2026-10-01T12:00:00Z')
      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

    it('does not overlap when boundary touching (end-exclusive)', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T11:00:00Z')
      const bStart = new Date('2026-10-01T11:00:00Z')
      const bEnd = new Date('2026-10-01T12:00:00Z')
      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false)
    })

    it('does not overlap when completely separate', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T11:00:00Z')
      const bStart = new Date('2026-10-01T12:00:00Z')
      const bEnd = new Date('2026-10-01T13:00:00Z')
      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false)
    })
  })

  describe('calculateOverlapRatio', () => {
    it('returns 1.0 for identical intervals', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T12:00:00Z')
      expect(calculateOverlapRatio(aStart, aEnd, aStart, aEnd)).toBe(1.0)
    })

    it('returns proportional ratio for partial overlap', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T12:00:00Z') // 2 hours
      const bStart = new Date('2026-10-01T11:00:00Z')
      const bEnd = new Date('2026-10-01T13:00:00Z') // 2 hours
      // Overlap is 11:00 to 12:00 (1 hour). min(2, 2) = 2. 1 / 2 = 0.5.
      expect(calculateOverlapRatio(aStart, aEnd, bStart, bEnd)).toBe(0.5)
    })

    it('returns 1.0 for nested interval (completely swallows the smaller one)', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T14:00:00Z') // 4 hours
      const bStart = new Date('2026-10-01T11:00:00Z')
      const bEnd = new Date('2026-10-01T12:00:00Z') // 1 hour
      // Overlap = 1 hr. min(4, 1) = 1. Ratio = 1 / 1 = 1.0
      expect(calculateOverlapRatio(aStart, aEnd, bStart, bEnd)).toBe(1.0)
    })

    it('returns 0.0 for boundary touching', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T11:00:00Z')
      const bStart = new Date('2026-10-01T11:00:00Z')
      const bEnd = new Date('2026-10-01T12:00:00Z')
      expect(calculateOverlapRatio(aStart, aEnd, bStart, bEnd)).toBe(0.0)
    })
  })

  describe('isTightTurnaround', () => {
    it('returns true for 0-minute gap (boundary touching)', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T11:00:00Z')
      const bStart = new Date('2026-10-01T11:00:00Z')
      const bEnd = new Date('2026-10-01T12:00:00Z')
      expect(isTightTurnaround(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

    it('returns true for 1-minute gap', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T11:00:00Z')
      const bStart = new Date('2026-10-01T11:01:00Z')
      const bEnd = new Date('2026-10-01T12:00:00Z')
      expect(isTightTurnaround(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

    it('returns true for 29-minute gap', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T11:00:00Z')
      const bStart = new Date('2026-10-01T11:29:00Z')
      const bEnd = new Date('2026-10-01T12:00:00Z')
      expect(isTightTurnaround(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

    it('returns false for exactly 30-minute gap', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T11:00:00Z')
      const bStart = new Date('2026-10-01T11:30:00Z')
      const bEnd = new Date('2026-10-01T12:00:00Z')
      expect(isTightTurnaround(aStart, aEnd, bStart, bEnd)).toBe(false)
    })

    it('returns false for >30-minute gap', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T11:00:00Z')
      const bStart = new Date('2026-10-01T12:00:00Z')
      const bEnd = new Date('2026-10-01T13:00:00Z')
      expect(isTightTurnaround(aStart, aEnd, bStart, bEnd)).toBe(false)
    })

    it('handles reverse order seamlessly (B ends before A starts)', () => {
      const bStart = new Date('2026-10-01T10:00:00Z')
      const bEnd = new Date('2026-10-01T11:00:00Z')
      const aStart = new Date('2026-10-01T11:15:00Z')
      const aEnd = new Date('2026-10-01T12:00:00Z')
      expect(isTightTurnaround(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

    it('returns false if intervals overlap (handled by overlap conflict instead)', () => {
      const aStart = new Date('2026-10-01T10:00:00Z')
      const aEnd = new Date('2026-10-01T11:00:00Z')
      const bStart = new Date('2026-10-01T10:30:00Z')
      const bEnd = new Date('2026-10-01T11:30:00Z')
      expect(isTightTurnaround(aStart, aEnd, bStart, bEnd)).toBe(false)
    })
  })
})
