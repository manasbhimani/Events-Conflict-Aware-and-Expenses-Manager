import { UserRole } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: UserRole
      clubId: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    email?: string | null
    name?: string | null
    role: UserRole
    clubId?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email?: string | null
    name?: string | null
    role: UserRole
    clubId: string | null
  }
}
