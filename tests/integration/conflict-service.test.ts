import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient, UserRole, ConflictType, ConflictSeverity, ConflictStatus, EventType, EventStatus } from '@prisma/client'
import { conflictService } from '@/server/services/conflict.service'
import { eventService } from '@/server/services/event.service'
import { ForbiddenError } from '@/server/lib/errors'
import type { SessionUser } from '@/server/types'

const prisma = new PrismaClient()

describe('Phase 4 ConflictService Integration Tests', () => {
  let superAdminUser: SessionUser
  let acmCoreUser: SessionUser
  let codingClubRepUser: SessionUser
  let roboticsClubRepUser: SessionUser

  let codingClubId: string
  let roboticsClubId: string
  let lt1VenueId: string
  let seminarHallVenueId: string
  let currentSemesterId: string

  beforeAll(async () => {
    // Clean up any old conflicts
    await prisma.conflictRecord.deleteMany({})

    const [sa, core, codingRep, roboticsRep] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'superadmin@acm-demo.college.edu' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'core@acm-demo.college.edu' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'rep.coding@acm-demo.college.edu' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'rep.robotics@acm-demo.college.edu' } }),
    ])

    superAdminUser = { id: sa.id, email: sa.email, name: sa.name, role: sa.role, clubId: sa.clubId }
    acmCoreUser = { id: core.id, email: core.email, name: core.name, role: core.role, clubId: core.clubId }
    codingClubRepUser = { id: codingRep.id, email: codingRep.email, name: codingRep.name, role: codingRep.role, clubId: codingRep.clubId }
    roboticsClubRepUser = { id: roboticsRep.id, email: roboticsRep.email, name: roboticsRep.name, role: roboticsRep.role, clubId: roboticsRep.clubId }

    const [cc, rc, lt1, semHall, currSem] = await Promise.all([
      prisma.club.findUniqueOrThrow({ where: { code: 'CC' } }),
      prisma.club.findUniqueOrThrow({ where: { code: 'RC' } }),
      prisma.venue.findUniqueOrThrow({ where: { name: 'Lecture Theatre 1 (LT-1)' } }),
      prisma.venue.findUniqueOrThrow({ where: { name: 'Seminar Hall' } }),
      prisma.semester.findUniqueOrThrow({ where: { name: 'Odd Semester 2026-27' } }),
    ])

    codingClubId = cc.id
    roboticsClubId = rc.id
    lt1VenueId = lt1.id
    seminarHallVenueId = semHall.id
    currentSemesterId = currSem.id
  })

  describe('Conflict Detection', () => {
    let eventAId: string
    let eventBId: string

    it('detects VENUE and AUDIENCE conflicts when overlapping at the same venue', async () => {
      // Create Event A
      const eventA = await eventService.createEvent(codingClubRepUser, {
        title: 'Coding Hackathon',
        eventType: EventType.HACKATHON,
        clubId: codingClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-11-01T10:00:00Z'),
        endAt: new Date('2026-11-01T14:00:00Z'), // 4 hours
        targetYears: [2],
        targetBranches: ['CSE'],
        expectedAttendees: 100,
        tags: []
      })
      eventAId = eventA.id

      // Create Event B overlapping
      const eventB = await eventService.createEvent(roboticsClubRepUser, {
        title: 'Robotics Workshop',
        eventType: EventType.WORKSHOP,
        clubId: roboticsClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-11-01T12:00:00Z'),
        endAt: new Date('2026-11-01T16:00:00Z'), // 4 hours
        targetYears: [2],
        targetBranches: ['CSE'],
        expectedAttendees: 50,
        tags: []
      })
      eventBId = eventB.id

      // Detect
      const conflicts = await conflictService.detectConflicts(acmCoreUser, eventAId)
      
      // Filter conflicts to just the ones between A and B, since A might overlap with seeded events
      const targetConflicts = conflicts.filter(c => 
        (c.eventAId === eventAId && c.eventBId === eventBId) || 
        (c.eventAId === eventBId && c.eventBId === eventAId)
      )

      expect(targetConflicts.length).toBe(2) // Should have VENUE and AUDIENCE
      const venueConflict = targetConflicts.find(c => c.conflictType === ConflictType.VENUE)
      const audienceConflict = targetConflicts.find(c => c.conflictType === ConflictType.AUDIENCE)

      expect(venueConflict).toBeDefined()
      expect(audienceConflict).toBeDefined()

      // Both should have identical eventAId and eventBId ordering
      const expectedA = eventAId < eventBId ? eventAId : eventBId
      const expectedB = eventAId < eventBId ? eventBId : eventAId
      
      expect(venueConflict!.eventAId).toBe(expectedA)
      expect(venueConflict!.eventBId).toBe(expectedB)
    })

    it('idempotency: running detection again does not duplicate records', async () => {
      // First ensure B's conflicts are generated
      await conflictService.detectConflicts(acmCoreUser, eventBId)
      
      const initialCount = await prisma.conflictRecord.count()
      
      // Run detection again on both
      await conflictService.detectConflicts(acmCoreUser, eventAId)
      await conflictService.detectConflicts(acmCoreUser, eventBId)

      const afterCount = await prisma.conflictRecord.count()
      expect(afterCount).toBe(initialCount)
    })

    it('stale conflicts are marked RESOLVED when event is modified to not overlap', async () => {
      // Move event B so it no longer overlaps
      await eventService.updateEvent(roboticsClubRepUser, eventBId, {
        startAt: new Date('2026-11-01T15:00:00Z'),
        endAt: new Date('2026-11-01T19:00:00Z'), 
      })

      // Run detect on B (since A was not modified)
      // Actually running detect on B will update the records involving B
      await conflictService.detectConflicts(acmCoreUser, eventBId)

      const expectedA = eventAId < eventBId ? eventAId : eventBId
      const expectedB = eventAId < eventBId ? eventBId : eventAId

      const conflicts = await prisma.conflictRecord.findMany({
        where: { eventAId: expectedA, eventBId: expectedB }
      })

      for (const c of conflicts) {
        expect(c.status).toBe(ConflictStatus.RESOLVED)
        expect(c.resolutionNote).toContain('System automatically resolved')
      }
    })

    it('detects ORGANIZER conflict if same club', async () => {
      // Create Event C for coding club overlapping with Event A
      const eventC = await eventService.createEvent(codingClubRepUser, {
        title: 'Another Coding Event',
        eventType: EventType.SEMINAR,
        clubId: codingClubId,
        venueId: seminarHallVenueId, // different venue
        semesterId: currentSemesterId,
        startAt: new Date('2026-11-01T11:00:00Z'),
        endAt: new Date('2026-11-01T13:00:00Z'),
        targetYears: [1], // different audience
        targetBranches: ['IT'],
        expectedAttendees: 30,
        tags: []
      })

      const conflicts = await conflictService.detectConflicts(acmCoreUser, eventAId)
      const organizerConflict = conflicts.find(c => c.conflictType === ConflictType.ORGANIZER)
      expect(organizerConflict).toBeDefined()
      expect(organizerConflict!.status).toBe(ConflictStatus.OPEN)
    })
    it('detecting a conflict does not alter event status (Human Decision Principle)', async () => {
      // Fetch current status
      const beforeEvent = await prisma.event.findUniqueOrThrow({ where: { id: eventAId } })
      
      // Run detection
      await conflictService.detectConflicts(acmCoreUser, eventAId)
      
      const afterEvent = await prisma.event.findUniqueOrThrow({ where: { id: eventAId } })
      
      // Verify no mutation of event status/timing occurred
      expect(afterEvent.status).toBe(beforeEvent.status)
      expect(afterEvent.startAt.getTime()).toBe(beforeEvent.startAt.getTime())
      expect(afterEvent.endAt.getTime()).toBe(beforeEvent.endAt.getTime())
    })

    it('verifying an event refreshes conflicts but DOES NOT reject verification', async () => {
      // Create a conflicting event, submit it, and verify it
      const eventD = await eventService.createEvent(codingClubRepUser, {
        title: 'Conflict Verification Test',
        eventType: EventType.WORKSHOP,
        clubId: codingClubId,
        venueId: lt1VenueId,
        semesterId: currentSemesterId,
        startAt: new Date('2026-11-01T10:30:00Z'), // Overlaps with Event A
        endAt: new Date('2026-11-01T12:30:00Z'),
        targetYears: [2],
        targetBranches: ['CSE'],
        expectedAttendees: 50,
        tags: []
      })
      
      await eventService.submitEvent(codingClubRepUser, eventD.id)
      
      // Verification should succeed despite conflicts existing
      const verified = await eventService.verifyEvent(acmCoreUser, eventD.id, 'Verified despite conflict')
      expect(verified.status).toBe(EventStatus.VERIFIED)
      
      // And it should have generated conflicts for it
      const expectedA = eventD.id < eventAId ? eventD.id : eventAId
      const expectedB = eventD.id < eventAId ? eventAId : eventD.id
      const conflicts = await prisma.conflictRecord.findMany({
        where: { eventAId: expectedA, eventBId: expectedB }
      })
      expect(conflicts.length).toBeGreaterThan(0)
    })
  })

  describe('RBAC & Workflow', () => {
    let testConflictId: string

    beforeAll(async () => {
      const conflicts = await prisma.conflictRecord.findMany({ where: { status: ConflictStatus.OPEN } })
      testConflictId = conflicts[0].id
    })

    it('CLUB_REP can acknowledge conflict involving their event', async () => {
      const ack = await conflictService.acknowledgeConflict(codingClubRepUser, testConflictId)
      expect(ack.status).toBe(ConflictStatus.ACKNOWLEDGED)
    })

    it('CLUB_REP CANNOT acknowledge conflict for completely unrelated club', async () => {
      await expect(
        conflictService.acknowledgeConflict(roboticsClubRepUser, testConflictId)
      ).rejects.toThrow(ForbiddenError)
    })

    it('CLUB_REP CANNOT resolve or override conflict', async () => {
      await expect(
        conflictService.resolveConflict(codingClubRepUser, testConflictId, 'Rep trying to resolve')
      ).rejects.toThrow(ForbiddenError)

      await expect(
        conflictService.overrideConflict(codingClubRepUser, testConflictId, 'Rep trying to override')
      ).rejects.toThrow(ForbiddenError)
    })

    it('ACM_EXEC CANNOT acknowledge, resolve, or override conflict', async () => {
      // Need an exec user
      const execUser = await prisma.user.findUniqueOrThrow({ where: { email: 'exec@acm-demo.college.edu' } })
      const execSessionUser: SessionUser = { id: execUser.id, email: execUser.email, name: execUser.name, role: execUser.role, clubId: execUser.clubId }
      
      await expect(
        conflictService.acknowledgeConflict(execSessionUser, testConflictId)
      ).rejects.toThrow(ForbiddenError)

      await expect(
        conflictService.resolveConflict(execSessionUser, testConflictId, 'Exec trying to resolve')
      ).rejects.toThrow(ForbiddenError)

      await expect(
        conflictService.overrideConflict(execSessionUser, testConflictId, 'Exec trying to override')
      ).rejects.toThrow(ForbiddenError)
    })

    it('ACM_CORE can resolve conflict', async () => {
      const resolved = await conflictService.resolveConflict(acmCoreUser, testConflictId, 'Core resolved it')
      expect(resolved.status).toBe(ConflictStatus.RESOLVED)
      expect(resolved.resolvedByUserId).toBe(acmCoreUser.id)
    })

    it('SUPER_ADMIN can override conflict (need a new open one)', async () => {
      // Re-open it manually for test
      const openConflict = await prisma.conflictRecord.update({
        where: { id: testConflictId },
        data: { status: ConflictStatus.OPEN }
      })

      const overridden = await conflictService.overrideConflict(superAdminUser, openConflict.id, 'SA Override')
      expect(overridden.status).toBe(ConflictStatus.OVERRIDDEN)
      expect(overridden.resolvedByUserId).toBe(superAdminUser.id)
    })
  })
})
