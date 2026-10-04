/**
 * Global Vitest setup.
 *
 * Integration tests require a real DATABASE_URL pointing to a PostgreSQL instance.
 * Unit tests (timezone logic, etc.) do NOT need a database.
 *
 * To run integration tests, ensure DATABASE_URL is set in your environment
 * and the database has been migrated + seeded:
 *   npx prisma migrate dev
 *   npx prisma db seed
 */
import { beforeAll, afterAll } from 'vitest'

beforeAll(async () => {
  // Nothing required globally; each integration test manages its own connection.
})

afterAll(async () => {
  // Nothing to tear down globally.
})
