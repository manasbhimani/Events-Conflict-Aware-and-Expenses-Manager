import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { PrismaClient, EventType } from '@prisma/client'

let currentUserMock: any = null

vi.mock('@/server/lib/auth', () => ({
  requireUser: vi.fn(async () => {
    if (!currentUserMock) {
      const { UnauthorizedError } = await import('@/server/lib/errors')
      throw new UnauthorizedError('Authentication required')
    }
    return currentUserMock
  }),
}))

import { POST as createEventHandler, GET as getEventsHandler } from '@/app/api/events/route'
import { GET as getEventByIdHandler, PATCH as updateEventHandler, DELETE as deleteEventHandler } from '@/app/api/events/[id]/route'
import { POST as submitEventHandler } from '@/app/api/events/[id]/submit/route'
import { POST as verifyEventHandler } from '@/app/api/events/[id]/verify/route'
import { POST as rejectEventHandler } from '@/app/api/events/[id]/reject/route'
import { POST as cancelEventHandler } from '@/app/api/events/[id]/cancel/route'
import { GET as getCalendarHandler } from '@/app/api/calendar/route'

const prisma = new PrismaClient()

describe('Events & Calendar API Route Handlers (Integration)', () => {
  let codingRepUser: any
  let acmCoreUser: any
  let viewerUser: any

  let codingClub: any
  let venue: any
  let semester: any

  beforeAll(async () => {
    codingRepUser = await prisma.user.findUniqueOrThrow({ where: { email: 'rep.coding@acm-demo.college.edu' } })
    acmCoreUser = await prisma.user.findUniqueOrThrow({ where: { email: 'core@acm-demo.college.edu' } })
    viewerUser = await prisma.user.findUniqueOrThrow({ where: { email: 'viewer@acm-demo.college.edu' } })

    codingClub = await prisma.club.findUniqueOrThrow({ where: { code: 'CC' } })
    venue = await prisma.venue.findUniqueOrThrow({ where: { name: 'Lecture Theatre 1 (LT-1)' } })
    semester = await prisma.semester.findUniqueOrThrow({ where: { name: 'Odd Semester 2026-27' } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('POST /api/events', () => {
    it('returns 201 on valid event creation by authorized club rep', async () => {
      currentUserMock = {
        id: codingRepUser.id,
        email: codingRepUser.email,
        name: codingRepUser.name,
        role: codingRepUser.role,
        clubId: codingRepUser.clubId,
      }

      const req = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'API Route Test Event',
          eventType: EventType.WORKSHOP,
          clubId: codingClub.id,
          venueId: venue.id,
          semesterId: semester.id,
          startAt: '2026-11-25T10:00:00.000Z',
          endAt: '2026-11-25T12:00:00.000Z',
          targetYears: [1],
          targetBranches: ['CSE'],
          expectedAttendees: 30,
        }),
      })

      const res = await createEventHandler(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.title).toBe('API Route Test Event')
      expect(data.data.status).toBe('DRAFT')
    })

    it('returns 400 on Zod validation error (invalid interval)', async () => {
      currentUserMock = {
        id: codingRepUser.id,
        email: codingRepUser.email,
        name: codingRepUser.name,
        role: codingRepUser.role,
        clubId: codingRepUser.clubId,
      }

      const req = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Invalid Event',
          clubId: codingClub.id,
          venueId: venue.id,
          semesterId: semester.id,
          startAt: '2026-11-25T12:00:00.000Z',
          endAt: '2026-11-25T10:00:00.000Z', // start > end
        }),
      })

      const res = await createEventHandler(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 403 when VIEWER tries to create event', async () => {
      currentUserMock = {
        id: viewerUser.id,
        email: viewerUser.email,
        name: viewerUser.name,
        role: viewerUser.role,
        clubId: viewerUser.clubId,
      }

      const req = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Forbidden Viewer Event',
          clubId: codingClub.id,
          venueId: venue.id,
          semesterId: semester.id,
          startAt: '2026-11-25T10:00:00.000Z',
          endAt: '2026-11-25T12:00:00.000Z',
        }),
      })

      const res = await createEventHandler(req)
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })

  describe('GET /api/events', () => {
    it('returns paginated events', async () => {
      currentUserMock = {
        id: acmCoreUser.id,
        email: acmCoreUser.email,
        name: acmCoreUser.name,
        role: acmCoreUser.role,
        clubId: acmCoreUser.clubId,
      }

      const req = new NextRequest('http://localhost:3000/api/events?page=1&pageSize=5')
      const res = await getEventsHandler(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data)).toBe(true)
      expect(json.meta.page).toBe(1)
      expect(json.meta.limit).toBe(5)
    })
  })

  describe('Full Event Lifecycle via Route Handlers', () => {
    let createdEventId: string

    it('creates, submits, verifies, and cancels an event through HTTP handlers', async () => {
      // 1. CREATE DRAFT
      currentUserMock = {
        id: codingRepUser.id,
        email: codingRepUser.email,
        name: codingRepUser.name,
        role: codingRepUser.role,
        clubId: codingRepUser.clubId,
      }

      const createReq = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Full Lifecycle API Event',
          eventType: EventType.WORKSHOP,
          clubId: codingClub.id,
          venueId: venue.id,
          semesterId: semester.id,
          startAt: '2026-12-10T10:00:00.000Z',
          endAt: '2026-12-10T12:00:00.000Z',
        }),
      })
      const createRes = await createEventHandler(createReq)
      expect(createRes.status).toBe(201)
      const createJson = await createRes.json()
      createdEventId = createJson.data.id

      // 2. GET EVENT BY ID
      currentUserMock = {
        id: codingRepUser.id,
        email: codingRepUser.email,
        name: codingRepUser.name,
        role: codingRepUser.role,
        clubId: codingRepUser.clubId,
      }
      const getRes = await getEventByIdHandler(
        new NextRequest(`http://localhost:3000/api/events/${createdEventId}`),
        { params: Promise.resolve({ id: createdEventId }) }
      )
      expect(getRes.status).toBe(200)
      const getJson = await getRes.json()
      expect(getJson.data.title).toBe('Full Lifecycle API Event')

      // 3. SUBMIT EVENT
      currentUserMock = {
        id: codingRepUser.id,
        email: codingRepUser.email,
        name: codingRepUser.name,
        role: codingRepUser.role,
        clubId: codingRepUser.clubId,
      }
      const submitRes = await submitEventHandler(
        new NextRequest(`http://localhost:3000/api/events/${createdEventId}/submit`, { method: 'POST' }),
        { params: Promise.resolve({ id: createdEventId }) }
      )
      expect(submitRes.status).toBe(200)
      const submitJson = await submitRes.json()
      expect(submitJson.data.status).toBe('SUBMITTED')

      // 4. VERIFY EVENT BY ACM_CORE
      currentUserMock = {
        id: acmCoreUser.id,
        email: acmCoreUser.email,
        name: acmCoreUser.name,
        role: acmCoreUser.role,
        clubId: acmCoreUser.clubId,
      }
      const verifyRes = await verifyEventHandler(
        new NextRequest(`http://localhost:3000/api/events/${createdEventId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: 'Approved via API handler' }),
        }),
        { params: Promise.resolve({ id: createdEventId }) }
      )
      expect(verifyRes.status).toBe(200)
      const verifyJson = await verifyRes.json()
      expect(verifyJson.data.status).toBe('VERIFIED')

      // 5. CANCEL EVENT
      currentUserMock = {
        id: acmCoreUser.id,
        email: acmCoreUser.email,
        name: acmCoreUser.name,
        role: acmCoreUser.role,
        clubId: acmCoreUser.clubId,
      }
      const cancelRes = await cancelEventHandler(
        new NextRequest(`http://localhost:3000/api/events/${createdEventId}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Speaker cancelled via API' }),
        }),
        { params: Promise.resolve({ id: createdEventId }) }
      )
      expect(cancelRes.status).toBe(200)
      const cancelJson = await cancelRes.json()
      expect(cancelJson.data.status).toBe('CANCELLED')
    })
  })

  describe('GET /api/calendar', () => {
    it('returns FullCalendar compatible event list', async () => {
      currentUserMock = {
        id: acmCoreUser.id,
        email: acmCoreUser.email,
        name: acmCoreUser.name,
        role: acmCoreUser.role,
        clubId: acmCoreUser.clubId,
      }

      const req = new NextRequest(
        'http://localhost:3000/api/calendar?from=2026-09-01T00:00:00.000Z&to=2026-09-30T23:59:59.999Z'
      )
      const res = await getCalendarHandler(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data)).toBe(true)
      if (json.data.length > 0) {
        const item = json.data[0]
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('title')
        expect(item).toHaveProperty('start')
        expect(item).toHaveProperty('end')
        expect(item).toHaveProperty('extendedProps')
      }
    })

    it('returns 400 when missing date parameters', async () => {
      currentUserMock = {
        id: acmCoreUser.id,
        email: acmCoreUser.email,
        name: acmCoreUser.name,
        role: acmCoreUser.role,
        clubId: acmCoreUser.clubId,
      }

      const req = new NextRequest('http://localhost:3000/api/calendar')
      const res = await getCalendarHandler(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
