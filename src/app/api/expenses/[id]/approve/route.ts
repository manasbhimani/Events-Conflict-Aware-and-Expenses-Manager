import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { expenseService } from '@/server/services/expense.service'
import { successResponse, unauthorizedResponse, handleApiError } from '@/server/lib/api-response'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    

    const { id } = await params
    const expense = await expenseService.approveExpense(user, id)
    return successResponse(expense)
  } catch (error) {
    return handleApiError(error)
  }
}
