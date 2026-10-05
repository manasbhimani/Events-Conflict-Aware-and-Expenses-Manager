import { describe, it, expect } from 'vitest'
import { calculateJaccardAudience } from '@/server/lib/conflict/audience.util'

describe('calculateJaccardAudience', () => {
  it('returns 1.0 for completely identical audiences', () => {
    expect(calculateJaccardAudience([1, 2], ['CSE', 'IT'], [1, 2], ['CSE', 'IT'])).toBe(1.0)
  })

  it('returns 0.0 for completely disjoint audiences', () => {
    expect(calculateJaccardAudience([1], ['CSE'], [2], ['CSE'])).toBe(0.0) // different years
    expect(calculateJaccardAudience([1], ['CSE'], [1], ['IT'])).toBe(0.0)  // different branches
  })

  it('calculates partial similarity correctly', () => {
    // A: (1,CSE), (1,IT), (2,CSE), (2,IT)
    // B: (2,CSE), (2,IT), (3,CSE), (3,IT)
    // Intersection: (2,CSE), (2,IT) => size 2
    // Union: 1, 2, 3 x CSE, IT => size 6
    // Jaccard: 2 / 6 = 0.3333...
    const score = calculateJaccardAudience([1, 2], ['CSE', 'IT'], [2, 3], ['CSE', 'IT'])
    expect(score).toBeCloseTo(0.333, 3)
  })

  it('handles wildcard years (empty array = ALL years)', () => {
    // A: All years, CSE => 4 cells (assuming UNIVERSE_YEARS = [1,2,3,4])
    // B: Year 1, CSE => 1 cell
    // Intersection: (1,CSE) => 1
    // Union: 4 cells
    // Jaccard = 0.25
    expect(calculateJaccardAudience([], ['CSE'], [1], ['CSE'])).toBe(0.25)
  })

  it('handles wildcard branches', () => {
    // A: Year 1, ALL branches
    // B: Year 1, CSE
    // Since B is specific to CSE, our pad logic gives an assumed universe of size NOMINAL_TOTAL_BRANCHES = 10.
    // So A has 1x10 cells = 10 cells. B has 1x1 cell = 1 cell.
    // Intersection = 1 cell.
    // Union = 10 cells. Jaccard = 1/10 = 0.1
    expect(calculateJaccardAudience([1], [], [1], ['CSE'])).toBe(0.1)
  })

  it('handles both wildcard audiences perfectly', () => {
    // Both are targeting everything. Jaccard should be 1.0.
    expect(calculateJaccardAudience([], [], [], [])).toBe(1.0)
  })

  it('returns 1.0 for empty sets (fallback)', () => {
    expect(calculateJaccardAudience([], ['NON_EXISTENT_IF_POSSIBLE'], [], ['NON_EXISTENT_IF_POSSIBLE'])).toBe(1.0)
  })
})
