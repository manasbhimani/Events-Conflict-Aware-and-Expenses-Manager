import { describe, it, expect, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { CreateExpenseSchema, ExpenseQuerySchema } from '@/server/validators/expense.validator'

describe('Phase 5 API Validation', () => {
  it('validates amount perfectly', () => {
    // Valid amounts
    expect(CreateExpenseSchema.shape.amount.safeParse('10').success).toBe(true)
    expect(CreateExpenseSchema.shape.amount.safeParse('10.5').success).toBe(true)
    expect(CreateExpenseSchema.shape.amount.safeParse('10.50').success).toBe(true)
    expect(CreateExpenseSchema.shape.amount.safeParse('0.01').success).toBe(true)
    
    // Invalid amounts
    expect(CreateExpenseSchema.shape.amount.safeParse('0').success).toBe(false)
    expect(CreateExpenseSchema.shape.amount.safeParse('-10').success).toBe(false)
    expect(CreateExpenseSchema.shape.amount.safeParse('10.555').success).toBe(false)
    expect(CreateExpenseSchema.shape.amount.safeParse('NaN').success).toBe(false)
    expect(CreateExpenseSchema.shape.amount.safeParse('Infinity').success).toBe(false)
    expect(CreateExpenseSchema.shape.amount.safeParse('10,000.50').success).toBe(false)
  })

  it('validates date is ISO', () => {
    expect(CreateExpenseSchema.shape.date.safeParse('2026-10-01T10:00:00Z').success).toBe(true)
    expect(CreateExpenseSchema.shape.date.safeParse('2026-10-01').success).toBe(false)
  })

  it('validates pagination query safely', () => {
    expect(ExpenseQuerySchema.safeParse({ page: 1, limit: 10 }).success).toBe(true)
    expect(ExpenseQuerySchema.safeParse({ page: '1', limit: '10' }).success).toBe(true) // z.coerce
    expect(ExpenseQuerySchema.safeParse({ page: 0, limit: 10 }).success).toBe(false)
    expect(ExpenseQuerySchema.safeParse({ page: 1, limit: 101 }).success).toBe(false)
  })
})
