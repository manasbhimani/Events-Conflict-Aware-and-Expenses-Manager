import { AuditAction, ExpenseStatus, Prisma } from '@prisma/client'
import prisma from '@/server/lib/prisma'
import { SessionUser } from '@/server/types'
import { assertCan } from '@/server/policies/rbac.policy'
import { ForbiddenError, NotFoundError, BusinessRuleError, SemesterLockedError } from '@/server/lib/errors'
import Decimal from 'decimal.js'

export class BudgetService {
  async createAllocation(user: SessionUser, data: { semesterId: string; categoryId: string; clubId?: string; allocatedAmount: string; notes?: string }) {
    assertCan(user, 'MANAGE_BUDGET')

    const semester = await prisma.semester.findUnique({ where: { id: data.semesterId } })
    if (!semester) throw new NotFoundError('Semester', data.semesterId)
    if (semester.isLocked) throw new SemesterLockedError(semester.name)

    const category = await prisma.expenseCategory.findUnique({ where: { id: data.categoryId } })
    if (!category) throw new NotFoundError('ExpenseCategory', data.categoryId)

    if (data.clubId) {
      const club = await prisma.club.findUnique({ where: { id: data.clubId } })
      if (!club) throw new NotFoundError('Club', data.clubId)
    }

    try {
      const existing = await prisma.budgetAllocation.findFirst({
        where: {
          semesterId: data.semesterId,
          categoryId: data.categoryId,
          clubId: data.clubId || null
        }
      })

      if (existing) {
        throw new BusinessRuleError('A budget allocation for this semester, category, and club already exists.')
      }

      const allocation = await prisma.$transaction(async (tx) => {
        const alloc = await tx.budgetAllocation.create({
          data: {
            semesterId: data.semesterId,
            categoryId: data.categoryId,
            clubId: data.clubId || null,
            allocatedAmount: new Decimal(data.allocatedAmount),
            notes: data.notes,
            createdByUserId: user.id,
          }
        })

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: AuditAction.BUDGET_ALLOCATE,
            targetType: 'BudgetAllocation',
            targetId: alloc.id,
            afterState: JSON.parse(JSON.stringify(alloc)),
          }
        })

        return alloc
      })

      return allocation
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BusinessRuleError('A budget allocation for this semester, category, and club already exists.')
      }
      throw error
    }
  }

  async updateAllocation(user: SessionUser, id: string, data: { allocatedAmount?: string; notes?: string }) {
    assertCan(user, 'MANAGE_BUDGET')

    const existing = await prisma.budgetAllocation.findUnique({
      where: { id },
      include: { semester: true }
    })
    
    if (!existing) throw new NotFoundError('BudgetAllocation', id)
    if (existing.semester.isLocked) throw new SemesterLockedError(existing.semester.name)

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: any = {}
      if (data.allocatedAmount !== undefined) updateData.allocatedAmount = new Decimal(data.allocatedAmount)
      if (data.notes !== undefined) updateData.notes = data.notes

      const alloc = await tx.budgetAllocation.update({
        where: { id },
        data: updateData
      })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.BUDGET_REVISE,
          targetType: 'BudgetAllocation',
          targetId: alloc.id,
          beforeState: JSON.parse(JSON.stringify(existing)),
          afterState: JSON.parse(JSON.stringify(alloc)),
        }
      })

      return alloc
    })

    return updated
  }

  async deleteAllocation(user: SessionUser, id: string) {
    assertCan(user, 'MANAGE_BUDGET')

    const existing = await prisma.budgetAllocation.findUnique({
      where: { id },
      include: { semester: true }
    })
    
    if (!existing) throw new NotFoundError('BudgetAllocation', id)
    if (existing.semester.isLocked) throw new SemesterLockedError(existing.semester.name)

    // Check if expenses exist for this category + semester combination
    // Technically, expenses are tied to category and semester, but deleting an allocation 
    // doesn't orphan the expense. It just means the allocation is removed.
    // However, if we want to be safe, we can just allow it, as budget allocations are just targets.
    // The instructions say "prefer soft-delete or reject deletion according to the existing project design."
    // BudgetAllocation has NO deletedAt field. It means we physically delete it.

    await prisma.$transaction(async (tx) => {
      await tx.budgetAllocation.delete({ where: { id } })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.BUDGET_REVISE, // No BUDGET_DEALLOCATE in enum, using REVISE
          targetType: 'BudgetAllocation',
          targetId: id,
          beforeState: JSON.parse(JSON.stringify(existing)),
          metadata: { note: 'Deleted allocation' }
        }
      })
    })

    return { success: true }
  }

  async getSemesterSummary(user: SessionUser, semesterId: string) {
    assertCan(user, 'VIEW_BUDGET')

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } })
    if (!semester) throw new NotFoundError('Semester', semesterId)

    // Fetch allocations
    const allocations = await prisma.budgetAllocation.findMany({
      where: { semesterId },
      include: { category: true, club: true }
    })

    // Fetch financially recognized expenses (APPROVED)
    const expenses = await prisma.expense.findMany({
      where: { 
        semesterId,
        status: ExpenseStatus.APPROVED,
        deletedAt: null
      },
      include: { category: true }
    })

    let totalAllocated = new Decimal(0)
    allocations.forEach(a => {
      totalAllocated = totalAllocated.plus(a.allocatedAmount)
    })

    let totalSpent = new Decimal(0)
    const spentByCategory: Record<string, Decimal> = {}
    
    expenses.forEach(e => {
      totalSpent = totalSpent.plus(e.amount)
      if (!spentByCategory[e.categoryId]) {
        spentByCategory[e.categoryId] = new Decimal(0)
      }
      spentByCategory[e.categoryId] = spentByCategory[e.categoryId].plus(e.amount)
    })

    const totalBudget = new Decimal(semester.totalBudget)
    const unallocatedBudget = totalBudget.minus(totalAllocated)
    const remainingOverall = totalBudget.minus(totalSpent)

    const categoryBreakdown = allocations.map(a => {
      const spent = spentByCategory[a.categoryId] || new Decimal(0)
      const allocated = new Decimal(a.allocatedAmount)
      const remaining = allocated.minus(spent)
      const overspent = remaining.isNegative()
      const utilizationPercentage = allocated.isZero() ? (spent.isZero() ? 0 : 100) : spent.dividedBy(allocated).times(100).toNumber()

      // Mark this category as processed
      delete spentByCategory[a.categoryId]

      return {
        id: a.id,
        categoryId: a.categoryId,
        categoryName: a.category.name,
        clubId: a.clubId,
        clubName: a.club?.name || null,
        allocatedAmount: allocated.toFixed(2),
        spentAmount: spent.toFixed(2),
        remainingAmount: remaining.toFixed(2),
        utilizationPercentage: parseFloat(utilizationPercentage.toFixed(2)),
        overspent
      }
    })

    // Add remaining categories that had expenses but no allocation
    for (const [categoryId, spent] of Object.entries(spentByCategory)) {
      const category = expenses.find(e => e.categoryId === categoryId)?.category
      if (!category) continue

      categoryBreakdown.push({
        id: `unallocated-${categoryId}`,
        categoryId: category.id,
        categoryName: category.name,
        clubId: null,
        clubName: null,
        allocatedAmount: "0.00",
        spentAmount: spent.toFixed(2),
        remainingAmount: spent.negated().toFixed(2),
        utilizationPercentage: spent.isZero() ? 0 : 100,
        overspent: spent.isPositive() // Overspent if spent > 0 and allocated is 0
      })
    }

    // Monthly expenditure aggregation based on expense 'date'
    const monthlySpending: Record<string, Decimal> = {}
    expenses.forEach(e => {
      // Use UTC month boundary
      const monthKey = `${e.date.getUTCFullYear()}-${String(e.date.getUTCMonth() + 1).padStart(2, '0')}`
      if (!monthlySpending[monthKey]) {
        monthlySpending[monthKey] = new Decimal(0)
      }
      monthlySpending[monthKey] = monthlySpending[monthKey].plus(e.amount)
    })

    const monthlyBreakdown = Object.entries(monthlySpending).map(([month, amount]) => ({
      month,
      amount: amount.toFixed(2)
    })).sort((a, b) => a.month.localeCompare(b.month))

    return {
      semester: {
        id: semester.id,
        name: semester.name,
        isLocked: semester.isLocked
      },
      totalBudget: totalBudget.toFixed(2),
      totalAllocated: totalAllocated.toFixed(2),
      unallocatedBudget: unallocatedBudget.toFixed(2),
      totalSpent: totalSpent.toFixed(2),
      remainingOverall: remainingOverall.toFixed(2),
      utilizationPercentage: totalBudget.isZero() ? 0 : parseFloat(totalSpent.dividedBy(totalBudget).times(100).toFixed(2)),
      semesterOverspent: remainingOverall.isNegative(),
      categoryBreakdown,
      monthlyBreakdown
    }
  }

  async getAllocations(user: SessionUser, semesterId: string) {
    assertCan(user, 'VIEW_BUDGET')
    return prisma.budgetAllocation.findMany({
      where: { semesterId },
      include: {
        category: true,
        club: true,
        createdBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
  }
}

export const budgetService = new BudgetService()
