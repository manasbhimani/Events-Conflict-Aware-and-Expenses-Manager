import { NextRequest } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { expenseService } from '@/server/services/expense.service'
import { successResponse, unauthorizedResponse, validationErrorResponse, handleApiError } from '@/server/lib/api-response'
import { CreateExpenseSchema, ExpenseQuerySchema } from '@/server/validators/expense.validator'
import { ExpenseStatus } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    

    const body = await req.json()
    const parsed = CreateExpenseSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error.format())

    const expense = await expenseService.createExpense(user, parsed.data)
    return successResponse(expense, 201)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    

    const url = new URL(req.url)
    const rawQuery = {
      semesterId: url.searchParams.get('semesterId') || undefined,
      eventId: url.searchParams.get('eventId') || undefined,
      clubId: url.searchParams.get('clubId') || undefined,
      categoryId: url.searchParams.get('categoryId') || undefined,
      status: url.searchParams.get('status') || undefined,
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
      page: url.searchParams.get('page') || undefined,
      limit: url.searchParams.get('limit') || undefined,
    }

    const parsed = ExpenseQuerySchema.safeParse(rawQuery)
    if (!parsed.success) return validationErrorResponse(parsed.error.format())

    const result = await expenseService.getExpenses(user, {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
    })
    return successResponse(result.expenses, 200, {
      page: parsed.data.page,
      limit: parsed.data.limit,
      total: result.total,
      pages: result.pages
    })
  } catch (error) {
    return handleApiError(error)
  }
}
