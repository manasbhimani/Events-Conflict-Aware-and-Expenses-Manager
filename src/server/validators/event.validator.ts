import { z } from 'zod'
import { EventType, EventStatus } from '@prisma/client'

// Helper to validate and coerce ISO datetime strings
const isoDateSchema = z.string().datetime({ message: 'Must be a valid ISO-8601 UTC timestamp string' }).or(z.date())

export const createEventSchema = z
  .object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
    description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional().nullable(),
    eventType: z.nativeEnum(EventType).default(EventType.OTHER),
    clubId: z.string().min(1, 'Organizing clubId is required'),
    venueId: z.string().min(1, 'Venue is required'),
    semesterId: z.string().min(1, 'Semester is required'),
    startAt: isoDateSchema,
    endAt: isoDateSchema,
    targetYears: z.array(z.number().int().min(1).max(5)).default([]),
    targetBranches: z.array(z.string().min(1)).default([]),
    expectedAttendees: z.number().int().min(0, 'Attendees cannot be negative').default(0),
    bannerUrl: z.string().url('Banner must be a valid URL').optional().nullable(),
    tags: z.array(z.string()).default([]),
  })
  .refine(
    (data) => {
      const start = new Date(data.startAt).getTime()
      const end = new Date(data.endAt).getTime()
      return start < end
    },
    {
      message: 'startAt must be strictly before endAt (end-exclusive interval)',
      path: ['endAt'],
    }
  )

export const updateEventSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    eventType: z.nativeEnum(EventType).optional(),
    venueId: z.string().min(1).optional(),
    semesterId: z.string().min(1).optional(),
    startAt: isoDateSchema.optional(),
    endAt: isoDateSchema.optional(),
    targetYears: z.array(z.number().int().min(1).max(5)).optional(),
    targetBranches: z.array(z.string().min(1)).optional(),
    expectedAttendees: z.number().int().min(0).optional(),
    bannerUrl: z.string().url().optional().nullable(),
    tags: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.startAt).getTime() < new Date(data.endAt).getTime()
      }
      return true
    },
    {
      message: 'startAt must be strictly before endAt',
      path: ['endAt'],
    }
  )

export const rejectEventSchema = z.object({
  reason: z.string().min(3, 'Rejection reason must be at least 3 characters').max(1000, 'Reason cannot exceed 1000 characters'),
})

export const cancelEventSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason must be at least 3 characters').max(1000, 'Reason cannot exceed 1000 characters'),
})

export const eventFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(EventStatus).optional(),
  clubId: z.string().optional(),
  venueId: z.string().optional(),
  eventType: z.nativeEnum(EventType).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export const calendarQuerySchema = z
  .object({
    from: z.string().datetime({ message: "'from' must be a valid ISO-8601 date string" }),
    to: z.string().datetime({ message: "'to' must be a valid ISO-8601 date string" }),
  })
  .refine(
    (data) => {
      const from = new Date(data.from).getTime()
      const to = new Date(data.to).getTime()
      return from < to
    },
    {
      message: "'from' date must be earlier than 'to' date",
      path: ['to'],
    }
  )
  .refine(
    (data) => {
      const from = new Date(data.from).getTime()
      const to = new Date(data.to).getTime()
      const maxRangeDays = 366 // Max 1 year range to prevent unbounded queries
      const maxMs = maxRangeDays * 24 * 60 * 60 * 1000
      return to - from <= maxMs
    },
    {
      message: 'Calendar query range cannot exceed 366 days',
      path: ['to'],
    }
  )

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
export type EventFilterInput = z.infer<typeof eventFilterSchema>
export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>
