import React from 'react'

export function EventStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-300',
    SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-300',
    VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    REJECTED: 'bg-red-50 text-red-700 border-red-300',
    CANCELLED: 'bg-rose-50 text-rose-700 border-rose-300',
    COMPLETED: 'bg-blue-50 text-blue-700 border-blue-300',
  }

  const badgeStyle = styles[status] || 'bg-zinc-100 text-zinc-700 border-zinc-200'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badgeStyle}`}>
      {status}
    </span>
  )
}

export function ExpenseStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-300',
    SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-300',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    REJECTED: 'bg-red-50 text-red-700 border-red-300',
    REIMBURSED: 'bg-purple-50 text-purple-700 border-purple-300',
  }

  const badgeStyle = styles[status] || 'bg-zinc-100 text-zinc-700 border-zinc-200'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badgeStyle}`}>
      {status}
    </span>
  )
}

export function ConflictSeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    HIGH: 'bg-red-100 text-red-800 border-red-300 font-bold',
    MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
    LOW: 'bg-sky-100 text-sky-800 border-sky-300 font-medium',
  }

  const badgeStyle = styles[severity] || 'bg-zinc-100 text-zinc-700 border-zinc-200'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${badgeStyle}`}>
      {severity}
    </span>
  )
}

export function ConflictStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: 'bg-red-50 text-red-700 border-red-300',
    ACKNOWLEDGED: 'bg-amber-50 text-amber-700 border-amber-300',
    RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    OVERRIDDEN: 'bg-purple-50 text-purple-700 border-purple-300',
  }

  const badgeStyle = styles[status] || 'bg-zinc-100 text-zinc-700 border-zinc-200'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badgeStyle}`}>
      {status}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    SUPER_ADMIN: 'bg-red-600 text-white font-bold',
    ACM_CORE: 'bg-indigo-600 text-white font-semibold',
    ACM_EXEC: 'bg-blue-600 text-white font-medium',
    CLUB_REP: 'bg-emerald-600 text-white font-medium',
    VIEWER: 'bg-zinc-600 text-white font-medium',
  }

  const badgeStyle = styles[role] || 'bg-zinc-500 text-white'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs tracking-wide uppercase ${badgeStyle}`}>
      {role}
    </span>
  )
}
