'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fetchApi, ApiError } from '@/lib/api'
import { AlertBanner, LoadingSpinner } from '@/components/ui/Feedback'
import { Calendar, Users, Building, MapPin, Tag, Check, AlertCircle } from 'lucide-react'

const BRANCH_OPTIONS = ['CSE', 'IT', 'ECE', 'EE', 'MECH', 'CIVIL', 'AIDS', 'AIML']
const YEAR_OPTIONS = [1, 2, 3, 4]
const EVENT_TYPES = ['WORKSHOP', 'HACKATHON', 'SPEAKER_SESSION', 'COMPETITION', 'SOCIAL', 'OTHER']

interface Metadata {
  clubs: { id: string; name: string; code: string; isInternalAcm: boolean }[]
  venues: { id: string; name: string; capacity: number }[]
  semesters: { id: string; name: string; isLocked: boolean; startDate: string; endDate: string }[]
}

interface EventFormProps {
  initialData?: any
  isEdit?: boolean
}

export function EventForm({ initialData, isEdit = false }: EventFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user

  const [meta, setMeta] = useState<Metadata | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form fields
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [eventType, setEventType] = useState(initialData?.eventType || 'WORKSHOP')
  const [clubId, setClubId] = useState(initialData?.clubId || user?.clubId || '')
  const [venueId, setVenueId] = useState(initialData?.venueId || '')
  const [semesterId, setSemesterId] = useState(initialData?.semesterId || '')
  const [startAt, setStartAt] = useState(
    initialData?.startAt ? new Date(initialData.startAt).toISOString().slice(0, 16) : ''
  )
  const [endAt, setEndAt] = useState(
    initialData?.endAt ? new Date(initialData.endAt).toISOString().slice(0, 16) : ''
  )
  const [targetYears, setTargetYears] = useState<number[]>(initialData?.targetYears || [])
  const [targetBranches, setTargetBranches] = useState<string[]>(initialData?.targetBranches || [])
  const [expectedAttendees, setExpectedAttendees] = useState<number>(
    initialData?.expectedAttendees !== undefined ? initialData.expectedAttendees : 50
  )
  const [tagsInput, setTagsInput] = useState<string>(initialData?.tags?.join(', ') || '')

  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetchApi<Metadata>('/api/meta')
        setMeta(res.data)

        // Set sensible defaults if empty
        if (!venueId && res.data.venues.length > 0) {
          setVenueId(res.data.venues[0].id)
        }
        if (!semesterId) {
          const unlocked = res.data.semesters.find((s) => !s.isLocked)
          if (unlocked) setSemesterId(unlocked.id)
          else if (res.data.semesters.length > 0) setSemesterId(res.data.semesters[0].id)
        }
        if (!clubId) {
          if (user?.clubId) {
            setClubId(user.clubId)
          } else if (res.data.clubs.length > 0) {
            setClubId(res.data.clubs[0].id)
          }
        }
      } catch (err: any) {
        setError('Failed to load system metadata (venues, semesters, clubs).')
      } finally {
        setLoadingMeta(false)
      }
    }
    loadMeta()
  }, [user])

  const toggleYear = (yr: number) => {
    if (targetYears.includes(yr)) {
      setTargetYears(targetYears.filter((y) => y !== yr))
    } else {
      setTargetYears([...targetYears, yr].sort())
    }
  }

  const toggleBranch = (br: string) => {
    if (targetBranches.includes(br)) {
      setTargetBranches(targetBranches.filter((b) => b !== br))
    } else {
      setTargetBranches([...targetBranches, br])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    if (!startAt || !endAt) {
      setError('Please provide valid start and end dates.')
      return
    }

    const startDate = new Date(startAt)
    const endDate = new Date(endAt)

    if (startDate >= endDate) {
      setError('Start time must be strictly before end time.')
      return
    }

    setSubmitting(true)

    const payload: any = {
      title: title.trim(),
      description: description.trim() || undefined,
      eventType,
      venueId,
      semesterId,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      targetYears,
      targetBranches,
      expectedAttendees: Number(expectedAttendees),
      tags: tagsInput
        ? tagsInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    }

    if (!isEdit) {
      payload.clubId = clubId
    }

    try {
      if (isEdit) {
        const res = await fetchApi<{ id: string }>(`/api/events/${initialData.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        router.push(`/events/${res.data.id}`)
      } else {
        const res = await fetchApi<{ id: string }>('/api/events', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        router.push(`/events/${res.data.id}`)
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message)
        if (err.details && typeof err.details === 'object') {
          // Format Zod field errors if present
          const formatted: Record<string, string> = {}
          for (const [k, v] of Object.entries(err.details as any)) {
            if (v && typeof v === 'object' && '_errors' in v && Array.isArray((v as any)._errors)) {
              formatted[k] = (v as any)._errors[0]
            }
          }
          setFieldErrors(formatted)
        }
      } else {
        setError(err.message || 'An unexpected error occurred.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingMeta) {
    return <LoadingSpinner message="Loading form configuration..." />
  }

  const isRestrictedRep =
    user?.role === 'CLUB_REP' || (user?.role === 'ACM_EXEC' && !!user.clubId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          Event Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Hackathon 2026"
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {fieldErrors.title && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.title}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the event, agenda, or guidelines..."
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Event Type *
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Organizing Club *
              </label>
              <select
                value={clubId}
                disabled={isRestrictedRep}
                onChange={(e) => setClubId(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-3 py-2 bg-white disabled:bg-zinc-100 disabled:text-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {meta?.clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {isRestrictedRep && (
                <p className="text-[11px] text-zinc-500 mt-1">
                  Bound to your authenticated club representative account.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Venue *
            </label>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {meta?.venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} (Cap: {v.capacity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Academic Semester *
            </label>
            <select
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {meta?.semesters.map((s) => (
                <option key={s.id} value={s.id} disabled={s.isLocked}>
                  {s.name} {s.isLocked ? '(LOCKED - Cannot submit events)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-4 pt-4 border-t border-zinc-100">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          Schedule Timing (Local / IST)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Start Date & Time *
            </label>
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {fieldErrors.startAt && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.startAt}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              End Date & Time *
            </label>
            <input
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {fieldErrors.endAt && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.endAt}</p>
            )}
          </div>
        </div>
      </div>

      {/* Structured Audience */}
      <div className="space-y-4 pt-4 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Target Audience (Wildcard Semantics)
          </h3>
          <span className="text-[11px] text-zinc-500 italic">
            Empty selection = &quot;ALL&quot; wildcard
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
            Target Years (Leave empty for ALL Years)
          </label>
          <div className="flex flex-wrap gap-2">
            {YEAR_OPTIONS.map((yr) => {
              const active = targetYears.includes(yr)
              return (
                <button
                  type="button"
                  key={yr}
                  onClick={() => toggleYear(yr)}
                  className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  Year {yr}
                </button>
              )
            })}
            {targetYears.length === 0 && (
              <span className="text-xs text-indigo-600 font-medium self-center ml-2">
                &rarr; Wildcard active: open to all years (1-4)
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
            Target Branches (Leave empty for ALL Branches)
          </label>
          <div className="flex flex-wrap gap-2">
            {BRANCH_OPTIONS.map((br) => {
              const active = targetBranches.includes(br)
              return (
                <button
                  type="button"
                  key={br}
                  onClick={() => toggleBranch(br)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {br}
                </button>
              )
            })}
            {targetBranches.length === 0 && (
              <span className="text-xs text-indigo-600 font-medium self-center ml-2">
                &rarr; Wildcard active: open to all branches
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Expected Attendees
            </label>
            <input
              type="number"
              min={0}
              value={expectedAttendees}
              onChange={(e) => setExpectedAttendees(Number(e.target.value))}
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
              Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="coding, tech, robotics"
              className="w-full text-sm border border-zinc-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-200 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-zinc-300 rounded text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Saving Event...' : isEdit ? 'Save Changes' : 'Create Event (Draft)'}
        </button>
      </div>
    </form>
  )
}
