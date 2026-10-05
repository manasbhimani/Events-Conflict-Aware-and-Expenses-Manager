import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, UserRole, EventStatus, EventType, ReviewDecision, AuditAction } from '@prisma/client'
import { eventService } from '@/server/services/event.service'
import {
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
  SemesterLockedError,
} from '@/server/lib/errors'
import type { SessionUser } from '@/server/types'

const prisma = new PrismaClient()

describe('Phase 3 EventService Integration Tests', () => {
  let superAdminUser: SessionUser
  let acmCoreUser: SessionUser
  let acmExecUser: SessionUser
  let codingClubRepUser: SessionUser
  let roboticsClubRepUser: SessionUser
  let viewerUser: SessionUser

  let acmClubId: string
  let codingClubId: string
  let roboticsClubId: string
  let lt1VenueId: string
  let currentSemesterId: string
  let lockedSemesterId: string

  beforeAll(async () => {
    // Fetch seeded users
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

    // Fetch seeded clubs, venues, semesters
    const [acm, cc, rc, lt1, currSem, lockSem] = await Promise.all([
      prisma.club.findUniqueOrThrow({ where: { code: 'ACM' } }),
      prisma.club.findUniqueOrThrow({ where: { code: 'CC' } }),
      prisma.club.findUniqueOrThrow({ where: { code: 'RC' } }),
      prisma.venue.findUniqueOrThrow({ where: { name: 'Lecture Theatre 1 (LT-1)' } }),
      prisma.semester.findUniqueOrThrow({ where: { name: 'Odd Semester 2026-27' } }),
      prisma.semester.findUniqueOrThrow({ where: { name: 'Even Semester 2025-26' } }),
    ])

    acmClubId = acm.id
    codingClubId = cc.id
    roboticsClubId = rc.id
    lt1VenueId = lt1.id
    currentSemesterId = currSem.id
    lockedSemesterId = lockSem.id
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ------------------------------------------------------------------
  // 1. EVENT CREATION & RBAC
  // ------------------------------------------------------------------
  describe('1. Event Creation & Access Control', () => {
    it('allows a CLUB_REP to create an event in DRAFT for their own club', async () => {
      const created = await eventService.createEvent(codingClubRepUser, {
        title: 'Algorithm Sprint 2026',
        description: 'Practice contest for coding club members',
        eventType: EventType.COMPETITION,
        clubId: codingClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-11-01T10:00:00.000Z'),
        endAt: new Date('2026-11-01T13:00:00.000Z'),
        targetYears: [1, 2],
        targetBranches: ['CSE', 'IT'],
        expectedAttendees: 40,
        tags: ['algorithms', 'sprint'],
      })

      expect(created.id).toBeDefined()
      expect(created.status).toBe(EventStatus.DRAFT)
      expect(created.clubId).toBe(codingClubId)
      expect(created.submittedByUserId).toBe(codingClubRepUser.id)

      // Verify AuditLog record was created in the transaction
      const audit = await prisma.auditLog.findFirst({
        where: {
          targetId: created.id,
          action: AuditAction.EVENT_CREATE,
        },
      })
      expect(audit).not.toBeNull()
      expect(audit?.actorUserId).toBe(codingClubRepUser.id)
    })

    it('denies a CLUB_REP from creating an event for a club they do not belong to', async () => {
      await expect(
        eventService.createEvent(codingClubRepUser, {
          title: 'Unauthorized Robotics Session',
          eventType: EventType.WORKSHOP,
          clubId: roboticsClubId, // Not coding club!
          venueId: lt1VenueId,
          semesterId: currentSemesterId,
          startAt: new Date('2026-11-02T10:00:00.000Z'),
          endAt: new Date('2026-11-02T12:00:00.000Z'),
          targetYears: [],
          targetBranches: [],
          expectedAttendees: 20,
          tags: [],
        })
      ).rejects.toThrow(ForbiddenError)
    })

    it('denies a VIEWER from creating any event', async () => {
      await expect(
        eventService.createEvent(viewerUser, {
          title: 'Viewer Attempted Event',
          eventType: EventType.OTHER,
          clubId: acmClubId,
          venueId: lt1VenueId,
          semesterId: currentSemesterId,
          startAt: new Date('2026-11-03T10:00:00.000Z'),
          endAt: new Date('2026-11-03T12:00:00.000Z'),
          targetYears: [],
          targetBranches: [],
          expectedAttendees: 10,
          tags: [],
        })
      ).rejects.toThrow(ForbiddenError)
    })

    it('rejects creating an event in a locked semester', async () => {
      await expect(
        eventService.createEvent(codingClubRepUser, {
          title: 'Retroactive Event',
          eventType: EventType.WORKSHOP,
          clubId: codingClubId,
          venueId: lt1VenueId,
          semesterId: lockedSemesterId, // Even Semester 2025-26 is locked
          startAt: new Date('2026-03-01T10:00:00.000Z'),
          endAt: new Date('2026-03-01T12:00:00.000Z'),
          targetYears: [],
          targetBranches: [],
          expectedAttendees: 20,
          tags: [],
        })
      ).rejects.toThrow(SemesterLockedError)
    })

    it('rejects creating an event if startAt >= endAt', async () => {
      await expect(
        eventService.createEvent(codingClubRepUser, {
          title: 'Time Travel Seminar',
          eventType: EventType.SEMINAR,
          clubId: codingClubId,
          venueId: lt1VenueId,
          semesterId: currentSemesterId,
          startAt: new Date('2026-11-04T12:00:00.000Z'),
          endAt: new Date('2026-11-04T10:00:00.000Z'),
          targetYears: [],
          targetBranches: [],
          expectedAttendees: 20,
          tags: [],
        })
      ).rejects.toThrow(BusinessRuleError)
    })
  })

  // ------------------------------------------------------------------
  // 2. LIFECYCLE STATE MACHINE
  // ------------------------------------------------------------------
  describe('2. Lifecycle Transitions & Review Audit', () => {
    let testEventId: string

    beforeAll(async () => {
      const e = await eventService.createEvent(codingClubRepUser, {
        title: 'Lifecycle Test Hackathon',
        description: 'Event to verify full state machine transitions',
        eventType: EventType.HACKATHON,
        clubId: codingClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-11-10T09:00:00.000Z'),
        endAt: new Date('2026-11-10T17:00:00.000Z'),
        targetYears: [2, 3],
        targetBranches: ['CSE'],
        expectedAttendees: 50,
        tags: ['lifecycle'],
      })
      testEventId = e.id
    })

    it('allows submit from DRAFT -> SUBMITTED by club owner', async () => {
      const submitted = await eventService.submitEvent(codingClubRepUser, testEventId)
      expect(submitted.status).toBe(EventStatus.SUBMITTED)

      const audit = await prisma.auditLog.findFirst({
        where: { targetId: testEventId, action: AuditAction.EVENT_SUBMIT },
      })
      expect(audit).not.toBeNull()
      expect(audit?.actorUserId).toBe(codingClubRepUser.id)
    })

    it('disallows non-owners from submitting the draft', async () => {
      const otherDraft = await eventService.createEvent(roboticsClubRepUser, {
        title: 'Robotics Secret Draft',
        eventType: EventType.WORKSHOP,
        clubId: roboticsClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-11-12T10:00:00.000Z'),
        endAt: new Date('2026-11-12T12:00:00.000Z'),
        targetYears: [],
        targetBranches: [],
        expectedAttendees: 15,
        tags: [],
      })

      await expect(
        eventService.submitEvent(codingClubRepUser, otherDraft.id)
      ).rejects.toThrow(ForbiddenError)
    })

    it('disallows verifying an event directly from DRAFT without SUBMITTED status', async () => {
      const unsubmitted = await eventService.createEvent(codingClubRepUser, {
        title: 'Direct Verify Skip Attempt',
        eventType: EventType.WORKSHOP,
        clubId: codingClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-11-15T10:00:00.000Z'),
        endAt: new Date('2026-11-15T12:00:00.000Z'),
        targetYears: [],
        targetBranches: [],
        expectedAttendees: 15,
        tags: [],
      })

      await expect(
        eventService.verifyEvent(acmCoreUser, unsubmitted.id, 'Trying to skip queue')
      ).rejects.toThrow(BusinessRuleError)
    })

    it('prevents CLUB_REP from calling verifyEvent (must be ACM_CORE / SUPER_ADMIN)', async () => {
      await expect(
        eventService.verifyEvent(codingClubRepUser, testEventId)
      ).rejects.toThrow(ForbiddenError)
    })

    it('allows ACM_CORE to verify a SUBMITTED event (SUBMITTED -> VERIFIED)', async () => {
      const verified = await eventService.verifyEvent(acmCoreUser, testEventId, 'Approved after room check')
      expect(verified.status).toBe(EventStatus.VERIFIED)

      // Check EventReview table entry
      const review = await prisma.eventReview.findFirst({
        where: { eventId: testEventId },
        orderBy: { createdAt: 'desc' },
      })
      expect(review).not.toBeNull()
      expect(review?.decision).toBe(ReviewDecision.VERIFIED)
      expect(review?.reviewerUserId).toBe(acmCoreUser.id)
      expect(review?.comment).toBe('Approved after room check')

      // Check AuditLog table entry
      const audit = await prisma.auditLog.findFirst({
        where: { targetId: testEventId, action: AuditAction.EVENT_VERIFY },
      })
      expect(audit).not.toBeNull()
      expect(audit?.actorUserId).toBe(acmCoreUser.id)
    })

    it('prevents modifying an already VERIFIED event', async () => {
      await expect(
        eventService.updateEvent(codingClubRepUser, testEventId, {
          title: 'Trying to sneakily alter verified event',
        })
      ).rejects.toThrow(BusinessRuleError)
    })

    it('allows cancelling a VERIFIED event with a reason', async () => {
      const cancelled = await eventService.cancelEvent(codingClubRepUser, testEventId, 'Venue plumbing issue')
      expect(cancelled.status).toBe(EventStatus.CANCELLED)
      expect(cancelled.rejectionReason).toBe('Venue plumbing issue')

      const audit = await prisma.auditLog.findFirst({
        where: { targetId: testEventId, action: AuditAction.EVENT_CANCEL },
        orderBy: { createdAt: 'desc' },
      })
      expect(audit).not.toBeNull()
      expect(audit?.actorUserId).toBe(codingClubRepUser.id)
    })

    it('prevents cancelling an already CANCELLED event', async () => {
      await expect(
        eventService.cancelEvent(codingClubRepUser, testEventId, 'Double cancel attempt')
      ).rejects.toThrow(BusinessRuleError)
    })

    it('handles rejection workflow SUBMITTED -> REJECTED with reason and EventReview', async () => {
      // Create new event to test rejection
      const toReject = await eventService.createEvent(codingClubRepUser, {
        title: 'Noisy Drum Session',
        description: 'Loud practice during exam week',
        eventType: EventType.CULTURAL,
        clubId: codingClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-11-20T14:00:00.000Z'),
        endAt: new Date('2026-11-20T16:00:00.000Z'),
        targetYears: [],
        targetBranches: [],
        expectedAttendees: 30,
        tags: ['drum'],
      })

      await eventService.submitEvent(codingClubRepUser, toReject.id)

      const rejected = await eventService.rejectEvent(
        acmCoreUser,
        toReject.id,
        'Cannot hold high-decibel cultural events in LT-1 during midterm study week'
      )

      expect(rejected.status).toBe(EventStatus.REJECTED)
      expect(rejected.rejectionReason).toBe('Cannot hold high-decibel cultural events in LT-1 during midterm study week')

      const review = await prisma.eventReview.findFirst({
        where: { eventId: toReject.id },
      })
      expect(review?.decision).toBe(ReviewDecision.REJECTED)
      expect(review?.comment).toContain('Cannot hold high-decibel')

      const audit = await prisma.auditLog.findFirst({
        where: { targetId: toReject.id, action: AuditAction.EVENT_REJECT },
      })
      expect(audit?.actorUserId).toBe(acmCoreUser.id)
    })
  })

  // ------------------------------------------------------------------
  // 3. SOFT DELETION SEMANTICS
  // ------------------------------------------------------------------
  describe('3. Soft Deletion Semantics', () => {
    it('soft deletes event by setting deletedAt and does not physically delete from DB', async () => {
      const event = await eventService.createEvent(codingClubRepUser, {
        title: 'Event to Soft Delete',
        eventType: EventType.WORKSHOP,
        clubId: codingClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-12-01T10:00:00.000Z'),
        endAt: new Date('2026-12-01T12:00:00.000Z'),
        targetYears: [],
        targetBranches: [],
        expectedAttendees: 10,
        tags: [],
      })

      const delResult = await eventService.deleteEvent(codingClubRepUser, event.id)
      expect(delResult.success).toBe(true)
      expect(delResult.deletedAt).toBeDefined()

      // The record MUST still exist in database
      const rawInDb = await prisma.event.findUnique({ where: { id: event.id } })
      expect(rawInDb).not.toBeNull()
      expect(rawInDb?.deletedAt).not.toBeNull()

      // Service queries must exclude it
      await expect(eventService.getEventById(codingClubRepUser, event.id)).rejects.toThrow(NotFoundError)

      // Excluded from list queries
      const list = await eventService.getEvents(codingClubRepUser, { page: 1, pageSize: 100 })
      expect(list.events.some((e) => e.id === event.id)).toBe(false)
    })
  })

  // ------------------------------------------------------------------
  // 4. OVERLAPPING EVENTS COEXISTENCE (DB INVARIANT)
  // ------------------------------------------------------------------
  describe('4. Overlapping Events DB Coexistence', () => {
    it('allows multiple events with identical venue and overlapping time window to coexist', async () => {
      const windowStart = new Date('2026-10-25T14:00:00.000Z')
      const windowEnd = new Date('2026-10-25T18:00:00.000Z')

      const eventA = await eventService.createEvent(codingClubRepUser, {
        title: 'Overlap Test — Club A LT1',
        eventType: EventType.WORKSHOP,
        clubId: codingClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: windowStart,
        endAt: windowEnd,
        targetYears: [2],
        targetBranches: ['CSE'],
        expectedAttendees: 50,
        tags: [],
      })

      // Overlapping event B in exact same venue at same time
      const eventB = await eventService.createEvent(acmExecUser, {
        title: 'Overlap Test — ACM LT1',
        eventType: EventType.SEMINAR,
        clubId: acmClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-10-25T15:00:00.000Z'), // Nested inside Event A
        endAt: new Date('2026-10-25T17:00:00.000Z'),
        targetYears: [2],
        targetBranches: ['CSE'],
        expectedAttendees: 50,
        tags: [],
      })

      expect(eventA.id).toBeDefined()
      expect(eventB.id).toBeDefined()
      expect(eventA.id).not.toBe(eventB.id)

      // Query both from DB
      const loaded = await prisma.event.findMany({
        where: { id: { in: [eventA.id, eventB.id] } },
      })
      expect(loaded.length).toBe(2)
    })
  })

  // ------------------------------------------------------------------
  // 5. CALENDAR API & FULLCALENDAR DATA SHAPE
  // ------------------------------------------------------------------
  describe('5. Calendar Feed & FullCalendar Shape', () => {
    it('returns FullCalendar format with extendedProps for date window', async () => {
      const calEvents = await eventService.getCalendarEvents(acmCoreUser, {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T23:59:59.999Z',
      })

      expect(Array.isArray(calEvents)).toBe(true)
      expect(calEvents.length).toBeGreaterThan(0)

      const demoEvent = calEvents.find((e) => e.title.includes('[DEMO] Technical Hackathon'))
      expect(demoEvent).toBeDefined()
      expect(demoEvent?.id).toBeDefined()
      expect(demoEvent?.start).toBeDefined()
      expect(demoEvent?.end).toBeDefined()
      expect(demoEvent?.extendedProps).toBeDefined()
      expect(demoEvent?.extendedProps.status).toBe(EventStatus.VERIFIED)
      expect(demoEvent?.extendedProps.clubName).toBe('Coding Club')
      expect(demoEvent?.extendedProps.venueName).toBe('Lecture Theatre 1 (LT-1)')
      expect(demoEvent?.extendedProps.targetYears).toEqual([2])
      expect(demoEvent?.extendedProps.targetBranches).toEqual(['CSE', 'IT'])
    })

    it('isolates VIEWER calendar visibility to VERIFIED and COMPLETED events only', async () => {
      // DRAFT or SUBMITTED events must NOT appear for viewer
      const calEvents = await eventService.getCalendarEvents(viewerUser, {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T23:59:59.999Z',
      })

      for (const ev of calEvents) {
        expect([EventStatus.VERIFIED, EventStatus.COMPLETED]).toContain(ev.extendedProps.status)
      }
    })
  })
})
