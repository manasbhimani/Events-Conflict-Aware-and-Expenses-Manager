import { describe, it, expect } from 'vitest'
import {
  createEventSchema,
  updateEventSchema,
  rejectEventSchema,
  cancelEventSchema,
  eventFilterSchema,
  calendarQuerySchema,
} from '@/server/validators/event.validator'
import { EventType, EventStatus } from '@prisma/client'

describe('Event Validators (Unit)', () => {
  describe('createEventSchema', () => {
    const validPayload = {
      title: 'Intro to Web Development',
      description: 'Hands on workshop',
      eventType: EventType.WORKSHOP,
      clubId: 'club_123',
      venueId: 'venue_123',
      semesterId: 'sem_123',
      startAt: '2026-09-20T10:00:00.000Z',
      endAt: '2026-09-20T12:00:00.000Z',
      targetYears: [1, 2],
      targetBranches: ['CSE', 'IT'],
      expectedAttendees: 50,
      bannerUrl: 'https://example.com/banner.png',
      tags: ['web', 'react'],
    }

    it('passes with valid payload', () => {
      const parsed = createEventSchema.parse(validPayload)
      expect(parsed.title).toBe(validPayload.title)
      expect(parsed.eventType).toBe(EventType.WORKSHOP)
      expect(parsed.targetYears).toEqual([1, 2])
    })

    it('sets defaults for optional arrays and status', () => {
      const minimal = {
        title: 'Minimal Event Title',
        clubId: 'club_123',
        venueId: 'venue_123',
        semesterId: 'sem_123',
        startAt: '2026-09-20T10:00:00.000Z',
        endAt: '2026-09-20T12:00:00.000Z',
      }
      const parsed = createEventSchema.parse(minimal)
      expect(parsed.eventType).toBe(EventType.OTHER)
      expect(parsed.targetYears).toEqual([])
      expect(parsed.targetBranches).toEqual([])
      expect(parsed.tags).toEqual([])
      expect(parsed.expectedAttendees).toBe(0)
    })

    it('fails if title is too short (< 3 chars)', () => {
      expect(() =>
        createEventSchema.parse({
          ...validPayload,
          title: 'AB',
        })
      ).toThrow()
    })

    it('fails if endAt is before startAt', () => {
      expect(() =>
        createEventSchema.parse({
          ...validPayload,
          startAt: '2026-09-20T14:00:00.000Z',
          endAt: '2026-09-20T12:00:00.000Z',
        })
      ).toThrow('startAt must be strictly before endAt')
    })

    it('fails if startAt equals endAt (zero duration)', () => {
      expect(() =>
        createEventSchema.parse({
          ...validPayload,
          startAt: '2026-09-20T12:00:00.000Z',
          endAt: '2026-09-20T12:00:00.000Z',
        })
      ).toThrow('startAt must be strictly before endAt')
    })

    it('fails if expectedAttendees is negative', () => {
      expect(() =>
        createEventSchema.parse({
          ...validPayload,
          expectedAttendees: -5,
        })
      ).toThrow()
    })

    it('fails if bannerUrl is not a valid URL', () => {
      expect(() =>
        createEventSchema.parse({
          ...validPayload,
          bannerUrl: 'not-a-valid-url',
        })
      ).toThrow()
    })
  })

  describe('updateEventSchema', () => {
    it('allows partial updates', () => {
      const parsed = updateEventSchema.parse({
        title: 'Updated Event Title',
        expectedAttendees: 100,
      })
      expect(parsed.title).toBe('Updated Event Title')
      expect(parsed.expectedAttendees).toBe(100)
    })

    it('validates startAt < endAt when both are provided', () => {
      expect(() =>
        updateEventSchema.parse({
          startAt: '2026-09-20T15:00:00.000Z',
          endAt: '2026-09-20T13:00:00.000Z',
        })
      ).toThrow('startAt must be strictly before endAt')
    })

    it('allows individual date update without sibling when valid', () => {
      const parsed = updateEventSchema.parse({
        startAt: '2026-09-20T10:00:00.000Z',
      })
      expect(parsed.startAt).toBe('2026-09-20T10:00:00.000Z')
    })
  })

  describe('rejectEventSchema & cancelEventSchema', () => {
    it('requires a reason of at least 3 characters', () => {
      expect(() => rejectEventSchema.parse({ reason: 'no' })).toThrow()
      expect(() => cancelEventSchema.parse({ reason: '' })).toThrow()

      const validReject = rejectEventSchema.parse({ reason: 'Venue unavailable at requested time' })
      expect(validReject.reason).toBe('Venue unavailable at requested time')

      const validCancel = cancelEventSchema.parse({ reason: 'Speaker cancelled travel' })
      expect(validCancel.reason).toBe('Speaker cancelled travel')
    })
  })

  describe('calendarQuerySchema', () => {
    it('accepts valid date window', () => {
      const query = {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-30T23:59:59.999Z',
      }
      const parsed = calendarQuerySchema.parse(query)
      expect(parsed.from).toBe(query.from)
      expect(parsed.to).toBe(query.to)
    })

    it('rejects if from >= to', () => {
      expect(() =>
        calendarQuerySchema.parse({
          from: '2026-09-30T00:00:00.000Z',
          to: '2026-09-01T00:00:00.000Z',
        })
      ).toThrow("'from' date must be earlier than 'to' date")
    })

    it('rejects date range exceeding 366 days', () => {
      expect(() =>
        calendarQuerySchema.parse({
          from: '2025-01-01T00:00:00.000Z',
          to: '2027-01-01T00:00:00.000Z',
        })
      ).toThrow('Calendar query range cannot exceed 366 days')
    })

    it('rejects invalid non-ISO strings', () => {
      expect(() =>
        calendarQuerySchema.parse({
          from: 'invalid-date',
          to: '2026-09-30T00:00:00.000Z',
        })
      ).toThrow()
    })
  })

  describe('eventFilterSchema', () => {
    it('coerces query params and provides default pagination', () => {
      const parsed = eventFilterSchema.parse({
        page: '2',
        pageSize: '10',
        status: EventStatus.VERIFIED,
      })
      expect(parsed.page).toBe(2)
      expect(parsed.pageSize).toBe(10)
      expect(parsed.status).toBe(EventStatus.VERIFIED)
    })

    it('caps pageSize to max 100', () => {
      expect(() =>
        eventFilterSchema.parse({
          pageSize: '150',
        })
      ).toThrow()
    })
  })
})
