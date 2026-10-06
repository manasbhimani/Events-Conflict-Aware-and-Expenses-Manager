'use client'

import React, { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { KeyRound, Mail, AlertCircle, Shield } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (res?.error) {
        if (res.error.includes('inactive') || res.error.includes('Inactive')) {
          setError('This account is deactivated. Contact an administrator.')
        } else if (res.error === 'CredentialsSignin') {
          setError('Invalid email or password.')
        } else {
          setError('Authentication failed. Please verify your credentials.')
        }
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError('An unexpected error occurred during sign-in.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('DemoPassword123!')
    setError(null)
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Shield className="w-6 h-6" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-zinc-900 tracking-tight">
          ACM Conflict-Aware Manager
        </h2>
        <p className="mt-1 text-center text-xs text-zinc-500 font-mono">
          Phase 5.5 Functional Testing Control Panel
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow sm:rounded-lg sm:px-10 border border-zinc-200">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@acm-demo.college.edu"
                  className="block w-full pl-10 pr-3 py-2 border border-zinc-300 rounded text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2 border border-zinc-300 rounded text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-zinc-200">
            <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-2">
              Quick Demo Logins (Click to Autofill)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillDemo('superadmin@acm-demo.college.edu')}
                className="text-left p-2 rounded bg-red-50 hover:bg-red-100 border border-red-200 text-red-900 transition-colors"
              >
                <div className="font-bold">SUPER_ADMIN</div>
                <div className="text-[10px] text-red-700 truncate">superadmin@...</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('core@acm-demo.college.edu')}
                className="text-left p-2 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 transition-colors"
              >
                <div className="font-bold">ACM_CORE</div>
                <div className="text-[10px] text-indigo-700 truncate">core@...</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('exec@acm-demo.college.edu')}
                className="text-left p-2 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 transition-colors"
              >
                <div className="font-bold">ACM_EXEC</div>
                <div className="text-[10px] text-blue-700 truncate">exec@...</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('rep.coding@acm-demo.college.edu')}
                className="text-left p-2 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 transition-colors"
              >
                <div className="font-bold">CLUB_REP</div>
                <div className="text-[10px] text-emerald-700 truncate">Coding Club</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('viewer@acm-demo.college.edu')}
                className="text-left p-2 rounded bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 transition-colors col-span-2"
              >
                <div className="font-bold">VIEWER (Read-Only)</div>
                <div className="text-[10px] text-zinc-600 truncate">viewer@...</div>
              </button>
            </div>
            <div className="mt-2 text-[11px] text-zinc-500 text-center font-mono">
              Password for all: DemoPassword123!
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
