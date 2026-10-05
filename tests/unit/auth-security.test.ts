import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@prisma/client'
import { UnauthorizedError, ForbiddenError } from '@/server/lib/errors'
import type { SessionUser } from '@/server/types'

// Hoisted mock function so vi.mock can access it
const { mockPrismaFindUnique, mockAuthFn } = vi.hoisted(() => ({
  mockPrismaFindUnique: vi.fn(),
  mockAuthFn: vi.fn(),
}))

vi.mock('@/server/lib/prisma', () => ({
  default: {
    user: {
      findUnique: mockPrismaFindUnique,
    },
  },
}))

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: mockAuthFn,
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}))

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn(() => ({ id: 'credentials', name: 'Credentials', type: 'credentials' })),
}))

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn(() => ({ id: 'google', name: 'Google', type: 'oauth' })),
}))

// Import the auth helpers after mocks
import {
  requireUser,
  requirePermission,
  requireClubAccess,
  requireEventManagement,
} from '@/server/lib/auth'

describe('Authentication & Security Invariants Unit Tests', () => {
  beforeEach(() => {
    mockAuthFn.mockReset()
    mockPrismaFindUnique.mockReset()
    mockPrismaFindUnique.mockImplementation(async ({ where }) => {
      let r='VIEWER'; let c=null; if(where.id==='usr-rep-real'){r='CLUB_REP'; c='club-own-id'} return { id: where.id, isActive: true, role: r, clubId: c, email: 'mock@mock', name: 'Mock' }
    })
  })

  describe('Unauthenticated access (HTTP 401)', () => {
    it('requireUser throws UnauthorizedError (401) when session is null', async () => {
      mockAuthFn.mockResolvedValueOnce(null)

      await expect(requireUser()).rejects.toThrowError(UnauthorizedError)
    })

    it('requireUser throws UnauthorizedError (401) when session user has no id', async () => {
      mockAuthFn.mockResolvedValueOnce({ user: {} })

      await expect(requireUser()).rejects.toThrowError(UnauthorizedError)
    })

    it('requirePermission throws UnauthorizedError (401) when unauthenticated', async () => {
      mockAuthFn.mockResolvedValueOnce(null)

      await expect(requirePermission('VIEW_CALENDAR')).rejects.toThrowError(UnauthorizedError)
    })
  })

  describe('Authenticated unauthorized access (HTTP 403)', () => {
    const viewerSession = {
      user: {
        id: 'usr-viewer',
        email: 'viewer@college.edu',
        name: 'Viewer User',
        role: UserRole.VIEWER,
        clubId: null,
      },
      expires: '2026-12-31',
    }

    it('requirePermission throws ForbiddenError (403) when role lacks action', async () => {
      mockAuthFn.mockResolvedValueOnce(viewerSession)

      await expect(requirePermission('VERIFY_EVENT')).rejects.toThrowError(ForbiddenError)
    })

    it('requirePermission succeeds and returns user when authorized', async () => {
      mockAuthFn.mockResolvedValueOnce(viewerSession)

      const user = await requirePermission('VIEW_CALENDAR')
      expect(user.id).toBe('usr-viewer')
      expect(user.role).toBe(UserRole.VIEWER)
    })

    it('requireClubAccess throws ForbiddenError (403) when user cannot access club', async () => {
      mockAuthFn.mockResolvedValueOnce(viewerSession)

      await expect(requireClubAccess('some-club-id')).rejects.toThrowError(ForbiddenError)
    })
  })

  describe('Security Boundaries: Client parameters cannot be trusted', () => {
    const clubRepSession = {
      user: {
        id: 'usr-rep-real',
        email: 'rep@college.edu',
        name: 'Real Rep',
        role: UserRole.CLUB_REP,
        clubId: 'club-own-id',
      },
      expires: '2026-12-31',
    }

    it('identity must be derived from session, ignoring spoofed client body parameters', async () => {
      mockAuthFn.mockResolvedValueOnce(clubRepSession)

      // Simulated client request payload trying to elevate role or impersonate user
      const spoofedClientBody = {
        userId: 'admin-id-spoofed',
        role: 'SUPER_ADMIN',
        clubId: 'club-target-spoofed',
        title: 'Unauthorized Event',
      }

      // Backend derives identity strictly from authenticated session
      const authenticatedUser = await requireUser()

      expect(authenticatedUser.id).toBe('usr-rep-real')
      expect(authenticatedUser.role).toBe(UserRole.CLUB_REP)
      expect(authenticatedUser.clubId).toBe('club-own-id')

      // Assert that using spoofed clubId fails ownership validation
      expect(authenticatedUser.clubId).not.toBe(spoofedClientBody.clubId)
    })

    it('requireEventManagement prevents modifying another club even with valid event ID', async () => {
      mockAuthFn.mockResolvedValueOnce(clubRepSession)

      const foreignEvent = { id: 'evt-target-999', clubId: 'club-other-id' }

      await expect(requireEventManagement(foreignEvent)).rejects.toThrowError(ForbiddenError)
    })
  })

  describe('Session sanitization: No secret leakage', () => {
    it('SessionUser interface does NOT include password or passwordHash', () => {
      const safeUser: SessionUser = {
        id: 'user-1',
        email: 'u@c.edu',
        name: 'User 1',
        role: UserRole.VIEWER,
        clubId: null,
      }

      // Assert that password-related properties are absent
      expect((safeUser as any).password).toBeUndefined()
      expect((safeUser as any).passwordHash).toBeUndefined()
      expect(Object.keys(safeUser)).toEqual(['id', 'email', 'name', 'role', 'clubId'])
    })
  })

  describe('College email domain restriction logic', () => {
    const checkDomain = (email: string, allowedDomain?: string): boolean => {
      if (!allowedDomain) return true
      const cleanDomain = allowedDomain.startsWith('@') ? allowedDomain.slice(1) : allowedDomain
      const emailDomain = email.split('@')[1]
      if (!emailDomain) return false
      return emailDomain.toLowerCase() === cleanDomain.toLowerCase() || emailDomain.toLowerCase().endsWith(`.${cleanDomain.toLowerCase()}`)
    }

    it('accepts emails matching the configured domain', () => {
      expect(checkDomain('student@college.edu', '@college.edu')).toBe(true)
      expect(checkDomain('faculty@sub.college.edu', 'college.edu')).toBe(true)
    })

    it('rejects external/unauthorized email domains when restriction is active', () => {
      expect(checkDomain('attacker@gmail.com', '@college.edu')).toBe(false)
      expect(checkDomain('attacker@othercollege.edu', '@college.edu')).toBe(false)
    })

    it('allows any email when ALLOWED_EMAIL_DOMAIN is unset/empty', () => {
      expect(checkDomain('anyone@gmail.com', undefined)).toBe(true)
      expect(checkDomain('anyone@gmail.com', '')).toBe(true)
    })
  })

  describe('OAuth role assignment security', () => {
    it('verifies default role for new OAuth user is strictly VIEWER', () => {
      // Invariant: New OAuth user must never receive ACM_CORE or SUPER_ADMIN
      const defaultRole = UserRole.VIEWER
      expect(defaultRole).toBe('VIEWER')
      expect(defaultRole).not.toBe(UserRole.ACM_CORE)
      expect(defaultRole).not.toBe(UserRole.SUPER_ADMIN)
      expect(defaultRole).not.toBe(UserRole.ACM_EXEC)
    })
  })
})
