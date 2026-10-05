import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import { eventService } from '@/server/services/event.service'
import { cancelEventSchema } from '@/server/validators/event.validator'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    const body = await req.json()
    const validated = cancelEventSchema.parse(body)
    const event = await eventService.cancelEvent(user, id, validated.reason)
    return successResponse(event)
  } catch (error) {
    return handleApiError(error)
  }
}
