import prisma from '@/server/lib/prisma'
import { conflictService } from './conflict.service'
import {
  EventStatus,
  ReviewDecision,
  AuditAction,
  UserRole,
  type Event,
  type Prisma,
} from '@prisma/client'
import {
  NotFoundError,
  ForbiddenError,
  BusinessRuleError,
  SemesterLockedError,
} from '@/server/lib/errors'
import {
  can,
  assertCan,
  assertCanAccessClub,
  canManageEvent,
} from '@/server/policies/rbac.policy'
import { isValidEventInterval } from '@/server/lib/timezone'
import type { SessionUser } from '@/server/types'
import type {
  CreateEventInput,
  UpdateEventInput,
  EventFilterInput,
  CalendarQueryInput,
} from '@/server/validators/event.validator'

// FullCalendar event data shape
export interface FullCalendarEvent {
  id: string
  title: string
  start: string
  end: string
  extendedProps: {
    status: EventStatus
    clubId: string
    clubName: string
    clubCode: string
    venueId: string
    venueName: string
    eventType: string
    expectedAttendees: number
    targetYears: number[]
    targetBranches: string[]
    organizer: string
  }
}

export class EventService {
  /**
   * Creates a new event in DRAFT status.
   * Transactionally writes an immutable AuditLog record.
   */
  async createEvent(user: SessionUser, input: CreateEventInput) {
    // 1. Authorization & Ownership
    assertCan(user, 'CREATE_EVENT')
    assertCanAccessClub(user, input.clubId)

    const startAt = new Date(input.startAt)
    const endAt = new Date(input.endAt)

    if (!isValidEventInterval(startAt, endAt)) {
      throw new BusinessRuleError('Invalid event interval: startAt must precede endAt')
    }

    // 2. Validate referenced entities
    const [club, venue, semester] = await Promise.all([
      prisma.club.findUnique({ where: { id: input.clubId } }),
      prisma.venue.findUnique({ where: { id: input.venueId } }),
      prisma.semester.findUnique({ where: { id: input.semesterId } }),
    ])

    if (!club || !club.isActive || club.deletedAt) {
      throw new NotFoundError('Club', input.clubId)
    }

    if (!venue || !venue.isActive) {
      throw new NotFoundError('Venue', input.venueId)
    }

    if (!semester) {
      throw new NotFoundError('Semester', input.semesterId)
    }

    if (semester.isLocked) {
      throw new SemesterLockedError(semester.name)
    }

    // 3. Transactional create + audit log
    return await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          eventType: input.eventType,
          clubId: input.clubId,
          venueId: input.venueId,
          semesterId: input.semesterId,
          submittedByUserId: user.id, // Strictly server-derived from authenticated session
          startAt,
          endAt,
          targetYears: input.targetYears,
          targetBranches: input.targetBranches,
          expectedAttendees: input.expectedAttendees,
          status: EventStatus.DRAFT,
          bannerUrl: input.bannerUrl ?? null,
          tags: input.tags,
        },
        include: {
          club: true,
          venue: true,
          semester: true,
          submittedBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.EVENT_CREATE,
          targetType: 'Event',
          targetId: event.id,
          beforeState: undefined,
          afterState: {
            id: event.id,
            title: event.title,
            status: event.status,
            clubId: event.clubId,
            venueId: event.venueId,
            startAt: event.startAt.toISOString(),
            endAt: event.endAt.toISOString(),
          },
          metadata: { source: 'api' },
        },
      })

      return event
    })
  }

  /**
   * Retrieves events with filtering and safe pagination.
   * Enforces role-based visibility rules.
   */
  async getEvents(user: SessionUser, filters: EventFilterInput) {
    assertCan(user, 'VIEW_CALENDAR')

    const where: Prisma.EventWhereInput = {
      deletedAt: null,
    }

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.clubId) {
      where.clubId = filters.clubId
    }

    if (filters.venueId) {
      where.venueId = filters.venueId
    }

    if (filters.eventType) {
      where.eventType = filters.eventType
    }

    if (filters.from || filters.to) {
      where.startAt = {}
      if (filters.from) {
        where.startAt.gte = new Date(filters.from)
      }
      if (filters.to) {
        where.startAt.lte = new Date(filters.to)
      }
    }

    // Role-based visibility isolation
    if (user.role === UserRole.VIEWER) {
      where.status = { in: [EventStatus.VERIFIED, EventStatus.COMPLETED] }
    } else if (user.role === UserRole.CLUB_REP && user.clubId) {
      // Rep sees verified/completed events + any event belonging to their own club
      where.OR = [
        { status: { in: [EventStatus.VERIFIED, EventStatus.COMPLETED] } },
        { clubId: user.clubId },
      ]
    } else if (user.role === UserRole.ACM_EXEC && user.clubId) {
      // Exec sees verified/completed + all ACM events
      where.OR = [
        { status: { in: [EventStatus.VERIFIED, EventStatus.COMPLETED] } },
        { clubId: user.clubId },
      ]
    }
    // ACM_CORE and SUPER_ADMIN see all active events matching filters

    const skip = (filters.page - 1) * filters.pageSize
    const take = filters.pageSize

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take,
        orderBy: { startAt: 'asc' },
        include: {
          club: true,
          venue: true,
          semester: true,
          submittedBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.event.count({ where }),
    ])

    return {
      events,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    }
  }

  /**
   * Retrieves a single event by ID with full relations.
   */
  async getEventById(user: SessionUser, eventId: string) {
    assertCan(user, 'VIEW_EVENT')

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: {
        club: true,
        venue: true,
        semester: true,
        submittedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!event) {
      throw new NotFoundError('Event', eventId)
    }

    // Visibility boundary: Viewers cannot see unverified draft/rejected events
    if (user.role === UserRole.VIEWER) {
      if (event.status !== EventStatus.VERIFIED && event.status !== EventStatus.COMPLETED) {
        throw new NotFoundError('Event', eventId)
      }
    }

    // Other club reps cannot inspect other clubs' private drafts
    if (user.role === UserRole.CLUB_REP && event.clubId !== user.clubId) {
      if (event.status === EventStatus.DRAFT || event.status === EventStatus.REJECTED) {
        throw new NotFoundError('Event', eventId)
      }
    }

    return event
  }

  /**
   * Updates an existing event.
   * Only allowed in DRAFT or SUBMITTED status.
   */
  async updateEvent(user: SessionUser, eventId: string, input: UpdateEventInput) {
    assertCan(user, 'UPDATE_EVENT')

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })

    if (!event) {
      throw new NotFoundError('Event', eventId)
    }

    // Ownership check
    if (!canManageEvent(user, event)) {
      throw new ForbiddenError(`Forbidden: Cannot edit event for club '${event.clubId}'`)
    }

    // State invariant: Cannot edit once verified, rejected, or completed
    if (event.status !== EventStatus.DRAFT && event.status !== EventStatus.SUBMITTED) {
      throw new BusinessRuleError(`Cannot edit event in status '${event.status}'. Must be DRAFT or SUBMITTED.`)
    }

    // Check if new startAt/endAt are valid
    const newStart = input.startAt ? new Date(input.startAt) : event.startAt
    const newEnd = input.endAt ? new Date(input.endAt) : event.endAt

    if (!isValidEventInterval(newStart, newEnd)) {
      throw new BusinessRuleError('Invalid event interval: startAt must precede endAt')
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          title: input.title ?? event.title,
          description: input.description !== undefined ? input.description : event.description,
          eventType: input.eventType ?? event.eventType,
          venueId: input.venueId ?? event.venueId,
          semesterId: input.semesterId ?? event.semesterId,
          startAt: newStart,
          endAt: newEnd,
          targetYears: input.targetYears ?? event.targetYears,
          targetBranches: input.targetBranches ?? event.targetBranches,
          expectedAttendees: input.expectedAttendees ?? event.expectedAttendees,
          bannerUrl: input.bannerUrl !== undefined ? input.bannerUrl : event.bannerUrl,
          tags: input.tags ?? event.tags,
        },
        include: {
          club: true,
          venue: true,
          semester: true,
        },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.EVENT_UPDATE,
          targetType: 'Event',
          targetId: eventId,
          beforeState: {
            title: event.title,
            startAt: event.startAt.toISOString(),
            endAt: event.endAt.toISOString(),
          },
          afterState: {
            title: updated.title,
            startAt: updated.startAt.toISOString(),
            endAt: updated.endAt.toISOString(),
          },
        },
      })

      return updated
    })
  }

  /**
   * Soft deletes an event (sets deletedAt timestamp).
   * Does NOT physically remove the record.
   */
  async deleteEvent(user: SessionUser, eventId: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })

    if (!event) {
      throw new NotFoundError('Event', eventId)
    }

    // Ownership check: ACM_CORE/SUPER_ADMIN or owning club rep
    if (!canManageEvent(user, event)) {
      throw new ForbiddenError(`Forbidden: Cannot delete event for club '${event.clubId}'`)
    }

    return await prisma.$transaction(async (tx) => {
      const deleted = await tx.event.update({
        where: { id: eventId },
        data: { deletedAt: new Date() },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.EVENT_CANCEL,
          targetType: 'Event',
          targetId: eventId,
          beforeState: { deletedAt: null },
          afterState: { deletedAt: deleted.deletedAt?.toISOString() },
          metadata: { note: 'Event soft deleted' },
        },
      })

      return { success: true, id: eventId, deletedAt: deleted.deletedAt }
    })
  }

  /**
   * Submits an event for ACM Core review.
   * State Machine: DRAFT -> SUBMITTED.
   */
  async submitEvent(user: SessionUser, eventId: string) {
    assertCan(user, 'SUBMIT_EVENT')

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })

    if (!event) {
      throw new NotFoundError('Event', eventId)
    }

    if (!canManageEvent(user, event)) {
      throw new ForbiddenError(`Forbidden: Cannot submit event for club '${event.clubId}'`)
    }

    if (event.status !== EventStatus.DRAFT) {
      throw new BusinessRuleError(`Cannot submit event: status is currently '${event.status}', expected 'DRAFT'`)
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: { status: EventStatus.SUBMITTED },
        include: { club: true, venue: true },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.EVENT_SUBMIT,
          targetType: 'Event',
          targetId: eventId,
          beforeState: { status: EventStatus.DRAFT },
          afterState: { status: EventStatus.SUBMITTED },
          metadata: { note: 'Event submitted for verification' },
        },
      })

      return updated
    })
  }

  /**
   * Verifies an event.
   * State Machine: SUBMITTED -> VERIFIED.
   * Restricted to ACM_CORE and SUPER_ADMIN.
   */
  async verifyEvent(user: SessionUser, eventId: string, comment?: string) {
    assertCan(user, 'VERIFY_EVENT')

    // Run conflict detection before verifying
    await conflictService.detectConflicts(user, eventId)

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })

    if (!event) {
      throw new NotFoundError('Event', eventId)
    }

    if (event.status !== EventStatus.SUBMITTED) {
      throw new BusinessRuleError(`Cannot verify event: status is currently '${event.status}', expected 'SUBMITTED'`)
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          status: EventStatus.VERIFIED,
          rejectionReason: null,
        },
        include: { club: true, venue: true },
      })

      await tx.eventReview.create({
        data: {
          eventId,
          reviewerUserId: user.id,
          decision: ReviewDecision.VERIFIED,
          comment: comment ?? null,
        },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.EVENT_VERIFY,
          targetType: 'Event',
          targetId: eventId,
          beforeState: { status: EventStatus.SUBMITTED },
          afterState: { status: EventStatus.VERIFIED },
          metadata: { comment: comment ?? 'Event verified by ACM Core' },
        },
      })

      return updated
    })
  }

  /**
   * Rejects an event submission with a mandatory reason.
   * State Machine: SUBMITTED -> REJECTED.
   * Restricted to ACM_CORE and SUPER_ADMIN.
   */
  async rejectEvent(user: SessionUser, eventId: string, reason: string) {
    assertCan(user, 'REJECT_EVENT')

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })

    if (!event) {
      throw new NotFoundError('Event', eventId)
    }

    if (event.status !== EventStatus.SUBMITTED) {
      throw new BusinessRuleError(`Cannot reject event: status is currently '${event.status}', expected 'SUBMITTED'`)
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          status: EventStatus.REJECTED,
          rejectionReason: reason,
        },
        include: { club: true, venue: true },
      })

      await tx.eventReview.create({
        data: {
          eventId,
          reviewerUserId: user.id,
          decision: ReviewDecision.REJECTED,
          comment: reason,
        },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.EVENT_REJECT,
          targetType: 'Event',
          targetId: eventId,
          beforeState: { status: EventStatus.SUBMITTED },
          afterState: { status: EventStatus.REJECTED },
          metadata: { reason },
        },
      })

      return updated
    })
  }

  /**
   * Cancels an event with a reason.
   * Allowed from VERIFIED or SUBMITTED status.
   */
  async cancelEvent(user: SessionUser, eventId: string, reason: string) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })

    if (!event) {
      throw new NotFoundError('Event', eventId)
    }

    assertCan(user, 'CANCEL_EVENT')

    if (event.status === EventStatus.CANCELLED || event.status === EventStatus.COMPLETED) {
      throw new BusinessRuleError(`Cannot cancel event: status is already '${event.status}'`)
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: {
          status: EventStatus.CANCELLED,
          rejectionReason: reason,
        },
        include: { club: true, venue: true },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: AuditAction.EVENT_CANCEL,
          targetType: 'Event',
          targetId: eventId,
          beforeState: { status: event.status },
          afterState: { status: EventStatus.CANCELLED },
          metadata: { reason },
        },
      })

      return updated
    })
  }

  /**
   * Calendar API: Queries events in a bounded date window.
   * Returns FullCalendar-compatible format.
   * Always excludes soft-deleted records.
   */
  async getCalendarEvents(user: SessionUser, query: CalendarQueryInput): Promise<FullCalendarEvent[]> {
    assertCan(user, 'VIEW_CALENDAR')

    const fromDate = new Date(query.from)
    const toDate = new Date(query.to)

    // End-exclusive overlap condition: startAt < toDate AND endAt > fromDate
    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      startAt: { lt: toDate },
      endAt: { gt: fromDate },
    }

    // Role-based visibility
    if (user.role === UserRole.VIEWER) {
      where.status = { in: [EventStatus.VERIFIED, EventStatus.COMPLETED] }
    } else if (user.role === UserRole.CLUB_REP && user.clubId) {
      where.OR = [
        { status: { in: [EventStatus.VERIFIED, EventStatus.COMPLETED] } },
        { clubId: user.clubId },
      ]
    } else if (user.role === UserRole.ACM_EXEC && user.clubId) {
      where.OR = [
        { status: { in: [EventStatus.VERIFIED, EventStatus.COMPLETED] } },
        { clubId: user.clubId },
      ]
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        club: true,
        venue: true,
      },
      take: 500, // Safe bounded query to prevent memory exhaustion
    })

    return events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.startAt.toISOString(),
      end: e.endAt.toISOString(),
      extendedProps: {
        status: e.status,
        clubId: e.clubId,
        clubName: e.club.name,
        clubCode: e.club.code,
        venueId: e.venueId,
        venueName: e.venue.name,
        eventType: e.eventType,
        expectedAttendees: e.expectedAttendees,
        targetYears: e.targetYears,
        targetBranches: e.targetBranches,
        organizer: e.club.name,
      },
    }))
  }
}

export const eventService = new EventService()
