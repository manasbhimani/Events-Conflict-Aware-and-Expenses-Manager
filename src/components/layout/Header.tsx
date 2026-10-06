'use client'

import React from 'react'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, User, Building } from 'lucide-react'
import { RoleBadge } from '@/components/ui/Badges'

export function Header() {
  const { data: session } = useSession()
  const user = session?.user

  return (
    <header className="h-16 bg-white border-b border-zinc-200 px-6 flex items-center justify-between z-10 sticky top-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-zinc-900 tracking-tight hidden sm:block">
          ACM Conflict-Aware Manager
        </h1>
        <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded font-mono border border-zinc-200">
          Phase 5.5 Testing UI
        </span>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 font-bold">
                {user.name ? user.name[0]?.toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="hidden md:block text-right">
                <div className="font-medium text-xs text-zinc-900 flex items-center gap-1.5 justify-end">
                  {user.name || user.email}
                  <RoleBadge role={user.role} />
                </div>
                <div className="text-[11px] text-zinc-500">
                  {user.email}
                  {user.clubId && (
                    <span className="ml-1 text-zinc-400">
                      (Club: {user.clubId.slice(0, 8)}...)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-zinc-500">Not authenticated</div>
        )}
      </div>
    </header>
  )
}
