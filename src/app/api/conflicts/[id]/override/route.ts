import { NextRequest } from 'next/server'
import { auth } from '@/server/lib/auth'
import { conflictService } from '@/server/services/conflict.service'
import { successResponse, unauthorizedResponse, handleApiError } from '@/server/lib/api-response'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return unauthorizedResponse()

    const { id } = await params
    const body = await req.json()
    const updated = await conflictService.overrideConflict(session.user, id, body.note || '')
    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
