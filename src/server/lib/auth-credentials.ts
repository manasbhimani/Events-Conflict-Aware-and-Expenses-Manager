import bcrypt from 'bcryptjs'
import prisma from '@/server/lib/prisma'
import type { SessionUser } from '@/server/types'

/**
 * Core credentials authorization logic.
 * Queries DB by email, validates password against bcrypt hash, asserts isActive.
 * Returns safe user object (id, email, name, role, clubId) without exposing passwordHash.
 */
export async function authenticateCredentials(
  credentials: Record<string, unknown> | null | undefined
): Promise<SessionUser | null> {
  if (!credentials?.email || !credentials?.password) {
    return null
  }

  const email = String(credentials.email).toLowerCase().trim()
  const password = String(credentials.password)

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user || !user.isActive || !user.passwordHash) {
    return null
  }

  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) {
    return null
  }

  // Return user with canonical database-assigned role and clubId
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    clubId: user.clubId,
  }
}
