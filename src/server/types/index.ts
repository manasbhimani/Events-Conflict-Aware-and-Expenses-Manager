import type { 
  User, Club, Venue, Semester, Event, Expense,
  UserRole, EventStatus, EventType, ConflictType, 
  ConflictSeverity, ConflictStatus, ExpenseStatus,
  AuditAction, NotificationType
} from '@prisma/client'
import type { Decimal } from '@prisma/client/runtime/library'

// Re-export Prisma enums and types for convenience
export type { 
  User, Club, Venue, Semester, Event, Expense,
  UserRole, EventStatus, EventType, ConflictType,
  ConflictSeverity, ConflictStatus, ExpenseStatus,
  AuditAction, NotificationType, Decimal
}

// Audience representation
// An empty array means "ALL" for that dimension.
// targetYears = [] => All years
// targetBranches = [] => All branches
export interface AudienceSpec {
  years: number[]     // [] = all years (1-4 by convention)
  branches: string[]  // [] = all branches
}

// A fully-qualified audience cell used by the conflict engine
export interface AudienceCell {
  year: number | 'ALL'
  branch: string | 'ALL'
}

// Standard API response envelope
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
    [key: string]: unknown
  }
}

// Authenticated session user (derived from DB, never trusted from client)
export interface SessionUser {
  id: string
  email: string
  name: string
  role: UserRole
  clubId: string | null
}
