import React from 'react'
import { auth } from '@/server/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/server/lib/prisma'
import { AppShell } from '@/components/layout/AppShell'
import { RoleBadge } from '@/components/ui/Badges'
import { ROLE_PERMISSIONS } from '@/lib/auth-client'
import {
  CalendarDays,
  Calendar,
  AlertTriangle,
  Receipt,
  PlusCircle,
  ShieldCheck,
  Building,
  CheckCircle2,
  Clock,
} from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user
  const userClub = user.clubId
    ? await prisma.club.findUnique({ where: { id: user.clubId } })
    : null

  // Lightweight counts for testing dashboard
  let eventCount = 0
  let submittedEventCount = 0
  let activeConflictsCount = 0
  let expenseCount = 0

  if (user.role === 'VIEWER') {
    eventCount = await prisma.event.count({
      where: { deletedAt: null, status: { in: ['VERIFIED', 'COMPLETED'] } },
    })
  } else if (user.role === 'CLUB_REP' && user.clubId) {
    eventCount = await prisma.event.count({
      where: {
        deletedAt: null,
        OR: [
          { status: { in: ['VERIFIED', 'COMPLETED'] } },
          { clubId: user.clubId },
        ],
      },
    })
    submittedEventCount = await prisma.event.count({
      where: { deletedAt: null, clubId: user.clubId, status: 'SUBMITTED' },
    })
    activeConflictsCount = await prisma.conflictRecord.count({
      where: {
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        OR: [{ eventA: { clubId: user.clubId } }, { eventB: { clubId: user.clubId } }],
      },
    })
    expenseCount = await prisma.expense.count({
      where: { deletedAt: null, clubId: user.clubId },
    })
  } else {
    // SUPER_ADMIN, ACM_CORE, ACM_EXEC
    eventCount = await prisma.event.count({ where: { deletedAt: null } })
    submittedEventCount = await prisma.event.count({
      where: { deletedAt: null, status: 'SUBMITTED' },
    })
    activeConflictsCount = await prisma.conflictRecord.count({
      where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    })
    expenseCount = await prisma.expense.count({ where: { deletedAt: null } })
  }

  const permissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || []

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Welcome & Session Information */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
                  Welcome, {user.name || user.email}
                </h2>
                <RoleBadge role={user.role} />
              </div>
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                System Session ID: {user.id}
              </p>
            </div>
            {userClub && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded text-xs">
                <Building className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-zinc-700">Representing: {userClub.name}</span>
                <span className="text-zinc-400 font-mono">({userClub.code})</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-zinc-500 block">Email:</span>
              <span className="font-medium text-zinc-900">{user.email}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">RBAC Role:</span>
              <span className="font-semibold text-zinc-900">{user.role}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Club Scope:</span>
              <span className="font-medium text-zinc-900">
                {userClub ? `${userClub.name}` : user.role === 'SUPER_ADMIN' || user.role === 'ACM_CORE' ? 'Institutional (All Clubs)' : 'None'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Permissions Count:</span>
              <span className="font-medium text-zinc-900">{permissions.length} actions allowed</span>
            </div>
          </div>
        </div>

        {/* Quick Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Visible Events
              </p>
              <p className="text-2xl font-bold text-zinc-900 mt-1">{eventCount}</p>
              <Link
                href="/events"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1 inline-block"
              >
                View all &rarr;
              </Link>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Pending Review
              </p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{submittedEventCount}</p>
              <Link
                href="/events?status=SUBMITTED"
                className="text-xs text-amber-600 hover:text-amber-800 font-medium mt-1 inline-block"
              >
                Review queue &rarr;
              </Link>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {user.role !== 'VIEWER' ? (
            <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Active Conflicts
                </p>
                <p className="text-2xl font-bold text-red-600 mt-1">{activeConflictsCount}</p>
                <Link
                  href="/conflicts"
                  className="text-xs text-red-600 hover:text-red-800 font-medium mt-1 inline-block"
                >
                  Manage conflicts &rarr;
                </Link>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 p-5 rounded-lg border border-dashed border-zinc-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Conflicts
                </p>
                <p className="text-xs text-zinc-500 mt-1">Restricted for Viewer</p>
              </div>
              <ShieldCheck className="w-5 h-5 text-zinc-400" />
            </div>
          )}

          {user.role !== 'VIEWER' ? (
            <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Expenses Records
                </p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{expenseCount}</p>
                <Link
                  href="/expenses"
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-medium mt-1 inline-block"
                >
                  View expenses &rarr;
                </Link>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 p-5 rounded-lg border border-dashed border-zinc-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Expenses
                </p>
                <p className="text-xs text-zinc-500 mt-1">Restricted for Viewer</p>
              </div>
              <ShieldCheck className="w-5 h-5 text-zinc-400" />
            </div>
          )}
        </div>

        {/* Feature Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-900">Events Management</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Create, submit, verify, reject, or cancel club events. Test state machine transitions
              and ownership boundaries.
            </p>
            <div className="pt-2 flex items-center gap-2">
              <Link
                href="/events"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors"
              >
                Browse Events
              </Link>
              {user.role !== 'VIEWER' && (
                <Link
                  href="/events/new"
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded text-xs font-medium transition-colors"
                >
                  + New Event
                </Link>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-900">Conflict Detection Engine</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Trigger conflict scans across venue, audience overlap, tight turnaround, and time
              intervals. Test acknowledge, resolve, and override workflows.
            </p>
            <div className="pt-2 flex items-center gap-2">
              {user.role !== 'VIEWER' ? (
                <Link
                  href="/conflicts"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium transition-colors"
                >
                  Review Conflicts
                </Link>
              ) : (
                <span className="text-xs text-zinc-400">Viewers cannot access conflicts</span>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-zinc-900">Interactive Calendar</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              FullCalendar month, week, and day visualizer rendering verified events in real-time.
              Click any event to inspect its details and conflicts.
            </p>
            <div className="pt-2 flex items-center gap-2">
              <Link
                href="/calendar"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
              >
                Open Calendar
              </Link>
            </div>
          </div>
        </div>

        {/* Permissions & Security Summary Matrix */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Active Role Capabilities for Testing ({user.role})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {permissions.map((action) => (
              <span
                key={action}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-700 border border-zinc-200"
              >
                {action}
              </span>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
