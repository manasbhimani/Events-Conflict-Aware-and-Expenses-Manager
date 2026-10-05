import { describe, it, expect, afterAll } from 'vitest'
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { authenticateCredentials } from '@/server/lib/auth-credentials'

const prisma = new PrismaClient()
const DEMO_PASSWORD = 'DemoPassword123!'

describe('Database Authentication Integration (Phase 2)', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('Real authenticateCredentials function', () => {
    it('authenticates seeded SUPER_ADMIN and returns safe user without passwordHash', async () => {
      const user = await authenticateCredentials({
        email: 'superadmin@acm-demo.college.edu',
        password: DEMO_PASSWORD,
      })

      expect(user).not.toBeNull()
      expect(user!.email).toBe('superadmin@acm-demo.college.edu')
      expect(user!.role).toBe(UserRole.SUPER_ADMIN)
      expect(user!.id).toBeTruthy()
      // Crucial security invariant: passwordHash is NEVER returned
      expect((user as any).passwordHash).toBeUndefined()
      expect((user as any).password).toBeUndefined()
    })

    it('authenticates seeded CLUB_REP and returns database-assigned clubId and role', async () => {
      const user = await authenticateCredentials({
        email: 'rep.coding@acm-demo.college.edu',
        password: DEMO_PASSWORD,
      })

      expect(user).not.toBeNull()
      expect(user!.role).toBe(UserRole.CLUB_REP)
      expect(user!.clubId).toBeTruthy()
      expect((user as any).passwordHash).toBeUndefined()
    })

    it('authenticates seeded ACM_CORE with case-insensitive and trimmed email', async () => {
      const user = await authenticateCredentials({
        email: '  CORE@acm-demo.college.edu  ',
        password: DEMO_PASSWORD,
      })

      expect(user).not.toBeNull()
      expect(user!.email).toBe('core@acm-demo.college.edu')
      expect(user!.role).toBe(UserRole.ACM_CORE)
    })

    it('rejects authentication with wrong password', async () => {
      const user = await authenticateCredentials({
        email: 'superadmin@acm-demo.college.edu',
        password: 'IncorrectPassword999!',
      })

      expect(user).toBeNull()
    })

    it('rejects authentication for non-existent email', async () => {
      const user = await authenticateCredentials({
        email: 'nonexistent@acm-demo.college.edu',
        password: DEMO_PASSWORD,
      })

      expect(user).toBeNull()
    })

    it('rejects authentication with empty or missing credentials', async () => {
      expect(await authenticateCredentials(null)).toBeNull()
      expect(await authenticateCredentials({})).toBeNull()
      expect(await authenticateCredentials({ email: '', password: '' })).toBeNull()
    })

    it('strictly rejects inactive user even if password is correct', async () => {
      // Create temporary inactive user in DB
      const inactiveUser = await prisma.user.create({
        data: {
          email: 'inactive.auth.test@college.edu',
          name: 'Inactive Test User',
          role: UserRole.VIEWER,
          passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
          isActive: false,
        },
      })

      const result = await authenticateCredentials({
        email: inactiveUser.email,
        password: DEMO_PASSWORD,
      })

      expect(result).toBeNull()

      // Cleanup
      await prisma.user.delete({ where: { id: inactiveUser.id } })
    })
  })

  describe('Database passwordHash integrity', () => {
    it('all seeded accounts possess valid bcrypt hashes', async () => {
      const users = await prisma.user.findMany({
        where: { email: { contains: '@acm-demo.college.edu' } },
      })

      expect(users.length).toBeGreaterThanOrEqual(8)
      for (const u of users) {
        expect(u.passwordHash).toBeTruthy()
        expect(u.passwordHash!.startsWith('$2a$') || u.passwordHash!.startsWith('$2b$')).toBe(true)
      }
    })
  })
})
