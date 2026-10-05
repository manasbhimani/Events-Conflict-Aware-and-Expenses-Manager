import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import { eventService } from '@/server/services/event.service'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    const event = await eventService.submitEvent(user, id)
    return successResponse(event)
  } catch (error) {
    return handleApiError(error)
  }
}
