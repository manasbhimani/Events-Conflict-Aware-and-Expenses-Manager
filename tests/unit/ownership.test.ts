import { describe, it, expect } from 'vitest'
import { UserRole } from '@prisma/client'
import {
  canAccessClub,
  canManageEvent,
  canManageExpense,
  canAcknowledgeConflict,
  assertCanAccessClub,
} from '@/server/policies/rbac.policy'
import { ForbiddenError } from '@/server/lib/errors'
import type { SessionUser } from '@/server/types'

describe('Resource Ownership & Multi-Tenancy Unit Tests', () => {
  const clubAId = 'club-coding-id'
  const clubBId = 'club-robotics-id'
  const acmClubId = 'club-acm-id'

  const clubRepA: SessionUser = {
    id: 'user-rep-a',
    email: 'rep.a@college.edu',
    name: 'Club Rep A',
    role: UserRole.CLUB_REP,
    clubId: clubAId,
  }

  const clubRepB: SessionUser = {
    id: 'user-rep-b',
    email: 'rep.b@college.edu',
    name: 'Club Rep B',
    role: UserRole.CLUB_REP,
    clubId: clubBId,
  }

  const acmCoreUser: SessionUser = {
    id: 'user-core',
    email: 'core@college.edu',
    name: 'ACM Core',
    role: UserRole.ACM_CORE,
    clubId: acmClubId,
  }

  const superAdminUser: SessionUser = {
    id: 'user-admin',
    email: 'admin@college.edu',
    name: 'Super Admin',
    role: UserRole.SUPER_ADMIN,
    clubId: acmClubId,
  }

  const viewerUser: SessionUser = {
    id: 'user-viewer',
    email: 'viewer@college.edu',
    name: 'Viewer',
    role: UserRole.VIEWER,
    clubId: null,
  }

  describe('canAccessClub predicate', () => {
    it('CLUB_REP can access their own club', () => {
      expect(canAccessClub(clubRepA, clubAId)).toBe(true)
    })

    it('CLUB_REP CANNOT access another club (even if clubId is supplied in request)', () => {
      expect(canAccessClub(clubRepA, clubBId)).toBe(false)
      expect(canAccessClub(clubRepA, acmClubId)).toBe(false)
    })

    it('ACM_CORE can access any club (institutional oversight)', () => {
      expect(canAccessClub(acmCoreUser, clubAId)).toBe(true)
      expect(canAccessClub(acmCoreUser, clubBId)).toBe(true)
      expect(canAccessClub(acmCoreUser, acmClubId)).toBe(true)
    })

    it('SUPER_ADMIN can access any club', () => {
      expect(canAccessClub(superAdminUser, clubAId)).toBe(true)
      expect(canAccessClub(superAdminUser, clubBId)).toBe(true)
    })

    it('VIEWER cannot access any club', () => {
      expect(canAccessClub(viewerUser, clubAId)).toBe(false)
      expect(canAccessClub(viewerUser, clubBId)).toBe(false)
    })

    it('assertCanAccessClub throws ForbiddenError on cross-club attempt', () => {
      expect(() => assertCanAccessClub(clubRepA, clubBId)).toThrowError(ForbiddenError)
      expect(() => assertCanAccessClub(clubRepA, clubAId)).not.toThrow()
    })
  })

  describe('canManageEvent ownership', () => {
    const eventClubA = { id: 'evt-1', clubId: clubAId }
    const eventClubB = { id: 'evt-2', clubId: clubBId }

    it('CLUB_REP of Club A can manage events belonging to Club A', () => {
      expect(canManageEvent(clubRepA, eventClubA)).toBe(true)
    })

    it('CLUB_REP of Club A CANNOT manage events belonging to Club B', () => {
      expect(canManageEvent(clubRepA, eventClubB)).toBe(false)
    })

    it('CLUB_REP of Club B can manage events belonging to Club B but not Club A', () => {
      expect(canManageEvent(clubRepB, eventClubB)).toBe(true)
      expect(canManageEvent(clubRepB, eventClubA)).toBe(false)
    })

    it('ACM_CORE can manage events across all clubs', () => {
      expect(canManageEvent(acmCoreUser, eventClubA)).toBe(true)
      expect(canManageEvent(acmCoreUser, eventClubB)).toBe(true)
    })

    it('VIEWER cannot manage any event', () => {
      expect(canManageEvent(viewerUser, eventClubA)).toBe(false)
      expect(canManageEvent(viewerUser, eventClubB)).toBe(false)
    })
  })

  describe('canManageExpense ownership', () => {
    const expenseClubA = { id: 'exp-1', clubId: clubAId }
    const expenseClubB = { id: 'exp-2', clubId: clubBId }

    it('CLUB_REP of Club A can manage expense for Club A', () => {
      expect(canManageExpense(clubRepA, expenseClubA)).toBe(true)
    })

    it('CLUB_REP of Club A CANNOT manage expense for Club B', () => {
      expect(canManageExpense(clubRepA, expenseClubB)).toBe(false)
    })

    it('ACM_CORE can manage expenses across all clubs', () => {
      expect(canManageExpense(acmCoreUser, expenseClubA)).toBe(true)
      expect(canManageExpense(acmCoreUser, expenseClubB)).toBe(true)
    })
  })

  describe('canAcknowledgeConflict multi-party check', () => {
    const conflictBetweenAandB = {
      eventA: { clubId: clubAId },
      eventB: { clubId: clubBId },
    }

    const uninvolvedClubRep: SessionUser = {
      id: 'user-rep-c',
      email: 'rep.c@college.edu',
      name: 'Club Rep C',
      role: UserRole.CLUB_REP,
      clubId: 'club-ecell-id',
    }

    it('CLUB_REP of Club A can acknowledge a conflict involving Club A', () => {
      expect(canAcknowledgeConflict(clubRepA, conflictBetweenAandB)).toBe(true)
    })

    it('CLUB_REP of Club B can acknowledge a conflict involving Club B', () => {
      expect(canAcknowledgeConflict(clubRepB, conflictBetweenAandB)).toBe(true)
    })

    it('Uninvolved CLUB_REP CANNOT acknowledge a conflict between other clubs', () => {
      expect(canAcknowledgeConflict(uninvolvedClubRep, conflictBetweenAandB)).toBe(false)
    })

    it('ACM_CORE can acknowledge any conflict in the institution', () => {
      expect(canAcknowledgeConflict(acmCoreUser, conflictBetweenAandB)).toBe(true)
    })

    it('VIEWER cannot acknowledge any conflict', () => {
      expect(canAcknowledgeConflict(viewerUser, conflictBetweenAandB)).toBe(false)
    })
  })
})
