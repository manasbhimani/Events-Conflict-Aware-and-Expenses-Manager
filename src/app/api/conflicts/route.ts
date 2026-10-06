import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import { ForbiddenError } from '@/server/lib/errors'
import prisma from '@/server/lib/prisma'
import { ConflictStatus, ConflictSeverity, ConflictType } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()

    if (user.role === 'VIEWER') {
      throw new ForbiddenError('Viewers cannot view conflicts.')
    }

    const { searchParams } = req.nextUrl
    const statusParam = searchParams.get('status')
    const severityParam = searchParams.get('severity')
    const typeParam = searchParams.get('conflictType')

    const where: any = {}

    if (statusParam && Object.values(ConflictStatus).includes(statusParam as ConflictStatus)) {
      where.status = statusParam as ConflictStatus
    }

    if (severityParam && Object.values(ConflictSeverity).includes(severityParam as ConflictSeverity)) {
      where.severity = severityParam as ConflictSeverity
    }

    if (typeParam && Object.values(ConflictType).includes(typeParam as ConflictType)) {
      where.conflictType = typeParam as ConflictType
    }

    // Role boundary: CLUB_REP can only inspect conflicts involving their own club's events
    if (user.role === 'CLUB_REP' && user.clubId) {
      where.OR = [
        { eventA: { clubId: user.clubId } },
        { eventB: { clubId: user.clubId } },
      ]
    }

    const conflicts = await prisma.conflictRecord.findMany({
      where,
      include: {
        eventA: {
          select: {
            id: true,
            title: true,
            clubId: true,
            eventType: true,
            startAt: true,
            endAt: true,
            club: { select: { id: true, name: true, code: true } },
            venue: { select: { id: true, name: true } },
          },
        },
        eventB: {
          select: {
            id: true,
            title: true,
            clubId: true,
            eventType: true,
            startAt: true,
            endAt: true,
            club: { select: { id: true, name: true, code: true } },
            venue: { select: { id: true, name: true } },
          },
        },
        resolvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return successResponse(conflicts)
  } catch (error) {
    return handleApiError(error)
  }
}
