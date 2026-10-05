import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import { eventService } from '@/server/services/event.service'
import { calendarQuerySchema } from '@/server/validators/event.validator'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const validated = calendarQuerySchema.parse(searchParams)
    const calendarEvents = await eventService.getCalendarEvents(user, validated)
    return successResponse(calendarEvents)
  } catch (error) {
    return handleApiError(error)
  }
}
