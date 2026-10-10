'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  AlertTriangle,
  Receipt, Bell,
  PlusCircle,
} from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role

  const [unreadCount, setUnreadCount] = React.useState(0)
  
  React.useEffect(() => {
    if (session?.user) {
      fetch('/api/notifications/unread-count')
        .then(res => res.json())
        .then(data => setUnreadCount(data.count || 0))
        .catch(console.error)
    }
  }, [session?.user])

  const isViewer = role === 'VIEWER'
  const canViewBudgets = role === 'SUPER_ADMIN' || role === 'ACM_CORE' || role === 'ACM_EXEC'

    const navItems = [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        show: true,
      },
      {
        name: 'Events',
        href: '/events',
        icon: CalendarDays,
        show: true,
      },
      {
        name: 'Calendar',
        href: '/calendar',
        icon: Calendar,
        show: true,
      },
      {
        name: 'Conflicts',
        href: '/conflicts',
        icon: AlertTriangle,
        show: !isViewer,
        badge: 'Core/Rep',
      },
      {
        name: 'Expenses',
        href: '/expenses',
        icon: Receipt,
        show: !isViewer,
      },
      {
        name: 'Notifications',
        href: '/notifications',
        icon: Bell,
        show: !!session?.user,
        badge: unreadCount > 0 ? unreadCount : undefined,
      },
      {
        name: 'Budgets',
        href: '/budgets',
        icon: Receipt, // Reusing Receipt icon, could also be PieChart
        show: canViewBudgets,
        badge: 'Core/Exec',
      },
    ]

  return (
    <aside className="w-64 bg-zinc-900 text-zinc-300 flex flex-col flex-shrink-0 min-h-screen">
      <div className="p-5 border-b border-zinc-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
          ACM
        </div>
        <div>
          <div className="font-bold text-sm text-white leading-tight">Incursion</div>
          <div className="text-[11px] text-zinc-400">Events & Expenses</div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
      </nav>

      {!isViewer && (
        <div className="p-4 border-t border-zinc-800 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-1">
            Quick Actions
          </div>
          <Link
            href="/events/new"
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>New Event</span>
          </Link>
          <Link
            href="/expenses/new"
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>New Expense</span>
          </Link>
        </div>
      )}

      <div className="p-4 border-t border-zinc-800 text-[11px] text-zinc-500">
        <div>PostgreSQL 17 • Next.js 16</div>
        <div>Prisma 6.19 • RBAC Active</div>
      </div>
    </aside>
  )
}
