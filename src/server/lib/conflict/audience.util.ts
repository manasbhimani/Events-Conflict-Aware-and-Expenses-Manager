// src/server/lib/conflict/audience.util.ts

const UNIVERSE_YEARS = [1, 2, 3, 4]
// We assume a nominal universe size for branches if one is ALL and the other is specific.
// This prevents the denominator from being unknown. Let's assume 10 branches in the college.
const NOMINAL_TOTAL_BRANCHES = 10

export function getExpandedAudience(years: number[], branches: string[], universeBranches: string[]): Set<string> {
  const y = years.length === 0 ? UNIVERSE_YEARS : years
  const b = branches.length === 0 ? universeBranches : branches
  
  const cells = new Set<string>()
  for (const year of y) {
    for (const branch of b) {
      cells.add(`${year}-${branch}`)
    }
  }
  return cells
}

export function calculateJaccardAudience(
  yearsA: number[], branchesA: string[],
  yearsB: number[], branchesB: string[]
): number {
  const isAllBranchesA = branchesA.length === 0
  const isAllBranchesB = branchesB.length === 0

  let universeBranches: string[] = []

  if (isAllBranchesA && isAllBranchesB) {
    // Both are all branches. Just use a dummy branch to represent ALL for intersection purposes.
    universeBranches = ['ALL_BRANCHES']
  } else if (isAllBranchesA) {
    // A is all, B is specific. To penalize A for being too broad compared to B, 
    // we assume the college has NOMINAL_TOTAL_BRANCHES. We pad the universe.
    universeBranches = [...new Set(branchesB)]
    let pad = 0
    while (universeBranches.length < NOMINAL_TOTAL_BRANCHES) {
      universeBranches.push(`PAD_${pad++}`)
    }
  } else if (isAllBranchesB) {
    universeBranches = [...new Set(branchesA)]
    let pad = 0
    while (universeBranches.length < NOMINAL_TOTAL_BRANCHES) {
      universeBranches.push(`PAD_${pad++}`)
    }
  } else {
    // Both specific, the universe is just their union
    universeBranches = [...new Set([...branchesA, ...branchesB])]
  }

  const setA = getExpandedAudience(yearsA, branchesA, universeBranches)
  const setB = getExpandedAudience(yearsB, branchesB, universeBranches)

  if (setA.size === 0 && setB.size === 0) return 1.0
  if (setA.size === 0 || setB.size === 0) return 0.0

  let intersectionSize = 0
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize

  if (unionSize === 0) return 0.0
  return intersectionSize / unionSize
}
