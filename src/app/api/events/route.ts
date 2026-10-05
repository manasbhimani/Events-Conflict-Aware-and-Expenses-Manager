import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import { eventService } from '@/server/services/event.service'
import { createEventSchema, eventFilterSchema } from '@/server/validators/event.validator'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const validatedData = createEventSchema.parse(body)
    const event = await eventService.createEvent(user, validatedData)
    return successResponse(event, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const filters = eventFilterSchema.parse(searchParams)
    const result = await eventService.getEvents(user, filters)
    return successResponse(result.events, 200, {
      page: result.page,
      limit: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
