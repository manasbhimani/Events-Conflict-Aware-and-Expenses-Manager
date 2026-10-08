import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { budgetService } from '@/server/services/budget.service'
import prisma from '@/server/lib/prisma'
import { UserRole, ExpenseStatus, AuditAction } from '@prisma/client'
import { ForbiddenError, SemesterLockedError, BusinessRuleError } from '@/server/lib/errors'

describe('Phase 6 Budget Service Integration Tests', () => {
  let superAdmin: any, coreUser: any, execUser: any, repUser: any, viewerUser: any
  let activeSemester: any, lockedSemester: any
  let logisticsCat: any, marketingCat: any, otherCat: any
  let club: any

  beforeAll(async () => {
    // Users
    superAdmin = await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } })
    coreUser = await prisma.user.findFirst({ where: { role: UserRole.ACM_CORE } })
    execUser = await prisma.user.findFirst({ where: { role: UserRole.ACM_EXEC } })
    repUser = await prisma.user.findFirst({ where: { role: UserRole.CLUB_REP } })
    viewerUser = await prisma.user.findFirst({ where: { role: UserRole.VIEWER } })
    club = await prisma.club.findFirst({ where: { isActive: true } })

    // Categories
    logisticsCat = await prisma.expenseCategory.findFirst({ where: { name: 'Logistics' } })
    if (!logisticsCat) logisticsCat = await prisma.expenseCategory.create({ data: { name: 'Logistics' } })
    
    marketingCat = await prisma.expenseCategory.findFirst({ where: { name: 'Marketing & Printing' } })
    if (!marketingCat) marketingCat = await prisma.expenseCategory.create({ data: { name: 'Marketing & Printing' } })

    otherCat = await prisma.expenseCategory.findFirst({ where: { name: 'Miscellaneous' } })
    if (!otherCat) otherCat = await prisma.expenseCategory.create({ data: { name: 'Miscellaneous' } })
  })

  beforeEach(async () => {
    // Find the test semesters to clean up their children
    const testSemesters = await prisma.semester.findMany({ where: { name: { startsWith: 'TestSem' } } })
    const testSemIds = testSemesters.map(s => s.id)

    if (testSemIds.length > 0) {
      await prisma.receipt.deleteMany({ where: { expense: { semesterId: { in: testSemIds } } } })
      await prisma.budgetAllocation.deleteMany({ where: { semesterId: { in: testSemIds } } })
      await prisma.expense.deleteMany({ where: { semesterId: { in: testSemIds } } })
      await prisma.semester.deleteMany({ where: { id: { in: testSemIds } } })
    }
    
    activeSemester = await prisma.semester.create({
      data: {
        name: 'TestSem Active',
        startDate: new Date('2026-08-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
        totalBudget: 50000,
        isLocked: false
      }
    })

    lockedSemester = await prisma.semester.create({
      data: {
        name: 'TestSem Locked',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-05-31T00:00:00Z'),
        totalBudget: 30000,
        isLocked: true
      }
    })
  })

  describe('Budget Allocation Mutations', () => {
    it('SUPER_ADMIN can create allocation', async () => {
      const alloc = await budgetService.createAllocation(superAdmin, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '10000.50'
      })
      expect(alloc.allocatedAmount.toFixed(2)).toBe('10000.50')
    })

    it('ACM_CORE can create allocation', async () => {
      const alloc = await budgetService.createAllocation(coreUser, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '5000'
      })
      expect(alloc.id).toBeDefined()
    })

    it('ACM_EXEC cannot create allocation', async () => {
      await expect(budgetService.createAllocation(execUser, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '5000'
      })).rejects.toThrow(ForbiddenError)
    })

    it('CLUB_REP cannot create allocation', async () => {
      await expect(budgetService.createAllocation(repUser, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '5000'
      })).rejects.toThrow(ForbiddenError)
    })

    it('Duplicate allocation prevention (BusinessRuleError)', async () => {
      await budgetService.createAllocation(coreUser, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '5000'
      })
      await expect(budgetService.createAllocation(coreUser, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '2000'
      })).rejects.toThrow(BusinessRuleError)
    })

    it('Prevents duplicate generic allocations under concurrency', async () => {
      // We fire two create allocations for the same generic category simultaneously
      const promise1 = budgetService.createAllocation(coreUser, {
        semesterId: activeSemester.id,
        categoryId: otherCat.id,
        allocatedAmount: '500'
      })
      const promise2 = budgetService.createAllocation(coreUser, {
        semesterId: activeSemester.id,
        categoryId: otherCat.id,
        allocatedAmount: '500'
      })
      
      const results = await Promise.allSettled([promise1, promise2])
      
      const fulfilled = results.filter(r => r.status === 'fulfilled')
      const rejected = results.filter(r => r.status === 'rejected')
      
      expect(fulfilled.length).toBe(1)
      expect(rejected.length).toBe(1)
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BusinessRuleError)
    })

    it('Mutation rejected on locked semester', async () => {
      await expect(budgetService.createAllocation(coreUser, {
        semesterId: lockedSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '5000'
      })).rejects.toThrow(SemesterLockedError)
    })

    it('Audit log created on allocation create', async () => {
      const alloc = await budgetService.createAllocation(coreUser, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '10000'
      })
      
      const log = await prisma.auditLog.findFirst({
        where: { targetId: alloc.id, action: AuditAction.BUDGET_ALLOCATE }
      })
      expect(log).toBeDefined()
      expect(log?.actorUserId).toBe(coreUser.id)
    })

    it('Delete allocation', async () => {
      const alloc = await budgetService.createAllocation(coreUser, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '10000'
      })
      
      await budgetService.deleteAllocation(coreUser, alloc.id)
      const found = await prisma.budgetAllocation.findUnique({ where: { id: alloc.id } })
      expect(found).toBeNull()
    })
  })

  describe('Budget Summary and Financial Calculations', () => {
    it('Aggregates correctly with APPROVED expenses, ignores DRAFT/REJECTED', async () => {
      await budgetService.createAllocation(coreUser, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '10000'
      })

      // Approved expense -> Counts
      await prisma.expense.create({
        data: {
          title: 'Approved',
          amount: 3000.50,
          date: new Date('2026-09-15T12:00:00Z'),
          status: ExpenseStatus.APPROVED,
          clubId: club.id,
          semesterId: activeSemester.id,
          categoryId: logisticsCat.id,
          createdByUserId: coreUser.id
        }
      })

      // Draft expense -> Excluded
      await prisma.expense.create({
        data: {
          title: 'Draft',
          amount: 5000,
          date: new Date('2026-10-05T12:00:00Z'),
          status: ExpenseStatus.DRAFT,
          clubId: club.id,
          semesterId: activeSemester.id,
          categoryId: logisticsCat.id,
          createdByUserId: coreUser.id
        }
      })

      // Rejected expense -> Excluded
      await prisma.expense.create({
        data: {
          title: 'Rejected',
          amount: 2000,
          date: new Date('2026-10-10T12:00:00Z'),
          status: ExpenseStatus.REJECTED,
          clubId: club.id,
          semesterId: activeSemester.id,
          categoryId: logisticsCat.id,
          createdByUserId: coreUser.id
        }
      })

      const summary = await budgetService.getSemesterSummary(coreUser, activeSemester.id)
      
      expect(summary.totalBudget).toBe('50000.00')
      expect(summary.totalAllocated).toBe('10000.00')
      expect(summary.unallocatedBudget).toBe('40000.00')
      expect(summary.totalSpent).toBe('3000.50') // Only the approved 3000.50
      expect(summary.remainingOverall).toBe('46999.50') // 50000 - 3000.50
      
      const logCat = summary.categoryBreakdown.find(c => c.categoryId === logisticsCat.id)
      expect(logCat).toBeDefined()
      expect(logCat?.allocatedAmount).toBe('10000.00')
      expect(logCat?.spentAmount).toBe('3000.50')
      expect(logCat?.remainingAmount).toBe('6999.50')
      expect(logCat?.overspent).toBe(false)
    })

    it('Detects category and semester overspending', async () => {
      await budgetService.createAllocation(coreUser, {
        semesterId: activeSemester.id,
        categoryId: logisticsCat.id,
        allocatedAmount: '10000'
      })

      // Spend 12000 in logistics
      await prisma.expense.create({
        data: {
          title: 'Overspend',
          amount: 12000,
          date: new Date('2026-09-15T12:00:00Z'),
          status: ExpenseStatus.APPROVED,
          clubId: club.id,
          semesterId: activeSemester.id,
          categoryId: logisticsCat.id,
          createdByUserId: coreUser.id
        }
      })

      // Spend 40000 in marketing (no allocation)
      await prisma.expense.create({
        data: {
          title: 'Unallocated spend',
          amount: 40000,
          date: new Date('2026-10-01T12:00:00Z'),
          status: ExpenseStatus.APPROVED,
          clubId: club.id,
          semesterId: activeSemester.id,
          categoryId: marketingCat.id,
          createdByUserId: coreUser.id
        }
      })

      const summary = await budgetService.getSemesterSummary(coreUser, activeSemester.id)
      
      // Total spent = 52000. Semester budget = 50000. Overspent overall.
      expect(summary.totalSpent).toBe('52000.00')
      expect(summary.remainingOverall).toBe('-2000.00')
      expect(summary.semesterOverspent).toBe(true)

      const logCat = summary.categoryBreakdown.find(c => c.categoryId === logisticsCat.id)
      expect(logCat?.overspent).toBe(true)
      expect(logCat?.remainingAmount).toBe('-2000.00')
      
      // Marketing was unallocated, so it should be in breakdown as unallocated and overspent
      const mktCat = summary.categoryBreakdown.find(c => c.categoryId === marketingCat.id)
      expect(mktCat).toBeDefined()
      expect(mktCat?.id).toContain('unallocated')
      expect(mktCat?.allocatedAmount).toBe('0.00')
      expect(mktCat?.spentAmount).toBe('40000.00')
      expect(mktCat?.overspent).toBe(true)
    })

    it('Monthly aggregation is correct based on UTC dates', async () => {
      await prisma.expense.create({
        data: { title: 'Ex 1', amount: 1500, date: new Date('2026-09-10T12:00:00Z'), status: ExpenseStatus.APPROVED, clubId: club.id, semesterId: activeSemester.id, categoryId: logisticsCat.id, createdByUserId: coreUser.id }
      })
      await prisma.expense.create({
        data: { title: 'Ex 2', amount: 2000, date: new Date('2026-09-25T12:00:00Z'), status: ExpenseStatus.APPROVED, clubId: club.id, semesterId: activeSemester.id, categoryId: logisticsCat.id, createdByUserId: coreUser.id }
      })
      await prisma.expense.create({
        data: { title: 'Ex 3', amount: 500, date: new Date('2026-10-05T12:00:00Z'), status: ExpenseStatus.APPROVED, clubId: club.id, semesterId: activeSemester.id, categoryId: logisticsCat.id, createdByUserId: coreUser.id }
      })

      const summary = await budgetService.getSemesterSummary(coreUser, activeSemester.id)
      
      expect(summary.monthlyBreakdown).toHaveLength(2)
      expect(summary.monthlyBreakdown[0].month).toBe('2026-09')
      expect(summary.monthlyBreakdown[0].amount).toBe('3500.00')
      expect(summary.monthlyBreakdown[1].month).toBe('2026-10')
      expect(summary.monthlyBreakdown[1].amount).toBe('500.00')
    })
  })
})
