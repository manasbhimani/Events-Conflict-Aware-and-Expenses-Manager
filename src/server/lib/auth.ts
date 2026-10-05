import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import prisma from '@/server/lib/prisma'
import { UserRole } from '@prisma/client'
import { UnauthorizedError, ForbiddenError } from '@/server/lib/errors'
import { can, canAccessClub, canManageEvent, canManageExpense, assertCan, assertCanAccessClub, type Action } from '@/server/policies/rbac.policy'
import type { SessionUser } from '@/server/types'

import { authenticateCredentials } from '@/server/lib/auth-credentials'

export { authenticateCredentials }

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'acm-incursion-jwt-secret-dev-2026',
  session: {
    strategy: 'jwt',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: authenticateCredentials,
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase().trim()
        if (!email) {
          return false
        }

        // Domain restriction enforcement
        const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase()
        if (allowedDomain) {
          const cleanDomain = allowedDomain.startsWith('@') ? allowedDomain.slice(1) : allowedDomain
          const emailDomain = email.split('@')[1]
          if (!emailDomain || (emailDomain !== cleanDomain && !emailDomain.endsWith(`.${cleanDomain}`))) {
            return false
          }
        }

        // Identify or provision user in DB
        let dbUser = await prisma.user.findUnique({
          where: { email },
        })

        if (dbUser) {
          if (!dbUser.isActive) {
            return false
          }
        } else {
          // Provision new OAuth user with safe default VIEWER role.
          // NEVER automatically grant elevated roles (ACM_CORE, SUPER_ADMIN, ACM_EXEC) via OAuth!
          dbUser = await prisma.user.create({
            data: {
              email,
              name: user.name || email.split('@')[0],
              role: UserRole.VIEWER,
              clubId: null,
              isActive: true,
            },
          })
        }

        // Bind canonical database identity to user object
        user.id = dbUser.id
        user.role = dbUser.role
        user.clubId = dbUser.clubId
        return true
      }

      return true
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.clubId = user.clubId ?? null
      }
      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.clubId = (token.clubId as string | null) ?? null
      }
      return session
    },
  },
})

// ============================================================
// REUSABLE SERVER-SIDE AUTHENTICATION & AUTHORIZATION HELPERS
// ============================================================

/**
 * Retrieves the currently authenticated user from session.
 * Throws UnauthorizedError (HTTP 401) if not logged in.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new UnauthorizedError('Authentication required')
  }

  // SECURITY FIX: Fetch fresh user from DB to prevent inactive-account bypass
  // and ensure role/clubId are not stale from an old JWT session.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  if (!dbUser || !dbUser.isActive) {
    throw new UnauthorizedError('Account is inactive or does not exist')
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    clubId: dbUser.clubId,
  }
}

/**
 * Enforces that the authenticated user possesses permission for a specific RBAC action.
 * Throws 401 if unauthenticated, or 403 if unauthorized.
 */
export async function requirePermission(action: Action): Promise<SessionUser> {
  const user = await requireUser()
  assertCan(user, action)
  return user
}

/**
 * Enforces that the authenticated user has access to act on behalf of a specific club.
 * Throws 401 if unauthenticated, or 403 if unauthorized.
 */
export async function requireClubAccess(targetClubId: string): Promise<SessionUser> {
  const user = await requireUser()
  assertCanAccessClub(user, targetClubId)
  return user
}

/**
 * Enforces that the authenticated user can manage an event (UPDATE_EVENT + club access).
 */
export async function requireEventManagement(event: { clubId: string }): Promise<SessionUser> {
  const user = await requireUser()
  if (!canManageEvent(user, event)) {
    throw new ForbiddenError(`Forbidden: Cannot manage event for club '${event.clubId}'`)
  }
  return user
}

/**
 * Enforces that the authenticated user can manage an expense (UPDATE_EXPENSE + club access).
 */
export async function requireExpenseManagement(expense: { clubId: string }): Promise<SessionUser> {
  const user = await requireUser()
  if (!canManageExpense(user, expense)) {
    throw new ForbiddenError(`Forbidden: Cannot manage expense for club '${expense.clubId}'`)
  }
  return user
}
