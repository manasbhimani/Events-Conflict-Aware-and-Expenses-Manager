import { NextRequest } from 'next/server'
import { auth } from '@/server/lib/auth'
import { expenseService } from '@/server/services/expense.service'
import { successResponse, unauthorizedResponse, handleApiError } from '@/server/lib/api-response'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return unauthorizedResponse()

    const { id } = await params
    const expense = await expenseService.submitExpense(session.user, id)
    return successResponse(expense)
  } catch (error) {
    return handleApiError(error)
  }
}
