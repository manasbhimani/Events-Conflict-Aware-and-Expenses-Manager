'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { AppShell } from '@/components/layout/AppShell'
import { AlertBanner, LoadingSpinner } from '@/components/ui/Feedback'
import { fetchApi } from '@/lib/api'
import { Calendar as CalendarIcon, Info } from 'lucide-react'

interface CalendarEventItem {
  id: string
  title: string
  start: string
  end: string
  extendedProps: {
    status: string
    clubId: string
    clubName: string
    clubCode: string
    venueId: string
    venueName: string
    eventType: string
    expectedAttendees: number
    organizer: string
  }
}

export default function CalendarPage() {
  const router = useRouter()
  const calendarRef = useRef<any>(null)

  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch calendar events whenever user navigates months/weeks
  const handleDatesSet = async (dateInfo: { start: Date; end: Date }) => {
    setLoading(true)
    setError(null)
    try {
      const from = dateInfo.start.toISOString()
      const to = dateInfo.end.toISOString()

      const res = await fetchApi<CalendarEventItem[]>(
        `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )

      // Map to FullCalendar event format with color coding
      const mapped = (res.data || []).map((ev) => {
        let backgroundColor = '#4f46e5' // Indigo for verified/default
        let borderColor = '#4338ca'

        if (ev.extendedProps?.status === 'SUBMITTED') {
          backgroundColor = '#d97706' // Amber
          borderColor = '#b45309'
        } else if (ev.extendedProps?.status === 'DRAFT') {
          backgroundColor = '#6b7280' // Gray
          borderColor = '#4b5563'
        } else if (ev.extendedProps?.status === 'COMPLETED') {
          backgroundColor = '#2563eb' // Blue
          borderColor = '#1d4ed8'
        }

        return {
          id: ev.id,
          title: `[${ev.extendedProps?.clubCode || 'CLUB'}] ${ev.title} @ ${ev.extendedProps?.venueName || 'Venue'}`,
          start: ev.start,
          end: ev.end,
          backgroundColor,
          borderColor,
          textColor: '#ffffff',
          extendedProps: ev.extendedProps,
        }
      })

      setEvents(mapped)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch calendar events.')
    } finally {
      setLoading(false)
    }
  }

  const handleEventClick = (info: any) => {
    info.jsEvent.preventDefault()
    if (info.event.id) {
      router.push(`/events/${info.event.id}`)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Interactive Calendar</h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono border border-indigo-200">
                FullCalendar
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Visual scheduling matrix. Click any event to inspect its conflict scores and lifecycle.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span>Verified</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
              <span>Submitted</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-500"></span>
              <span>Draft</span>
            </span>
          </div>
        </div>

        {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}

        <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm">
          {loading && (
            <div className="mb-2 text-xs text-indigo-600 font-medium flex items-center gap-1.5">
              <LoadingSpinner message="Refreshing calendar window..." />
            </div>
          )}

          <div className="calendar-container text-xs">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }}
              events={events}
              datesSet={handleDatesSet}
              eventClick={handleEventClick}
              height="auto"
              dayMaxEvents={3}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                meridiem: 'short',
              }}
            />
          </div>
        </div>

        <div className="p-3 bg-zinc-100 border border-zinc-200 rounded text-xs text-zinc-600 flex items-center gap-2">
          <Info className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <span>
            Calendar queries are bound by backend range limits (max 366 days). The calendar is purely
            a visual tool and will never mutate event state automatically.
          </span>
        </div>
      </div>
    </AppShell>
  )
}
