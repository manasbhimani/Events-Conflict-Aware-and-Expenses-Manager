import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import { eventService } from '@/server/services/event.service'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    let comment: string | undefined

    try {
      const body = await req.json()
      comment = body.comment
    } catch {
      // Optional body
    }

    const event = await eventService.verifyEvent(user, id, comment)
    return successResponse(event)
  } catch (error) {
    return handleApiError(error)
  }
}
