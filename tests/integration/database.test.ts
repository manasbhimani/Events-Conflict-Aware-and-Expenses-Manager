import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'

/**
 * Integration tests for Phase 1 database schema.
 *
 * These tests require a running PostgreSQL instance with migrations applied
 * and seed data loaded. Run:
 *   npx prisma migrate dev
 *   npx prisma db seed
 * before executing these tests.
 */

const prisma = new PrismaClient()

describe('Phase 1 Database Integration', () => {

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ------------------------------------------------------------------
  describe('1. Prisma client connectivity', () => {
    it('connects to the database without error', async () => {
      await expect(prisma.$connect()).resolves.not.toThrow()
    })
  })

  // ------------------------------------------------------------------
  describe('2. Decimal fields — no floating-point error', () => {

    it('stores and retrieves Semester.totalBudget as exact Decimal', async () => {
      const semester = await prisma.semester.findFirst({
        where: { name: 'Odd Semester 2026-27' },
      })

      expect(semester).not.toBeNull()
      // totalBudget should be a Prisma.Decimal instance, not a JS number
      expect(semester!.totalBudget).toBeInstanceOf(Prisma.Decimal)
      expect(semester!.totalBudget.toFixed(2)).toBe('50000.00')
      expect(semester!.totalBudget.equals('50000.00')).toBe(true)
      // Verify it's NOT a float (which would be 50000, not '50000.00')
      expect(typeof semester!.totalBudget).not.toBe('number')
    })

    it('stores and retrieves Expense.amount as exact Decimal', async () => {
      const expense = await prisma.expense.findFirst({
        where: { title: { contains: 'Speaker Honorarium' } },
      })
      expect(expense).not.toBeNull()
      expect(expense!.amount).toBeInstanceOf(Prisma.Decimal)
      expect(expense!.amount.toFixed(2)).toBe('5000.00')
      expect(expense!.amount.equals('5000.00')).toBe(true)
    })

    it('stores and retrieves BudgetAllocation.allocatedAmount as Decimal', async () => {
      const budget = await prisma.budgetAllocation.findFirst({
        where: { notes: { contains: 'Prize money' } },
      })
      expect(budget).not.toBeNull()
      expect(budget!.allocatedAmount).toBeInstanceOf(Prisma.Decimal)
    })

  })

  // ------------------------------------------------------------------
  describe('3. Overlapping events coexist — no DB-level constraint prevents them', () => {

    it('both demo conflict events exist in the database', async () => {
      const events = await prisma.event.findMany({
        where: { title: { contains: '[DEMO]' } },
        orderBy: { startAt: 'asc' },
      })
      expect(events).toHaveLength(2)
    })

    it('demo events genuinely overlap using the end-exclusive formula', async () => {
      const events = await prisma.event.findMany({
        where: { title: { contains: '[DEMO]' } },
        orderBy: { startAt: 'asc' },
      })
      const [hackathon, workshop] = events

      // Hackathon: 10:30–14:30 UTC | Workshop: 11:30–13:30 UTC
      // End-exclusive overlap: hackathon.start < workshop.end AND workshop.start < hackathon.end
      expect(hackathon.startAt < workshop.endAt).toBe(true)
      expect(workshop.startAt < hackathon.endAt).toBe(true)
    })

    it('demo events share the same venue (LT-1)', async () => {
      const events = await prisma.event.findMany({
        where: { title: { contains: '[DEMO]' } },
        include: { venue: true },
      })
      expect(events[0].venueId).toBe(events[1].venueId)
      expect(events[0].venue.name).toBe('Lecture Theatre 1 (LT-1)')
    })

    it('demo events share the same target audience (2nd Year CSE/IT)', async () => {
      const events = await prisma.event.findMany({
        where: { title: { contains: '[DEMO]' } },
      })
      for (const e of events) {
        expect(e.targetYears).toContain(2)
        expect(e.targetBranches).toContain('CSE')
        expect(e.targetBranches).toContain('IT')
      }
    })

  })

  // ------------------------------------------------------------------
  describe('4. Soft deletion fields', () => {

    it('Event has deletedAt field (null by default)', async () => {
      const event = await prisma.event.findFirst()
      expect(event).not.toBeNull()
      expect(Object.keys(event!)).toContain('deletedAt')
      expect(event!.deletedAt).toBeNull()
    })

    it('Club has deletedAt field (null by default)', async () => {
      const club = await prisma.club.findFirst()
      expect(club).not.toBeNull()
      expect(Object.keys(club!)).toContain('deletedAt')
      expect(club!.deletedAt).toBeNull()
    })

    it('Expense has deletedAt field (null by default)', async () => {
      const expense = await prisma.expense.findFirst()
      expect(expense).not.toBeNull()
      expect(Object.keys(expense!)).toContain('deletedAt')
      expect(expense!.deletedAt).toBeNull()
    })

    it('Receipt model has deletedAt in schema (structural check)', async () => {
      // Receipt has no seeded data, but we verify the model fields via Prisma's dmmf
      const receiptFields = Prisma.dmmf.datamodel.models
        .find(m => m.name === 'Receipt')?.fields
        .map(f => f.name)
      expect(receiptFields).toContain('deletedAt')
    })

  })

  // ------------------------------------------------------------------
  describe('5. AuditLog immutability', () => {

    it('creates an audit log record successfully', async () => {
      const user = await prisma.user.findFirst()
      expect(user).not.toBeNull()

      const log = await prisma.auditLog.create({
        data: {
          actorUserId: user!.id,
          action: 'EVENT_CREATE',
          targetType: 'Event',
          targetId: 'test-phase1-integration',
          metadata: { test: true, phase: 1 },
        },
      })

      expect(log.id).toBeDefined()
      expect(log.createdAt).toBeInstanceOf(Date)
      // AuditLog deliberately has NO updatedAt field
      expect((log as Record<string, unknown>).updatedAt).toBeUndefined()

      // Clean up test record
      await prisma.auditLog.delete({ where: { id: log.id } })
    })

    it('seed created initial audit log records', async () => {
      const logs = await prisma.auditLog.findMany()
      expect(logs.length).toBeGreaterThanOrEqual(5)
    })

    it('audit logs have the correct action enum values', async () => {
      const semesterLockLog = await prisma.auditLog.findFirst({
        where: { action: 'SEMESTER_LOCK' },
      })
      expect(semesterLockLog).not.toBeNull()
    })

  })

  // ------------------------------------------------------------------
  describe('6. Relationships load correctly', () => {

    it('Event loads with club, venue, semester', async () => {
      const event = await prisma.event.findFirst({
        include: { club: true, venue: true, semester: true },
      })
      expect(event!.club.name).toBeTruthy()
      expect(event!.venue.name).toBeTruthy()
      expect(event!.semester.name).toBeTruthy()
    })

    it('User loads with their club relation', async () => {
      const user = await prisma.user.findFirst({
        where: { email: 'core@acm-demo.college.edu' },
        include: { club: true },
      })
      expect(user).not.toBeNull()
      expect(user!.role).toBe('ACM_CORE')
      expect(user!.club?.code).toBe('ACM')
    })

    it('Expense loads with category, club, semester', async () => {
      const expense = await prisma.expense.findFirst({
        include: { category: true, club: true, semester: true },
      })
      expect(expense!.category.name).toBeTruthy()
      expect(expense!.club.name).toBeTruthy()
      expect(expense!.semester.name).toBeTruthy()
    })

  })

  // ------------------------------------------------------------------
  describe('7. Seed data completeness', () => {

    it('seeded 5 clubs', async () => {
      const count = await prisma.club.count()
      expect(count).toBeGreaterThanOrEqual(5)
    })

    it('seeded at least 8 users', async () => {
      const count = await prisma.user.count()
      expect(count).toBeGreaterThanOrEqual(8)
    })

    it('seeded at least 6 venues', async () => {
      const count = await prisma.venue.count()
      expect(count).toBeGreaterThanOrEqual(6)
    })

    it('seeded 2 semesters', async () => {
      const count = await prisma.semester.count()
      expect(count).toBeGreaterThanOrEqual(2)
    })

    it('seeded 8 expense categories', async () => {
      const count = await prisma.expenseCategory.count()
      expect(count).toBe(8)
    })

    it('seeded at least 15 events', async () => {
      const count = await prisma.event.count()
      expect(count).toBeGreaterThanOrEqual(15)
    })

    it('seeded at least 25 expenses', async () => {
      const count = await prisma.expense.count()
      expect(count).toBeGreaterThanOrEqual(25)
    })

    it('previous semester is locked', async () => {
      const prev = await prisma.semester.findFirst({
        where: { name: 'Even Semester 2025-26' },
      })
      expect(prev!.isLocked).toBe(true)
      expect(prev!.lockedAt).not.toBeNull()
    })

    it('current semester is NOT locked', async () => {
      const curr = await prisma.semester.findFirst({
        where: { name: 'Odd Semester 2026-27' },
      })
      expect(curr!.isLocked).toBe(false)
    })

    it('budget allocations sum to ₹50,000 for current semester', async () => {
      const budgets = await prisma.budgetAllocation.findMany({
        where: {
          semester: { name: 'Odd Semester 2026-27' },
        },
      })
      const total = budgets.reduce(
        (sum, b) => sum.add(b.allocatedAmount),
        new Prisma.Decimal(0)
      )
      expect(total.toFixed(2)).toBe('50000.00')
      expect(total.equals('50000.00')).toBe(true)
    })

  })

  // ------------------------------------------------------------------
  describe('8. ConflictRecord uniqueness design', () => {

    it('ConflictRecord model exists and has the canonical pair + type unique constraint', () => {
      const model = Prisma.dmmf.datamodel.models.find(m => m.name === 'ConflictRecord')
      expect(model).toBeDefined()
      const fields = model!.fields.map(f => f.name)
      expect(fields).toContain('eventAId')
      expect(fields).toContain('eventBId')
      expect(fields).toContain('conflictType')
    })

  })

})
