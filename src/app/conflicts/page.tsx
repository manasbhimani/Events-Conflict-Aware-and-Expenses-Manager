'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/layout/AppShell'
import { ConflictSeverityBadge, ConflictStatusBadge } from '@/components/ui/Badges'
import { LoadingSpinner, EmptyState, AlertBanner, ModalDialog } from '@/components/ui/Feedback'
import { fetchApi } from '@/lib/api'
import { canClient } from '@/lib/auth-client'
import {
  AlertTriangle,
  Filter,
  CheckCircle,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'

export interface ConflictRow {
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
  eventA: {
    id: string
    title: string
    clubId: string
    eventType: string
    club: { name: string; code: string }
    venue: { name: string }
  }
  eventB: {
    id: string
    title: string
    clubId: string
    eventType: string
    club: { name: string; code: string }
    venue: { name: string }
  }
}

export default function ConflictsPage() {
  const { data: session } = useSession()
  const user = session?.user

  const [conflicts, setConflicts] = useState<ConflictRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  // Modals
  const [activeConflictId, setActiveConflictId] = useState<string | null>(null)
  const [resolveModalOpen, setResolveModalOpen] = useState(false)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [noteInput, setNoteInput] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadConflicts = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (severityFilter) params.set('severity', severityFilter)
      if (typeFilter) params.set('conflictType', typeFilter)

      const res = await fetchApi<ConflictRow[]>(`/api/conflicts?${params.toString()}`)
      setConflicts(res.data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch conflict records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      loadConflicts()
    }
  }, [session, statusFilter, severityFilter, typeFilter])

  const handleAcknowledge = async (id: string) => {
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/conflicts/${id}/acknowledge`, { method: 'POST' })
      setSuccessMsg('Conflict acknowledged.')
      await loadConflicts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolve = async () => {
    if (!activeConflictId) return
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/conflicts/${activeConflictId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note: noteInput.trim() || 'Resolved' }),
      })
      setSuccessMsg('Conflict resolved successfully.')
      setResolveModalOpen(false)
      setNoteInput('')
      await loadConflicts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleOverride = async () => {
    if (!activeConflictId) return
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/conflicts/${activeConflictId}/override`, {
        method: 'POST',
        body: JSON.stringify({ note: noteInput.trim() || 'Overridden' }),
      })
      setSuccessMsg('Conflict administrative override recorded.')
      setOverrideModalOpen(false)
      setNoteInput('')
      await loadConflicts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              Conflict Detection Control Center
            </h2>
            <span className="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold border border-amber-300">
              ACM Core Hub
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Review and adjudicate system-detected scheduling, venue, and audience overlaps.
          </p>
        </div>

        {/* Principle Banner */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Human Decision Principle:</span>
            <p className="text-amber-800 leading-relaxed">
              The conflict detection engine detects and scores overlaps without ever modifying,
              rescheduling, or cancelling events automatically. ACM Core and Super Admins evaluate
              severity scores and take deliberate human action.
            </p>
          </div>
        </div>

        {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
        {successMsg && (
          <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-700 font-semibold">
            <Filter className="w-4 h-4 text-zinc-400" />
            <span>Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-zinc-300 rounded px-2.5 py-1.5 bg-white text-zinc-700"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="OVERRIDDEN">OVERRIDDEN</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="border border-zinc-300 rounded px-2.5 py-1.5 bg-white text-zinc-700"
          >
            <option value="">All Severities</option>
            <option value="HIGH">HIGH (&ge;0.70)</option>
            <option value="MEDIUM">MEDIUM (0.40 - 0.69)</option>
            <option value="LOW">LOW (&lt;0.40)</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-zinc-300 rounded px-2.5 py-1.5 bg-white text-zinc-700"
          >
            <option value="">All Conflict Types</option>
            <option value="VENUE">VENUE</option>
            <option value="AUDIENCE">AUDIENCE</option>
            <option value="TIME_OVERLAP">TIME_OVERLAP</option>
            <option value="TIGHT_TURNAROUND">TIGHT_TURNAROUND (&lt;30m)</option>
            <option value="ORGANIZER">ORGANIZER</option>
          </select>

          {(statusFilter || severityFilter || typeFilter) && (
            <button
              onClick={() => {
                setStatusFilter('')
                setSeverityFilter('')
                setTypeFilter('')
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Conflicts Table */}
        {loading ? (
          <LoadingSpinner message="Scanning conflict records..." />
        ) : conflicts.length === 0 ? (
          <EmptyState
            title="No conflicts found"
            description="No active conflict records matched your current query."
          />
        ) : (
          <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Event A</th>
                    <th className="py-3 px-4">Event B</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {conflicts.map((c) => {
                    const canAck =
                      c.status === 'OPEN' &&
                      (user?.role === 'SUPER_ADMIN' ||
                        user?.role === 'ACM_CORE' ||
                        (user?.role === 'CLUB_REP' &&
                          (user.clubId === c.eventA?.clubId || user.clubId === c.eventB?.clubId)))
                    const canResolve =
                      c.status !== 'RESOLVED' &&
                      c.status !== 'OVERRIDDEN' &&
                      canClient(user?.role, 'RESOLVE_CONFLICT')
                    const canOverride =
                      c.status !== 'RESOLVED' &&
                      c.status !== 'OVERRIDDEN' &&
                      canClient(user?.role, 'OVERRIDE_CONFLICT')

                    return (
                      <tr key={c.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3 px-4 max-w-[200px]">
                          <Link
                            href={`/events/${c.eventA?.id}`}
                            className="font-semibold text-zinc-900 hover:text-indigo-600 line-clamp-1"
                          >
                            {c.eventA?.title || c.eventAId}
                          </Link>
                          <span className="text-[10px] text-zinc-400">
                            {c.eventA?.club?.name} ({c.eventA?.venue?.name})
                          </span>
                        </td>

                        <td className="py-3 px-4 max-w-[200px]">
                          <Link
                            href={`/events/${c.eventB?.id}`}
                            className="font-semibold text-zinc-900 hover:text-indigo-600 line-clamp-1"
                          >
                            {c.eventB?.title || c.eventBId}
                          </Link>
                          <span className="text-[10px] text-zinc-400">
                            {c.eventB?.club?.name} ({c.eventB?.venue?.name})
                          </span>
                        </td>

                        <td className="py-3 px-4 font-semibold text-zinc-800">{c.conflictType}</td>

                        <td className="py-3 px-4">
                          <ConflictSeverityBadge severity={c.severity} />
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-zinc-900">
                          {c.conflictScore !== null ? `${c.conflictScore}/100` : '-'}
                        </td>

                        <td className="py-3 px-4">
                          <ConflictStatusBadge status={c.status} />
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="line-clamp-2 text-[11px] text-zinc-600">
                            {c.description}
                          </div>
                          {c.resolutionNote && (
                            <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                              Note: {c.resolutionNote}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canAck && (
                              <button
                                onClick={() => handleAcknowledge(c.id)}
                                disabled={actionLoading}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[11px] font-semibold"
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
                                disabled={actionLoading}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-semibold"
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
                                disabled={actionLoading}
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded text-[11px] font-semibold"
                              >
                                Override
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-zinc-50 border-t border-zinc-200 text-xs text-zinc-500">
              Showing {conflicts.length} conflict record(s)
            </div>
          </div>
        )}

        {/* Resolve Modal */}
        <ModalDialog
          isOpen={resolveModalOpen}
          title="Resolve Conflict"
          description="Enter a note explaining the mitigation before marking this conflict as resolved."
          onClose={() => setResolveModalOpen(false)}
        >
          <div className="space-y-4">
            <textarea
              rows={3}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. Discussed with reps, times rescheduled."
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
                onClick={handleResolve}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        </ModalDialog>

        {/* Override Modal */}
        <ModalDialog
          isOpen={overrideModalOpen}
          title="Administrative Conflict Override"
          description="Authorize the coexistence of conflicting events with an explicit audit note."
          onClose={() => setOverrideModalOpen(false)}
        >
          <div className="space-y-4">
            <textarea
              rows={3}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. Joint festival granted core exception."
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
                onClick={handleOverride}
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
