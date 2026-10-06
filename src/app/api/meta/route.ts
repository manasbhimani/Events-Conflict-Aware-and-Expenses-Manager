import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import prisma from '@/server/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    await requireUser()

    const [clubs, venues, semesters, categories] = await Promise.all([
      prisma.club.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true, code: true, isInternalAcm: true },
        orderBy: { name: 'asc' },
      }),
      prisma.venue.findMany({
        where: { isActive: true },
        select: { id: true, name: true, capacity: true },
        orderBy: { name: 'asc' },
      }),
      prisma.semester.findMany({
        select: { id: true, name: true, isLocked: true, startDate: true, endDate: true },
        orderBy: { startDate: 'desc' },
      }),
      prisma.expenseCategory.findMany({
        select: { id: true, name: true, description: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return successResponse({
      clubs,
      venues,
      semesters,
      categories,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
