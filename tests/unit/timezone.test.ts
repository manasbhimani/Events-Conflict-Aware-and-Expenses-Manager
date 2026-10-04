import { describe, it, expect } from 'vitest'
import { intervalsOverlap, isValidEventInterval } from '@/server/lib/timezone'

/**
 * Unit tests for the end-exclusive interval logic used by the conflict engine.
 *
 * All times are UTC. IST references are in comments for readability.
 * IST = UTC + 5:30
 */
describe('End-Exclusive Interval Logic (Conflict Engine Invariant)', () => {

  describe('Core overlap formula: A.start < B.end AND B.start < A.end', () => {

    it('detects the demo conflict scenario overlap (Hackathon vs Workshop)', () => {
      // Hackathon:  4:00 PM – 8:00 PM IST = 10:30 – 14:30 UTC
      const aStart = new Date('2026-09-20T10:30:00.000Z')
      const aEnd   = new Date('2026-09-20T14:30:00.000Z')
      // Workshop:   5:00 PM – 7:00 PM IST = 11:30 – 13:30 UTC
      const bStart = new Date('2026-09-20T11:30:00.000Z')
      const bEnd   = new Date('2026-09-20T13:30:00.000Z')

      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

    it('is symmetric: B overlapping A gives same result as A overlapping B', () => {
      const aStart = new Date('2026-09-20T10:30:00.000Z')
      const aEnd   = new Date('2026-09-20T14:30:00.000Z')
      const bStart = new Date('2026-09-20T11:30:00.000Z')
      const bEnd   = new Date('2026-09-20T13:30:00.000Z')

      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(
        intervalsOverlap(bStart, bEnd, aStart, aEnd)
      )
    })

    it('detects partial-front overlap', () => {
      // A: 10:00 – 12:00, B: 11:00 – 13:00 → overlap 11:00–12:00
      const aStart = new Date('2026-09-20T04:30:00.000Z') // 10:00 IST
      const aEnd   = new Date('2026-09-20T06:30:00.000Z') // 12:00 IST
      const bStart = new Date('2026-09-20T05:30:00.000Z') // 11:00 IST
      const bEnd   = new Date('2026-09-20T07:30:00.000Z') // 13:00 IST
      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

    it('detects complete containment overlap', () => {
      // A: 10:00 – 14:00, B: 11:00 – 13:00 (B fully inside A)
      const aStart = new Date('2026-09-20T04:30:00.000Z')
      const aEnd   = new Date('2026-09-20T08:30:00.000Z')
      const bStart = new Date('2026-09-20T05:30:00.000Z')
      const bEnd   = new Date('2026-09-20T07:30:00.000Z')
      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

  })

  describe('Non-conflicting cases (end-exclusive boundary)', () => {

    it('does NOT flag back-to-back events: 10:00–11:00 then 11:00–12:00', () => {
      // This is the canonical end-exclusive test: adjacent events must NOT conflict.
      const aStart = new Date('2026-09-20T04:30:00.000Z') // 10:00 IST
      const aEnd   = new Date('2026-09-20T05:30:00.000Z') // 11:00 IST (aEnd = bStart)
      const bStart = new Date('2026-09-20T05:30:00.000Z') // 11:00 IST
      const bEnd   = new Date('2026-09-20T06:30:00.000Z') // 12:00 IST

      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false)
    })

    it('does NOT flag events on completely different days', () => {
      const aStart = new Date('2026-09-20T04:30:00.000Z')
      const aEnd   = new Date('2026-09-20T08:30:00.000Z')
      const bStart = new Date('2026-09-21T04:30:00.000Z')
      const bEnd   = new Date('2026-09-21T08:30:00.000Z')

      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false)
    })

    it('does NOT flag events where one ends before the other starts', () => {
      // A: 9:00–10:00, B: 12:00–14:00 — clearly separate
      const aStart = new Date('2026-09-20T03:30:00.000Z')
      const aEnd   = new Date('2026-09-20T04:30:00.000Z')
      const bStart = new Date('2026-09-20T06:30:00.000Z')
      const bEnd   = new Date('2026-09-20T08:30:00.000Z')

      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false)
    })

  })

  describe('Edge cases', () => {

    it('detects overlap by exactly 1 millisecond', () => {
      // A ends at 11:00:00.001, B starts at 11:00:00.000 — 1ms overlap
      const aStart = new Date('2026-09-20T04:30:00.000Z')
      const aEnd   = new Date('2026-09-20T05:30:00.001Z') // 1ms past 11:00 IST
      const bStart = new Date('2026-09-20T05:30:00.000Z') // exactly 11:00 IST
      const bEnd   = new Date('2026-09-20T06:30:00.000Z')

      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true)
    })

    it('does NOT overlap when difference is exactly 0ms (aEnd === bStart)', () => {
      const t = new Date('2026-09-20T05:30:00.000Z')
      const aStart = new Date('2026-09-20T04:30:00.000Z')
      const aEnd   = t
      const bStart = t
      const bEnd   = new Date('2026-09-20T06:30:00.000Z')

      expect(intervalsOverlap(aStart, aEnd, bStart, bEnd)).toBe(false)
    })

  })

  describe('Event interval validation', () => {

    it('accepts valid interval where start < end', () => {
      expect(isValidEventInterval(
        new Date('2026-09-20T04:30:00.000Z'),
        new Date('2026-09-20T08:30:00.000Z')
      )).toBe(true)
    })

    it('rejects zero-duration event (start === end)', () => {
      const t = new Date('2026-09-20T05:30:00.000Z')
      expect(isValidEventInterval(t, t)).toBe(false)
    })

    it('rejects backward event (start > end)', () => {
      expect(isValidEventInterval(
        new Date('2026-09-20T08:30:00.000Z'),
        new Date('2026-09-20T04:30:00.000Z')
      )).toBe(false)
    })

  })

})
