import { z } from 'zod'

export const CreateBudgetAllocationSchema = z.object({
  semesterId: z.string().min(1),
  categoryId: z.string().min(1),
  clubId: z.string().optional(),
  allocatedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a positive decimal with up to 2 decimal places and no sign').refine((val) => {
    const num = parseFloat(val)
    return num > 0
  }, 'Amount must be strictly greater than zero'),
  notes: z.string().max(1000).optional(),
})

export const UpdateBudgetAllocationSchema = z.object({
  allocatedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a positive decimal with up to 2 decimal places and no sign').refine((val) => {
    const num = parseFloat(val)
    return num > 0
  }, 'Amount must be strictly greater than zero').optional(),
  notes: z.string().max(1000).optional(),
})
