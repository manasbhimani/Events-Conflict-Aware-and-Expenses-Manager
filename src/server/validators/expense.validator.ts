import { z } from 'zod'

export const CreateExpenseSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a positive decimal with up to 2 decimal places and no sign').refine((val) => {
    const num = parseFloat(val)
    return num > 0
  }, 'Amount must be strictly greater than zero'),
  categoryId: z.string().min(1),
  date: z.string().datetime(), // strict ISO
  eventId: z.string().optional(),
})

export const UpdateExpenseSchema = CreateExpenseSchema.partial()

export const ExpenseQuerySchema = z.object({
  semesterId: z.string().optional(),
  eventId: z.string().optional(),
  clubId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
