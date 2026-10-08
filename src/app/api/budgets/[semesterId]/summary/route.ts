import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import { budgetService } from '@/server/services/budget.service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ semesterId: string }> }
) {
  try {
    const { semesterId } = await params; const user = await requireUser()
    const summary = await budgetService.getSemesterSummary(user, semesterId)
    return successResponse(summary)
  } catch (error) {
    return handleApiError(error)
  }
}
