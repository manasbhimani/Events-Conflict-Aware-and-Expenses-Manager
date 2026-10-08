import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { successResponse, handleApiError } from '@/server/lib/api-response'
import { budgetService } from '@/server/services/budget.service'
import { CreateBudgetAllocationSchema } from '@/server/validators/budget.validator'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const data = CreateBudgetAllocationSchema.parse(body)

    const allocation = await budgetService.createAllocation(user, data)
    return successResponse(allocation, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const semesterId = req.nextUrl.searchParams.get('semesterId')
    
    if (!semesterId) {
      return handleApiError(new Error('semesterId is required')) // Need proper validation error ideally, but handled by service if not found
    }

    const allocations = await budgetService.getAllocations(user, semesterId)
    return successResponse(allocations)
  } catch (error) {
    return handleApiError(error)
  }
}
