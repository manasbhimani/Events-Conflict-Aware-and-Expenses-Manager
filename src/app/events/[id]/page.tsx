'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/layout/AppShell'
import {
  EventStatusBadge,
  ConflictSeverityBadge,
  ConflictStatusBadge,
  RoleBadge,
} from '@/components/ui/Badges'
import { LoadingSpinner, EmptyState, AlertBanner, ModalDialog } from '@/components/ui/Feedback'
import { fetchApi, ApiError } from '@/lib/api'
import { canClient, canManageClubResource } from '@/lib/auth-client'
import {
  Calendar,
  Clock,
  MapPin,
  Building,
  Users,
  Tag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  Send,
  Edit3,
  Search,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react'

export interface EventDetail {
  id: string
  title: string
  description: string | null
  eventType: string
  status: string
  startAt: string
  endAt: string
  targetYears: number[]
  targetBranches: string[]
  expectedAttendees: number
  bannerUrl: string | null
  tags: string[]
  rejectionReason: string | null
  clubId: string
  venueId: string
  semesterId: string
  createdAt: string
  updatedAt: string
  club: { id: string; name: string; code: string }
  venue: { id: string; name: string; capacity: number }
  semester: { id: string; name: string; isLocked: boolean }
  submittedBy?: { id: string; name: string; email: string; role: string }
  reviews?: {
    id: string
    decision: string
    comment: string | null
    createdAt: string
    reviewer: { id: string; name: string; email: string; role: string }
  }[]
}

export interface ConflictItem {
  id: string
  eventAId: string
  eventBId: string
  conflictType: string
  severity: string
  overlapMinutes: number | null
  conflictScore: number | null
  description: string
  status: string
  resolutionNote: string | null
  createdAt: string
  eventA: { id: string; title: string; clubId: string }
  eventB: { id: string; title: string; clubId: string }
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const eventId = resolvedParams.id

  const { data: session } = useSession()
  const user = session?.user

  const [event, setEvent] = useState<EventDetail | null>(null)
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [activeConflictId, setActiveConflictId] = useState<string | null>(null)

  const [reasonInput, setReasonInput] = useState('')
  const [noteInput, setNoteInput] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [evRes, confRes] = await Promise.all([
        fetchApi<EventDetail>(`/api/events/${eventId}`),
        fetchApi<ConflictItem[]>(`/api/events/${eventId}/conflicts`),
      ])
      setEvent(evRes.data)
      setConflicts(confRes.data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load event details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      loadData()
    }
  }, [session, eventId])

  const handleDetectConflicts = async () => {
    setDetecting(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await fetchApi<ConflictItem[]>(`/api/events/${eventId}/conflicts/detect`, {
        method: 'POST',
      })
      setConflicts(res.data || [])
      setSuccessMsg(
        res.data?.length
          ? `Detection completed. Found ${res.data.length} active conflict(s). Human decision required.`
          : 'Detection completed. No conflicts detected!'
      )
    } catch (err: any) {
      setError(err.message || 'Conflict detection failed.')
    } finally {
      setDetecting(false)
    }
  }

  const handleSubmitEvent = async () => {
    if (!confirm('Submit this event for ACM Core review?')) return
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/events/${eventId}/submit`, { method: 'POST' })
      setSuccessMsg('Event submitted successfully for review.')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleVerifyEvent = async () => {
    const comment = prompt('Optional verification comment:', 'Verified by ACM Core')
    if (comment === null) return

    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/events/${eventId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ comment: comment.trim() || undefined }),
      })
      setSuccessMsg('Event verified successfully!')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectEvent = async () => {
    if (!reasonInput.trim()) {
      setError('Rejection reason is required (min 3 chars).')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/events/${eventId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reasonInput.trim() }),
      })
      setSuccessMsg('Event rejected.')
      setRejectModalOpen(false)
      setReasonInput('')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelEvent = async () => {
    if (!reasonInput.trim()) {
      setError('Cancellation reason is required (min 3 chars).')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/events/${eventId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reasonInput.trim() }),
      })
      setSuccessMsg('Event cancelled.')
      setCancelModalOpen(false)
      setReasonInput('')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Conflict Action handlers
  const handleAcknowledgeConflict = async (conflictId: string) => {
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/conflicts/${conflictId}/acknowledge`, { method: 'POST' })
      setSuccessMsg('Conflict acknowledged.')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolveConflict = async () => {
    if (!activeConflictId) return
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/conflicts/${activeConflictId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note: noteInput.trim() || 'Resolved by authority' }),
      })
      setSuccessMsg('Conflict marked as resolved.')
      setResolveModalOpen(false)
      setNoteInput('')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleOverrideConflict = async () => {
    if (!activeConflictId) return
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/conflicts/${activeConflictId}/override`, {
        method: 'POST',
        body: JSON.stringify({ note: noteInput.trim() || 'Overridden by authority' }),
      })
      setSuccessMsg('Conflict administrative override recorded.')
      setOverrideModalOpen(false)
      setNoteInput('')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <LoadingSpinner message="Loading event details and conflicts..." />
      </AppShell>
    )
  }

  if (!event) {
    return (
      <AppShell>
        <EmptyState
          title="Event Not Found"
          description="The requested event does not exist or you do not have permission to view it."
        />
      </AppShell>
    )
  }

  const formatIST = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  // RBAC permissions evaluation
  const isOwner = canManageClubResource(user?.role, user?.clubId, event.clubId)
  const canSubmit = isOwner && event.status === 'DRAFT' && canClient(user?.role, 'SUBMIT_EVENT')
  const canEdit =
    isOwner &&
    (event.status === 'DRAFT' || event.status === 'SUBMITTED') &&
    canClient(user?.role, 'UPDATE_EVENT')
  const canVerify = event.status === 'SUBMITTED' && canClient(user?.role, 'VERIFY_EVENT')
  const canReject = event.status === 'SUBMITTED' && canClient(user?.role, 'REJECT_EVENT')
  // Phase 3 rule: Only SUPER_ADMIN and ACM_CORE can CANCEL
  const canCancel =
    (event.status === 'VERIFIED' || event.status === 'SUBMITTED') &&
    canClient(user?.role, 'CANCEL_EVENT')

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header & Status Bar */}
        <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">{event.title}</h1>
                <EventStatusBadge status={event.status} />
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-zinc-100 text-zinc-700 border border-zinc-200">
                  {event.eventType}
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono mt-1">ID: {event.id}</p>
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <Link
                  href={`/events/${event.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded text-xs font-medium border border-zinc-300 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </Link>
              )}

              {canSubmit && (
                <button
                  onClick={handleSubmitEvent}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit for Review
                </button>
              )}

              {canVerify && (
                <button
                  onClick={handleVerifyEvent}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verify Event
                </button>
              )}

              {canReject && (
                <button
                  onClick={() => {
                    setReasonInput('')
                    setRejectModalOpen(true)
                  }}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject Event
                </button>
              )}

              {canCancel && (
                <button
                  onClick={() => {
                    setReasonInput('')
                    setCancelModalOpen(true)
                  }}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancel Event
                </button>
              )}

              {/* Conflict Scan Button */}
              <button
                onClick={handleDetectConflicts}
                disabled={detecting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                {detecting ? 'Scanning Engine...' : 'Detect Conflicts'}
              </button>
            </div>
          </div>

          {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
          {successMsg && (
            <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
          )}

          {event.rejectionReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              <span className="font-bold">Rejection Reason:</span> {event.rejectionReason}
            </div>
          )}
        </div>

        {/* Conflict Detection Engine Testing Panel */}
        <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                  Conflict Engine Status
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium">
                  Candidate window: &plusmn;30 min • Jaccard audience overlap • Composite score [0-100]
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
              {conflicts.length} conflict(s) tracked
            </span>
          </div>

          {conflicts.length > 0 ? (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-2 font-medium">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Conflict detected — human decision required. The engine does NOT automatically
                  cancel or reschedule events.
                </span>
              </div>

              <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                <table className="w-full text-left text-xs text-zinc-600">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Conflicting Event</th>
                      <th className="py-2.5 px-3">Overlap / Details</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {conflicts.map((c) => {
                      const otherEvent = c.eventAId === event.id ? c.eventB : c.eventA
                      const canAck =
                        c.status === 'OPEN' &&
                        (user?.role === 'SUPER_ADMIN' ||
                          user?.role === 'ACM_CORE' ||
                          (user?.role === 'CLUB_REP' &&
                            (user.clubId === c.eventA.clubId || user.clubId === c.eventB.clubId)))
                      const canResolve =
                        c.status !== 'RESOLVED' &&
                        c.status !== 'OVERRIDDEN' &&
                        canClient(user?.role, 'RESOLVE_CONFLICT')
                      const canOverride =
                        c.status !== 'RESOLVED' &&
                        c.status !== 'OVERRIDDEN' &&
                        canClient(user?.role, 'OVERRIDE_CONFLICT')

                      return (
                        <tr key={c.id} className="hover:bg-zinc-50/80">
                          <td className="py-2.5 px-3 font-semibold text-zinc-800">{c.conflictType}</td>
                          <td className="py-2.5 px-3">
                            <ConflictSeverityBadge severity={c.severity} />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-zinc-800">
                            {c.conflictScore !== null ? `${c.conflictScore}/100` : '-'}
                          </td>
                          <td className="py-2.5 px-3">
                            <Link
                              href={`/events/${otherEvent?.id}`}
                              className="font-medium text-indigo-600 hover:underline line-clamp-1"
                            >
                              {otherEvent?.title || otherEvent?.id}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs">
                            <div className="line-clamp-2 text-[11px] text-zinc-600 whitespace-pre-line">
                              {c.description}
                            </div>
                            {c.resolutionNote && (
                              <div className="text-[10px] text-emerald-700 mt-0.5">
                                Note: {c.resolutionNote}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <ConflictStatusBadge status={c.status} />
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1">
                            {canAck && (
                              <button
                                onClick={() => handleAcknowledgeConflict(c.id)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[11px] font-medium"
                              >
                                Ack
                              </button>
                            )}
                            {canResolve && (
                              <button
                                onClick={() => {
                                  setActiveConflictId(c.id)
                                  setNoteInput('')
                                  setResolveModalOpen(true)
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-medium"
                              >
                                Resolve
                              </button>
                            )}
                            {canOverride && (
                              <button
                                onClick={() => {
                                  setActiveConflictId(c.id)
                                  setNoteInput('')
                                  setOverrideModalOpen(true)
                                }}
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded text-[11px] font-medium"
                              >
                                Override
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-zinc-50 border border-dashed border-zinc-200 rounded text-center text-xs text-zinc-500">
              No conflicts currently logged for this event. Click &quot;Detect Conflicts&quot; to run a scan.
            </div>
          )}
        </div>

        {/* Event Specification Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logistics & Location */}
          <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              Venue & Logistics
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Venue:</span>
                <span className="font-semibold text-zinc-900">
                  {event.venue?.name} (Capacity: {event.venue?.capacity})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Organizing Club:</span>
                <span className="font-semibold text-zinc-900">
                  {event.club?.name} ({event.club?.code})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Academic Semester:</span>
                <span className="font-semibold text-zinc-900">
                  {event.semester?.name} {event.semester?.isLocked && '(LOCKED)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Expected Attendees:</span>
                <span className="font-semibold text-zinc-900">{event.expectedAttendees}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Start Time (IST):</span>
                <span className="font-mono text-zinc-900">{formatIST(event.startAt)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">End Time (IST):</span>
                <span className="font-mono text-zinc-900">{formatIST(event.endAt)}</span>
              </div>
            </div>
          </div>

          {/* Structured Audience & Metadata */}
          <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Audience & Targeting
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-zinc-500 block mb-1">Target Years:</span>
                {event.targetYears && event.targetYears.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {event.targetYears.map((y) => (
                      <span
                        key={y}
                        className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-[11px] font-medium border border-zinc-200"
                      >
                        Year {y}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-indigo-600 font-medium">All Years (Wildcard)</span>
                )}
              </div>

              <div>
                <span className="text-zinc-500 block mb-1">Target Branches:</span>
                {event.targetBranches && event.targetBranches.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {event.targetBranches.map((b) => (
                      <span
                        key={b}
                        className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-[11px] font-medium border border-zinc-200"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-indigo-600 font-medium">All Branches (Wildcard)</span>
                )}
              </div>

              <div>
                <span className="text-zinc-500 block mb-1">Tags:</span>
                {event.tags && event.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {event.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-zinc-50 text-zinc-600 rounded text-[11px] border border-zinc-200"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-zinc-400 italic">No tags specified</span>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <span className="text-zinc-500 block mb-1">Description:</span>
                <p className="text-zinc-700 whitespace-pre-line leading-relaxed">
                  {event.description || 'No description provided.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Review & Audit Log History */}
        {event.reviews && event.reviews.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              Review History
            </h3>
            <div className="divide-y divide-zinc-100 text-xs">
              {event.reviews.map((rev) => (
                <div key={rev.id} className="py-2.5 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-zinc-900 flex items-center gap-2">
                      <span>{rev.reviewer?.name || rev.reviewer?.email}</span>
                      <RoleBadge role={rev.reviewer?.role} />
                      <span
                        className={`text-[11px] font-bold ${
                          rev.decision === 'VERIFIED' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {rev.decision}
                      </span>
                    </div>
                    {rev.comment && <p className="text-zinc-600 mt-0.5">{rev.comment}</p>}
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono flex-shrink-0">
                    {formatIST(rev.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reject Event Modal */}
        <ModalDialog
          isOpen={rejectModalOpen}
          title="Reject Event Submission"
          description="A mandatory rejection explanation must be provided for the organizing club."
          onClose={() => setRejectModalOpen(false)}
        >
          <div className="space-y-4">
            <textarea
              rows={3}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Explain why this event is being rejected..."
              className="w-full text-sm border border-zinc-300 rounded p-2.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 border border-zinc-300 rounded text-xs text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRejectEvent}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </ModalDialog>

        {/* Cancel Event Modal */}
        <ModalDialog
          isOpen={cancelModalOpen}
          title="Cancel Event"
          description="Cancellation is restricted to ACM Core / Admin and requires an auditable reason."
          onClose={() => setCancelModalOpen(false)}
        >
          <div className="space-y-4">
            <textarea
              rows={3}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="State the reason for cancelling this event..."
              className="w-full text-sm border border-zinc-300 rounded p-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-3 py-1.5 border border-zinc-300 rounded text-xs text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleCancelEvent}
                className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-semibold"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </ModalDialog>

        {/* Resolve Conflict Modal */}
        <ModalDialog
          isOpen={resolveModalOpen}
          title="Resolve Conflict"
          description="Provide a resolution note explaining how the conflict was mitigated."
          onClose={() => setResolveModalOpen(false)}
        >
          <div className="space-y-4">
            <textarea
              rows={3}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. Schedule was adjusted or venue partitioned."
              className="w-full text-sm border border-zinc-300 rounded p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolveModalOpen(false)}
                className="px-3 py-1.5 border border-zinc-300 rounded text-xs text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleResolveConflict}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </ModalDialog>

        {/* Override Conflict Modal */}
        <ModalDialog
          isOpen={overrideModalOpen}
          title="Administrative Override"
          description="Authorize coexisting events despite the detected conflict."
          onClose={() => setOverrideModalOpen(false)}
        >
          <div className="space-y-4">
            <textarea
              rows={3}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. Joint co-hosted symposium approved by Core."
              className="w-full text-sm border border-zinc-300 rounded p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOverrideModalOpen(false)}
                className="px-3 py-1.5 border border-zinc-300 rounded text-xs text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleOverrideConflict}
                className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-semibold"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </ModalDialog>
      </div>
    </AppShell>
  )
}
