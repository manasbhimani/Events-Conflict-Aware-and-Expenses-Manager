import { describe, it, expect } from 'vitest'
import { UserRole } from '@prisma/client'
import { can, assertCan, ROLE_PERMISSIONS, type Action } from '@/server/policies/rbac.policy'
import { ForbiddenError } from '@/server/lib/errors'

describe('RBAC Policy Matrix Unit Tests', () => {
  const allActions: Action[] = [
    'VIEW_CALENDAR',
    'VIEW_EVENT',
    'CREATE_EVENT',
    'UPDATE_EVENT',
    'SUBMIT_EVENT',
    'VERIFY_EVENT',
    'REJECT_EVENT',
    'CANCEL_EVENT',
    'ACKNOWLEDGE_CONFLICT',
    'RESOLVE_CONFLICT',
    'OVERRIDE_CONFLICT',
    'CREATE_EXPENSE',
    'UPDATE_EXPENSE',
    'APPROVE_EXPENSE',
    'REJECT_EXPENSE',
    'VIEW_BUDGET',
    'MANAGE_BUDGET',
    'LOCK_SEMESTER',
    'VIEW_ARCHIVE',
    'VIEW_REPORTS',
    'VIEW_AUDIT',
  ]

  describe('SUPER_ADMIN permissions', () => {
    const user = { role: UserRole.SUPER_ADMIN }

    it('can perform every action in the system', () => {
      for (const action of allActions) {
        expect(can(user, action), `SUPER_ADMIN should be able to perform ${action}`).toBe(true)
      }
    })

    it('assertCan does not throw for any action', () => {
      expect(() => assertCan({ id: 'u1', email: 'a@c.edu', name: 'Admin', role: UserRole.SUPER_ADMIN, clubId: null }, 'LOCK_SEMESTER')).not.toThrow()
    })
  })

  describe('ACM_CORE permissions', () => {
    const user = { role: UserRole.ACM_CORE }

    it('can perform all institutional management actions', () => {
      for (const action of allActions) {
        expect(can(user, action), `ACM_CORE should be able to perform ${action}`).toBe(true)
      }
    })

    it('can verify, reject, and override events and conflicts', () => {
      expect(can(user, 'VERIFY_EVENT')).toBe(true)
      expect(can(user, 'REJECT_EVENT')).toBe(true)
      expect(can(user, 'RESOLVE_CONFLICT')).toBe(true)
      expect(can(user, 'OVERRIDE_CONFLICT')).toBe(true)
      expect(can(user, 'LOCK_SEMESTER')).toBe(true)
      expect(can(user, 'VIEW_AUDIT')).toBe(true)
    })
  })

  describe('ACM_EXEC permissions', () => {
    const user = { role: UserRole.ACM_EXEC }

    it('can view calendar and submit/create ACM events', () => {
      expect(can(user, 'VIEW_CALENDAR')).toBe(true)
      expect(can(user, 'VIEW_EVENT')).toBe(true)
      expect(can(user, 'CREATE_EVENT')).toBe(true)
      expect(can(user, 'UPDATE_EVENT')).toBe(true)
      expect(can(user, 'SUBMIT_EVENT')).toBe(true)
      expect(can(user, 'CREATE_EXPENSE')).toBe(true)
      expect(can(user, 'UPDATE_EXPENSE')).toBe(true)
      expect(can(user, 'VIEW_BUDGET')).toBe(true)
      expect(can(user, 'VIEW_ARCHIVE')).toBe(true)
      expect(can(user, 'VIEW_REPORTS')).toBe(true)
    })

    it('CANNOT verify or reject events', () => {
      expect(can(user, 'VERIFY_EVENT')).toBe(false)
      expect(can(user, 'REJECT_EVENT')).toBe(false)
    })

    it('CANNOT approve or reject expenses', () => {
      expect(can(user, 'APPROVE_EXPENSE')).toBe(false)
      expect(can(user, 'REJECT_EXPENSE')).toBe(false)
    })

    it('CANNOT resolve or override conflicts', () => {
      expect(can(user, 'RESOLVE_CONFLICT')).toBe(false)
      expect(can(user, 'OVERRIDE_CONFLICT')).toBe(false)
    })

    it('CANNOT lock semesters or manage budgets or view audit logs', () => {
      expect(can(user, 'LOCK_SEMESTER')).toBe(false)
      expect(can(user, 'MANAGE_BUDGET')).toBe(false)
      expect(can(user, 'VIEW_AUDIT')).toBe(false)
    })
  })

  describe('CLUB_REP permissions', () => {
    const user = { role: UserRole.CLUB_REP }

    it('can view calendar and manage own club submissions', () => {
      expect(can(user, 'VIEW_CALENDAR')).toBe(true)
      expect(can(user, 'VIEW_EVENT')).toBe(true)
      expect(can(user, 'CREATE_EVENT')).toBe(true)
      expect(can(user, 'UPDATE_EVENT')).toBe(true)
      expect(can(user, 'SUBMIT_EVENT')).toBe(true)
      expect(can(user, 'ACKNOWLEDGE_CONFLICT')).toBe(true)
      expect(can(user, 'CREATE_EXPENSE')).toBe(true)
      expect(can(user, 'UPDATE_EXPENSE')).toBe(true)
    })

    it('CANNOT verify or reject events', () => {
      expect(can(user, 'VERIFY_EVENT')).toBe(false)
      expect(can(user, 'REJECT_EVENT')).toBe(false)
    })

    it('CANNOT approve or reject expenses', () => {
      expect(can(user, 'APPROVE_EXPENSE')).toBe(false)
      expect(can(user, 'REJECT_EXPENSE')).toBe(false)
    })

    it('CANNOT resolve or override conflicts', () => {
      expect(can(user, 'RESOLVE_CONFLICT')).toBe(false)
      expect(can(user, 'OVERRIDE_CONFLICT')).toBe(false)
    })

    it('CANNOT access institutional budget management, locks, archive or audit', () => {
      expect(can(user, 'VIEW_BUDGET')).toBe(false)
      expect(can(user, 'MANAGE_BUDGET')).toBe(false)
      expect(can(user, 'LOCK_SEMESTER')).toBe(false)
      expect(can(user, 'VIEW_ARCHIVE')).toBe(false)
      expect(can(user, 'VIEW_REPORTS')).toBe(false)
      expect(can(user, 'VIEW_AUDIT')).toBe(false)
    })
  })

  describe('VIEWER permissions', () => {
    const user = { role: UserRole.VIEWER }

    it('can only view calendar and permitted events', () => {
      expect(can(user, 'VIEW_CALENDAR')).toBe(true)
      expect(can(user, 'VIEW_EVENT')).toBe(true)
    })

    it('CANNOT perform any state-changing operations', () => {
      const forbiddenActions: Action[] = [
        'CREATE_EVENT',
        'UPDATE_EVENT',
        'SUBMIT_EVENT',
        'VERIFY_EVENT',
        'REJECT_EVENT',
        'CANCEL_EVENT',
        'ACKNOWLEDGE_CONFLICT',
        'RESOLVE_CONFLICT',
        'OVERRIDE_CONFLICT',
        'CREATE_EXPENSE',
        'UPDATE_EXPENSE',
        'APPROVE_EXPENSE',
        'REJECT_EXPENSE',
        'VIEW_BUDGET',
        'MANAGE_BUDGET',
        'LOCK_SEMESTER',
        'VIEW_ARCHIVE',
        'VIEW_REPORTS',
        'VIEW_AUDIT',
      ]

      for (const action of forbiddenActions) {
        expect(can(user, action), `VIEWER must NOT be able to ${action}`).toBe(false)
      }
    })
  })

  describe('Anonymous / Null User handling', () => {
    it('returns false when user is null or undefined', () => {
      expect(can(null, 'VIEW_CALENDAR')).toBe(false)
      expect(can(undefined, 'VIEW_CALENDAR')).toBe(false)
    })

    it('assertCan throws ForbiddenError for unauthorized user', () => {
      expect(() => {
        assertCan({ id: 'v1', email: 'v@c.edu', name: 'V', role: UserRole.VIEWER, clubId: null }, 'CREATE_EVENT')
      }).toThrowError(ForbiddenError)
    })
  })
})
