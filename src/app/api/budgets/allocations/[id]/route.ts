import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import { budgetService } from '@/server/services/budget.service'
import { UpdateBudgetAllocationSchema } from '@/server/validators/budget.validator'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; const user = await requireUser()
    const body = await req.json()
    const data = UpdateBudgetAllocationSchema.parse(body)

    const allocation = await budgetService.updateAllocation(user, id, data)
    return successResponse(allocation)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; const user = await requireUser()
    const result = await budgetService.deleteAllocation(user, id)
    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
