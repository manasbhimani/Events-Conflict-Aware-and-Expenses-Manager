import { Event, EventStatus, ConflictType, ConflictStatus, ConflictRecord, Prisma } from '@prisma/client'
import { prisma } from '@/server/lib/prisma'
import { notificationService } from './notification.service'
import { SessionUser } from '@/server/types'
import { assertCan, can } from '@/server/policies/rbac.policy'
import { ForbiddenError, NotFoundError, BusinessRuleError } from '@/server/lib/errors'
import { intervalsOverlap, isTightTurnaround, calculateOverlapRatio } from '@/server/lib/conflict/time.util'
import { calculateJaccardAudience } from '@/server/lib/conflict/audience.util'
import { calculateConflictScore, calculateSameTypeFactor, calculateSizeFactor, determineSeverity } from '@/server/lib/conflict/score.util'

export class ConflictService {
  /**
   * Run conflict detection for a given event.
   * Discovers candidates, calculates conflicts, and upserts ConflictRecords.
   */
  async detectConflicts(user: SessionUser, eventId: string): Promise<ConflictRecord[]> {
    // Determine visibility/permission. For now, assume anyone who can view the event can detect conflicts.
    // However, the prompt says: POST /api/events/:id/conflicts/detect requires auth, enforce appropriate visibility.
    // We'll enforce VIEW_EVENT.
    assertCan(user, 'VIEW_EVENT')

    const event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })

    if (!event) {
      throw new NotFoundError('Event', eventId)
    }

    if (event.status === EventStatus.REJECTED || event.status === EventStatus.CANCELLED) {
      // No active conflicts to detect
      return []
    }

    // Candidate window: event's time interval expanded by 30 minutes on both sides
    const gapThresholdMs = 30 * 60 * 1000
    const windowStart = new Date(event.startAt.getTime() - gapThresholdMs)
    const windowEnd = new Date(event.endAt.getTime() + gapThresholdMs)

    const candidates = await prisma.event.findMany({
      where: {
        id: { not: event.id },
        deletedAt: null,
        status: { notIn: [EventStatus.REJECTED, EventStatus.CANCELLED] },
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
    })

    const detectedConflicts: any[] = []

    for (const candidate of candidates) {
      // Canonical ordering
      const [eventA, eventB] = event.id < candidate.id ? [event, candidate] : [candidate, event]
      const eventAId = eventA.id
      const eventBId = eventB.id

      const isOverlap = intervalsOverlap(eventA.startAt, eventA.endAt, eventB.startAt, eventB.endAt)
      const isTight = isTightTurnaround(eventA.startAt, eventA.endAt, eventB.startAt, eventB.endAt)

      const jaccard = calculateJaccardAudience(
        eventA.targetYears, eventA.targetBranches,
        eventB.targetYears, eventB.targetBranches
      )
      const overlapRatio = calculateOverlapRatio(eventA.startAt, eventA.endAt, eventB.startAt, eventB.endAt)
      const sameType = calculateSameTypeFactor(eventA.eventType, eventB.eventType)
      const sizeFactor = calculateSizeFactor(eventA.expectedAttendees, eventB.expectedAttendees)

      const scoreRaw = calculateConflictScore(jaccard, overlapRatio, sameType, sizeFactor)
      const conflictScore = Math.round(scoreRaw * 100)
      const severity = determineSeverity(scoreRaw)

      let overlapStart = Math.max(eventA.startAt.getTime(), eventB.startAt.getTime())
      let overlapEnd = Math.min(eventA.endAt.getTime(), eventB.endAt.getTime())
      let overlapMinutes = isOverlap ? Math.floor(Math.max(0, overlapEnd - overlapStart) / 60000) : 0

      // Evaluate conflict types
      const typesToFlag: Array<{ type: ConflictType; description: string; suggestion: string }> = []

      // 1. VENUE
      if (isOverlap && eventA.venueId === eventB.venueId) {
        typesToFlag.push({
          type: ConflictType.VENUE,
          description: `Both events use the same venue at the same time.`,
          suggestion: 'Choose another venue or change timing.',
        })
      }

      // 2. ORGANIZER
      if (isOverlap && eventA.clubId === eventB.clubId) {
        typesToFlag.push({
          type: ConflictType.ORGANIZER,
          description: `Both events are organized by the same club simultaneously.`,
          suggestion: 'Consider changing the event timing.',
        })
      }

      // 3. AUDIENCE
      if (isOverlap && jaccard > 0) {
        // As per prompt: LOW shouldn't automatically create a conflict unless the type is meaningful.
        // For audience, we might only flag it if it's MEDIUM or HIGH, OR if they have a non-trivial jaccard (e.g. > 0).
        // Let's flag it if score >= 40 (MEDIUM) OR if jaccard is substantial (>= 0.2).
        // Actually, prompt says: "LOW should not automatically create a conflict record unless the conflict type itself is meaningful according to the detection rules."
        // We can just flag AUDIENCE if there's overlap and jaccard > 0, then rely on score to filter if needed. Let's flag it if score >= 40 OR jaccard >= 0.2
        if (severity !== 'LOW' || jaccard > 0.2) {
           typesToFlag.push({
            type: ConflictType.AUDIENCE,
            description: `Events have overlapping target audiences (similarity: ${Math.round(jaccard * 100)}%).`,
            suggestion: 'Consider coordinating the schedule because the target audience overlaps.',
          })
        }
      }

      // 4. TIGHT_TURNAROUND
      if (isTight && eventA.venueId === eventB.venueId) {
        // Tight turnaround usually applies to same venue.
        typesToFlag.push({
          type: ConflictType.TIGHT_TURNAROUND,
          description: `Events at the same venue have less than 30 minutes between them.`,
          suggestion: 'Consider increasing the gap between events.',
        })
      } else if (isTight && eventA.clubId === eventB.clubId) {
        // Or same organizer
        typesToFlag.push({
          type: ConflictType.TIGHT_TURNAROUND,
          description: `Events by the same organizer have less than 30 minutes between them.`,
          suggestion: 'Consider increasing the gap between events.',
        })
      }

      for (const flag of typesToFlag) {
        detectedConflicts.push({
          eventAId,
          eventBId,
          conflictType: flag.type,
          severity,
          overlapMinutes: flag.type === ConflictType.VENUE || flag.type === ConflictType.ORGANIZER ? overlapMinutes : null,
          conflictScore,
          description: flag.description,
          suggestion: flag.suggestion,
        })
      }
    }

    // Upsert conflicts safely using transactions
    const results: ConflictRecord[] = []
    
    // We also need to mark stale conflicts!
    // Stale conflicts = conflicts involving `eventId` that are NOT in `detectedConflicts`.
    // But we only want to mark them stale if they were detected previously for this event.
    // So first, fetch existing OPEN or ACKNOWLEDGED conflicts involving this event.
    const existingConflicts = await prisma.conflictRecord.findMany({
      where: {
        OR: [{ eventAId: event.id }, { eventBId: event.id }],
        status: { in: [ConflictStatus.OPEN, ConflictStatus.ACKNOWLEDGED] }
      }
    })

    const detectedKeys = new Set(
      detectedConflicts.map(c => `${c.eventAId}_${c.eventBId}_${c.conflictType}`)
    )

    const staleIds = existingConflicts
      .filter(c => !detectedKeys.has(`${c.eventAId}_${c.eventBId}_${c.conflictType}`))
      .map(c => c.id)

    await prisma.$transaction(async (tx) => {
      // Upsert new ones
      for (const c of detectedConflicts) {
        const record = await tx.conflictRecord.upsert({
          where: {
            eventAId_eventBId_conflictType: {
              eventAId: c.eventAId,
              eventBId: c.eventBId,
              conflictType: c.conflictType
            }
          },
          update: {
            severity: c.severity,
            overlapMinutes: c.overlapMinutes,
            conflictScore: c.conflictScore,
            description: c.description,
            resolutionNote: c.suggestion, // Storing suggestion in resolutionNote (or description). The schema has no suggestion field, so let's append it to description or resolutionNote. Let's append to description.
          },
          create: {
            eventAId: c.eventAId,
            eventBId: c.eventBId,
            conflictType: c.conflictType,
            severity: c.severity,
            overlapMinutes: c.overlapMinutes,
            conflictScore: c.conflictScore,
            description: `${c.description}\nSuggestion: ${c.suggestion}`,
            status: ConflictStatus.OPEN
          }
        })
        results.push(record)

          // Notification Logic
          const existing = existingConflicts.find(ex => 
            ex.eventAId === record.eventAId && 
            ex.eventBId === record.eventBId && 
            ex.conflictType === record.conflictType
          )
          
          if (!existing) {
             const otherEventId = record.eventAId === event.id ? record.eventBId : record.eventAId
             const otherEvent = await tx.event.findUnique({ where: { id: otherEventId }, select: { clubId: true, title: true } })
             
             await notificationService.notifyCoreReviewers({
               type: 'CONFLICT_FLAGGED',
               title: 'New Conflict Detected',
               message: `Conflict of type '${record.conflictType}' detected between '${event.title}' and '${otherEvent?.title}'.`,
               linkUrl: `/conflicts/`,
               idempotencyKey: `conflict_new_${record.id}`,
             }, user.id, tx)
             
             await notificationService.notifyClubRepresentatives(event.clubId, {
               type: 'CONFLICT_FLAGGED',
               title: 'New Conflict Detected',
               message: `Conflict of type '${record.conflictType}' detected for your event '${event.title}'.`,
               linkUrl: `/conflicts/`,
               idempotencyKey: `conflict_new_${record.id}_A`,
             }, user.id, tx)

             if (otherEvent) {
               await notificationService.notifyClubRepresentatives(otherEvent.clubId, {
                 type: 'CONFLICT_FLAGGED',
                 title: 'New Conflict Detected',
                 message: `Conflict of type '${record.conflictType}' detected for your event '${otherEvent.title}'.`,
                 linkUrl: `/conflicts/`,
                 idempotencyKey: `conflict_new_${record.id}_B`,
               }, user.id, tx)
             }
          } else if (existing.severity !== record.severity) {
             // Severity changed
             const otherEventId = record.eventAId === event.id ? record.eventBId : record.eventAId
             const otherEvent = await tx.event.findUnique({ where: { id: otherEventId }, select: { clubId: true, title: true } })
             
             await notificationService.notifyCoreReviewers({
               type: 'CONFLICT_FLAGGED',
               title: 'Conflict Severity Changed',
               message: `Severity changed to '${record.severity}' for conflict between '${event.title}' and '${otherEvent?.title}'.`,
               linkUrl: `/conflicts/`,
               idempotencyKey: `conflict_sev_${record.id}_${record.severity}`,
             }, user.id, tx)
          }
      }

      // Update stale conflicts. The schema has RESOLVED, OVERRIDDEN, OPEN, ACKNOWLEDGED.
      // We will mark stale ones as RESOLVED with a note.
      if (staleIds.length > 0) {
        await tx.conflictRecord.updateMany({
          where: { id: { in: staleIds } },
          data: {
            status: ConflictStatus.RESOLVED,
            resolutionNote: 'System automatically resolved: conflict no longer exists after event update.',
            resolvedAt: new Date() // Not setting resolvedByUserId to indicate system action
          }
        })
      }
    })

    return results
  }

  async getConflictsForEvent(user: SessionUser, eventId: string) {
    assertCan(user, 'VIEW_EVENT')

    const conflicts = await prisma.conflictRecord.findMany({
      where: {
        OR: [{ eventAId: eventId }, { eventBId: eventId }]
      },
      include: {
        eventA: { select: { id: true, title: true, clubId: true } },
        eventB: { select: { id: true, title: true, clubId: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return conflicts
  }

  async acknowledgeConflict(user: SessionUser, conflictId: string) {
    const conflict = await prisma.conflictRecord.findUnique({
      where: { id: conflictId },
      include: { eventA: true, eventB: true }
    })
    if (!conflict) throw new NotFoundError('Conflict', conflictId)

    // RBAC: CLUB_REP can ack if it's their event. ACM_CORE/SUPER_ADMIN can ack any.
    if (user.role === 'CLUB_REP') {
      const isOwner = user.clubId === conflict.eventA.clubId || user.clubId === conflict.eventB.clubId
      if (!isOwner) throw new ForbiddenError('You can only acknowledge conflicts for your own events.')
    } else {
      assertCan(user, 'ACKNOWLEDGE_CONFLICT')
    }

    if (conflict.status !== ConflictStatus.OPEN) {
      throw new BusinessRuleError('Only OPEN conflicts can be acknowledged.')
    }

    return prisma.conflictRecord.update({
      where: { id: conflictId },
      data: { status: ConflictStatus.ACKNOWLEDGED }
    })
  }

  async resolveConflict(user: SessionUser, conflictId: string, note: string) {
    assertCan(user, 'RESOLVE_CONFLICT')
    
    const conflict = await prisma.conflictRecord.findUnique({
      where: { id: conflictId }
    })
    if (!conflict) throw new NotFoundError('Conflict', conflictId)

    if (conflict.status === ConflictStatus.RESOLVED || conflict.status === ConflictStatus.OVERRIDDEN) {
      throw new BusinessRuleError(`Conflict is already ${conflict.status}`)
    }

    return prisma.conflictRecord.update({
      where: { id: conflictId },
      data: {
        status: ConflictStatus.RESOLVED,
        resolutionNote: note,
        resolvedByUserId: user.id,
        resolvedAt: new Date()
      }
    })
  }

  async overrideConflict(user: SessionUser, conflictId: string, note: string) {
    assertCan(user, 'OVERRIDE_CONFLICT')
    
    const conflict = await prisma.conflictRecord.findUnique({
      where: { id: conflictId }
    })
    if (!conflict) throw new NotFoundError('Conflict', conflictId)

    if (conflict.status === ConflictStatus.RESOLVED || conflict.status === ConflictStatus.OVERRIDDEN) {
      throw new BusinessRuleError(`Conflict is already ${conflict.status}`)
    }

    return prisma.conflictRecord.update({
      where: { id: conflictId },
      data: {
        status: ConflictStatus.OVERRIDDEN,
        resolutionNote: note,
        resolvedByUserId: user.id,
        resolvedAt: new Date()
      }
    })
  }
}

export const conflictService = new ConflictService()
