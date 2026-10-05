import { NextRequest } from 'next/server'
import { auth } from '@/server/lib/auth'
import { conflictService } from '@/server/services/conflict.service'
import { successResponse, unauthorizedResponse, handleApiError } from '@/server/lib/api-response'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return unauthorizedResponse()

    const { id } = await params
    const updated = await conflictService.acknowledgeConflict(session.user, id)
    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
