import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient, UserRole, ExpenseStatus, AuditAction } from '@prisma/client'
import { expenseService } from '@/server/services/expense.service'
import { receiptService } from '@/server/services/receipt.service'
import { ForbiddenError, NotFoundError, BusinessRuleError, SemesterLockedError } from '@/server/lib/errors'
import type { SessionUser } from '@/server/types'

const prisma = new PrismaClient()

describe('Phase 5 ExpenseService Integration Tests', () => {
  let superAdminUser: SessionUser
  let acmCoreUser: SessionUser
  let acmExecUser: SessionUser
  let codingClubRepUser: SessionUser
  let roboticsClubRepUser: SessionUser
  let viewerUser: SessionUser

  let acmClubId: string
  let codingClubId: string
  let roboticsClubId: string
  let catLogisticsId: string
  let activeSemesterId: string
  let lockedSemesterId: string

  beforeAll(async () => {
    const [sa, core, exec, codingRep, roboticsRep, viewer] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'superadmin@acm-demo.college.edu' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'core@acm-demo.college.edu' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'exec@acm-demo.college.edu' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'rep.coding@acm-demo.college.edu' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'rep.robotics@acm-demo.college.edu' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'viewer@acm-demo.college.edu' } }),
    ])

    superAdminUser = { id: sa.id, email: sa.email, name: sa.name, role: sa.role, clubId: sa.clubId }
    acmCoreUser = { id: core.id, email: core.email, name: core.name, role: core.role, clubId: core.clubId }
    acmExecUser = { id: exec.id, email: exec.email, name: exec.name, role: exec.role, clubId: exec.clubId }
    codingClubRepUser = { id: codingRep.id, email: codingRep.email, name: codingRep.name, role: codingRep.role, clubId: codingRep.clubId }
    roboticsClubRepUser = { id: roboticsRep.id, email: roboticsRep.email, name: roboticsRep.name, role: roboticsRep.role, clubId: roboticsRep.clubId }
    viewerUser = { id: viewer.id, email: viewer.email, name: viewer.name, role: viewer.role, clubId: viewer.clubId }

    const [acm, cc, rc, logCat, currSem, prevSem] = await Promise.all([
      prisma.club.findUniqueOrThrow({ where: { code: 'ACM' } }),
      prisma.club.findUniqueOrThrow({ where: { code: 'CC' } }),
      prisma.club.findUniqueOrThrow({ where: { code: 'RC' } }),
      prisma.expenseCategory.findUniqueOrThrow({ where: { name: 'Logistics' } }),
      prisma.semester.findUniqueOrThrow({ where: { name: 'Odd Semester 2026-27' } }),
      prisma.semester.findUniqueOrThrow({ where: { name: 'Even Semester 2025-26' } }),
    ])

    acmClubId = acm.id
    codingClubId = cc.id
    roboticsClubId = rc.id
    catLogisticsId = logCat.id
    activeSemesterId = currSem.id
    lockedSemesterId = prevSem.id
  })

  describe('Expense Creation & Validation', () => {
    it('CLUB_REP can create an expense for their own club', async () => {
      const date = new Date('2026-10-01T10:00:00Z') // active semester
      const expense = await expenseService.createExpense(codingClubRepUser, {
        title: 'Snacks',
        amount: '50.00',
        categoryId: catLogisticsId,
        date: date.toISOString(),
      })
      
      expect(expense).toBeDefined()
      expect(expense.status).toBe(ExpenseStatus.DRAFT)
      expect(expense.clubId).toBe(codingClubId)
      expect(expense.semesterId).toBe(activeSemesterId)
      
      // Amount should be parsed to Prisma.Decimal correctly
      expect(expense.amount.toString()).toBe('50')
    })

    it('rejects creation in a locked semester', async () => {
      const date = new Date('2026-03-01T10:00:00Z') // locked semester
      await expect(
        expenseService.createExpense(codingClubRepUser, {
          title: 'Old Snacks',
          amount: '50.00',
          categoryId: catLogisticsId,
          date: date.toISOString(),
        })
      ).rejects.toThrow(SemesterLockedError)
    })
  })

  describe('RBAC boundary', () => {
    it('CLUB_REP cannot view or mutate another club expense', async () => {
      // Create expense for Robotics
      const date = new Date('2026-10-01T10:00:00Z')
      const rbExp = await expenseService.createExpense(roboticsClubRepUser, {
        title: 'Robotics Parts',
        amount: '100.00',
        categoryId: catLogisticsId,
        date: date.toISOString(),
      })

      // Coding rep tries to get it
      await expect(expenseService.getExpense(codingClubRepUser, rbExp.id)).rejects.toThrow(ForbiddenError)

      // Coding rep tries to update it
      await expect(expenseService.updateExpense(codingClubRepUser, rbExp.id, { title: 'Hacked' })).rejects.toThrow(ForbiddenError)

      // Coding rep tries to delete it
      await expect(expenseService.softDeleteExpense(codingClubRepUser, rbExp.id)).rejects.toThrow(ForbiddenError)
    })

    it('VIEWER cannot create or update expenses', async () => {
      const date = new Date('2026-10-01T10:00:00Z')
      await expect(
        expenseService.createExpense(viewerUser, {
          title: 'I want to create',
          amount: '10.00',
          categoryId: catLogisticsId,
          date: date.toISOString(),
        })
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('Lifecycle', () => {
    let testExpenseId: string

    beforeAll(async () => {
      const date = new Date('2026-10-01T10:00:00Z')
      const exp = await expenseService.createExpense(codingClubRepUser, {
        title: 'Lifecycle Test',
        amount: '50.00',
        categoryId: catLogisticsId,
        date: date.toISOString(),
      })
      testExpenseId = exp.id
    })

    it('CLUB_REP CANNOT approve expense', async () => {
      await expect(expenseService.approveExpense(codingClubRepUser, testExpenseId)).rejects.toThrow(ForbiddenError)
    })

    it('ACM_CORE CAN approve expense', async () => {
      await expenseService.submitExpense(codingClubRepUser, testExpenseId)
      const approved = await expenseService.approveExpense(acmCoreUser, testExpenseId)
      expect(approved.status).toBe(ExpenseStatus.APPROVED)
    })

    it('APPROVED expense cannot be deleted', async () => {
      await expect(expenseService.softDeleteExpense(acmCoreUser, testExpenseId)).rejects.toThrow(BusinessRuleError)
    })

    it('ACM_CORE can reject SUBMITTED expense', async () => {
      const date = new Date('2026-10-01T10:00:00Z')
      const exp2 = await expenseService.createExpense(codingClubRepUser, {
        title: 'Lifecycle Test 2',
        amount: '50.00',
        categoryId: catLogisticsId,
        date: date.toISOString(),
      })

      await expenseService.submitExpense(codingClubRepUser, exp2.id)
      const rejected = await expenseService.rejectExpense(acmCoreUser, exp2.id, 'Too expensive')
      expect(rejected.status).toBe(ExpenseStatus.REJECTED)
      expect(rejected.rejectionReason).toBe('Too expensive')
    })
  })

  describe('Soft Delete', () => {
    it('deletes but retains record (soft delete)', async () => {
      const date = new Date('2026-10-01T10:00:00Z')
      const exp = await expenseService.createExpense(codingClubRepUser, {
        title: 'To Be Deleted',
        amount: '10.00',
        categoryId: catLogisticsId,
        date: date.toISOString(),
      })

      await expenseService.softDeleteExpense(codingClubRepUser, exp.id)

      // getExpense should throw NotFound
      await expect(expenseService.getExpense(codingClubRepUser, exp.id)).rejects.toThrow(NotFoundError)

      // Raw db check should have it with deletedAt
      const raw = await prisma.expense.findFirst({ where: { id: exp.id } })
      expect(raw?.deletedAt).not.toBeNull()
    })
  })

  describe('Receipts', () => {
    let testExpId: string
    beforeAll(async () => {
      const date = new Date('2026-10-01T10:00:00Z')
      const exp = await expenseService.createExpense(codingClubRepUser, {
        title: 'Receipt Test',
        amount: '10.00',
        categoryId: catLogisticsId,
        date: date.toISOString(),
      })
      testExpId = exp.id
    })

    it('allows owner to add receipt', async () => {
      const sha = 'a' + Date.now().toString().padEnd(63, '0')
      const r = await receiptService.addReceipt(codingClubRepUser, testExpId, {
        fileUrl: 'http://example.com/receipt.pdf',
        storagePublicId: 'receipt.pdf',
        fileName: 'receipt.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        sha256: sha
      })
      expect(r.id).toBeDefined()
    })

    it('rejects duplicate SHA256 receipt', async () => {
      const sha = 'b' + Date.now().toString().padEnd(63, '0')
      await receiptService.addReceipt(codingClubRepUser, testExpId, {
        fileUrl: 'http://example.com/receipt2.pdf',
        storagePublicId: 'receipt2.pdf',
        fileName: 'receipt2.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        sha256: sha
      })
      
      await expect(receiptService.addReceipt(codingClubRepUser, testExpId, {
        fileUrl: 'http://example.com/receipt3.pdf',
        storagePublicId: 'receipt3.pdf',
        fileName: 'receipt3.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        sha256: sha
      })).rejects.toThrow(BusinessRuleError)
    })

    it('prevents another club from adding receipt', async () => {
      const sha = 'c' + Date.now().toString().padEnd(63, '0')
      await expect(receiptService.addReceipt(roboticsClubRepUser, testExpId, {
        fileUrl: 'http://example.com/receipt4.pdf',
        storagePublicId: 'receipt4.pdf',
        fileName: 'receipt4.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        sha256: sha
      })).rejects.toThrow(ForbiddenError)
    })
  })

  describe('Querying Expenses', () => {
    it('returns paginated expenses', async () => {
      const res = await expenseService.getExpenses(superAdminUser, { page: 1, limit: 10 })
      expect(res.expenses).toBeInstanceOf(Array)
      expect(typeof res.total).toBe('number')
      expect(res.pages).toBeGreaterThanOrEqual(1)
    })

    it('filters by clubId', async () => {
      const res = await expenseService.getExpenses(superAdminUser, { clubId: codingClubId, page: 1, limit: 10 })
      expect(res.expenses.every(e => e.clubId === codingClubId)).toBe(true)
    })

    it('CLUB_REP can only query own club', async () => {
      const res = await expenseService.getExpenses(codingClubRepUser, { page: 1, limit: 10 })
      expect(res.expenses.every(e => e.clubId === codingClubId)).toBe(true)

      // Trying to query robotics
      await expect(expenseService.getExpenses(codingClubRepUser, { clubId: roboticsClubId, page: 1, limit: 10 })).rejects.toThrow(ForbiddenError)
    })
  })

  describe('Audit Logging', () => {
    it('creates an audit log on creation', async () => {
      const initialLogs = await prisma.auditLog.count({ where: { action: AuditAction.EXPENSE_CREATE } })
      
      const date = new Date('2026-10-01T10:00:00Z')
      await expenseService.createExpense(codingClubRepUser, {
        title: 'Audit Test',
        amount: '10.00',
        categoryId: catLogisticsId,
        date: date.toISOString(),
      })

      const finalLogs = await prisma.auditLog.count({ where: { action: AuditAction.EXPENSE_CREATE } })
      expect(finalLogs).toBe(initialLogs + 1)
    })
  })
})
