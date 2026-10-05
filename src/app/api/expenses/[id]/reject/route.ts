import { NextRequest } from 'next/server'
import { auth } from '@/server/lib/auth'
import { expenseService } from '@/server/services/expense.service'
import { successResponse, unauthorizedResponse, validationErrorResponse, handleApiError } from '@/server/lib/api-response'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) return unauthorizedResponse()

    const { id } = await params
    const body = await req.json()
    if (!body.reason) return validationErrorResponse({ reason: 'Required' }, 'Rejection reason is required')

    const expense = await expenseService.rejectExpense(session.user, id, body.reason)
    return successResponse(expense)
  } catch (error) {
    return handleApiError(error)
  }
}
