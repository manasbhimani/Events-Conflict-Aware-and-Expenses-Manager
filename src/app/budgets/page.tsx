'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { fetchApi } from '@/lib/api'
import { AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react'

type Semester = { id: string; name: string; isLocked: boolean }
type Category = { id: string; name: string; description: string }

type BudgetSummary = {
  semester: { id: string; name: string; isLocked: boolean }
  totalBudget: string
  totalAllocated: string
  unallocatedBudget: string
  totalSpent: string
  remainingOverall: string
  utilizationPercentage: number
  semesterOverspent: boolean
  categoryBreakdown: Array<{
    id: string
    categoryId: string
    categoryName: string
    clubId: string | null
    clubName: string | null
    allocatedAmount: string
    spentAmount: string
    remainingAmount: string
    utilizationPercentage: number
    overspent: boolean
  }>
  monthlyBreakdown: Array<{
    month: string
    amount: string
  }>
}

export default function BudgetsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const role = session?.user?.role
  
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('')
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Allocation Form
  const [showAllocForm, setShowAllocForm] = useState(false)
  const [newAllocCat, setNewAllocCat] = useState('')
  const [newAllocAmount, setNewAllocAmount] = useState('')
  const [newAllocNotes, setNewAllocNotes] = useState('')

  useEffect(() => {
    if (!role) return
    if (role === 'VIEWER' || role === 'CLUB_REP') {
      router.replace('/dashboard')
      return
    }

    const loadMeta = async () => {
      try {
        const res = await fetchApi<any>('/api/meta'); const data = res.data;
        setSemesters(data.semesters || [])
        setCategories(data.categories || [])
        if (data.semesters && data.semesters.length > 0) {
          setSelectedSemesterId(data.semesters[0].id)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadMeta()
  }, [role, router])

  useEffect(() => {
    if (!selectedSemesterId) return

    const loadSummary = async () => {
      setLoading(true)
      try {
        const res = await fetchApi<any>(`/api/budgets/${selectedSemesterId}/summary`); const data = res.data;
        setSummary(data)
      } catch (err: any) {
        setError(err.message)
        setSummary(null)
      } finally {
        setLoading(false)
      }
    }
    loadSummary()
  }, [selectedSemesterId])

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetchApi('/api/budgets/allocations', {
        method: 'POST',
        body: JSON.stringify({
          semesterId: selectedSemesterId,
          categoryId: newAllocCat,
          allocatedAmount: newAllocAmount,
          notes: newAllocNotes
        })
      })
      
      // Reload summary
      const res = await fetchApi<any>(`/api/budgets/${selectedSemesterId}/summary`); const data = res.data;
      setSummary(data)
      setShowAllocForm(false)
      setNewAllocCat('')
      setNewAllocAmount('')
      setNewAllocNotes('')
    } catch (err: any) {
      alert(`Error creating allocation: ${err.message}`)
    }
  }

  const handleDeleteAllocation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this allocation?')) return
    try {
      await fetchApi(`/api/budgets/allocations/${id}`, { method: 'DELETE' })
      const res = await fetchApi<any>(`/api/budgets/${selectedSemesterId}/summary`); const data = res.data;
      setSummary(data)
    } catch (err: any) {
      alert(`Error deleting allocation: ${err.message}`)
    }
  }

  if (loading && !semesters.length) return <div className="p-8">Loading...</div>

  const canManage = role === 'SUPER_ADMIN' || role === 'ACM_CORE'

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Budget Management</h1>
        <p className="text-sm text-zinc-500 mt-1">Financial overview and allocations</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <label className="text-sm font-semibold text-zinc-700">Select Semester:</label>
        <select
          className="px-3 py-1.5 border border-zinc-300 rounded text-sm bg-white"
          value={selectedSemesterId}
          onChange={(e) => setSelectedSemesterId(e.target.value)}
        >
          {semesters.map(s => (
            <option key={s.id} value={s.id}>{s.name} {s.isLocked ? '(Locked)' : ''}</option>
          ))}
        </select>
      </div>

      {loading && semesters.length > 0 && <div className="text-sm text-zinc-500">Loading summary...</div>}

      {summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded shadow-sm border border-zinc-200">
              <div className="text-xs text-zinc-500 uppercase font-semibold">Total Budget</div>
              <div className="text-2xl font-bold text-zinc-900 mt-1">₹{summary.totalBudget}</div>
            </div>
            <div className="bg-white p-4 rounded shadow-sm border border-zinc-200">
              <div className="text-xs text-zinc-500 uppercase font-semibold">Total Allocated</div>
              <div className="text-2xl font-bold text-zinc-900 mt-1">₹{summary.totalAllocated}</div>
              <div className="text-xs text-zinc-500 mt-1">Unallocated: ₹{summary.unallocatedBudget}</div>
            </div>
            <div className="bg-white p-4 rounded shadow-sm border border-zinc-200">
              <div className="text-xs text-zinc-500 uppercase font-semibold">Total Spent</div>
              <div className="text-2xl font-bold text-zinc-900 mt-1">₹{summary.totalSpent}</div>
            </div>
            <div className={`p-4 rounded shadow-sm border ${summary.semesterOverspent ? 'bg-red-50 border-red-200' : 'bg-white border-zinc-200'}`}>
              <div className={`text-xs uppercase font-semibold ${summary.semesterOverspent ? 'text-red-700' : 'text-zinc-500'}`}>Remaining Budget</div>
              <div className={`text-2xl font-bold mt-1 ${summary.semesterOverspent ? 'text-red-700' : 'text-zinc-900'}`}>₹{summary.remainingOverall}</div>
              <div className="text-xs text-zinc-500 mt-1">{summary.utilizationPercentage}% Utilized</div>
            </div>
          </div>

          <div className="bg-white rounded shadow-sm border border-zinc-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-zinc-900">Category Breakdown</h2>
              {canManage && !summary.semester.isLocked && (
                <button
                  onClick={() => setShowAllocForm(!showAllocForm)}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700"
                >
                  {showAllocForm ? 'Cancel' : 'New Allocation'}
                </button>
              )}
            </div>

            {showAllocForm && (
              <form onSubmit={handleCreateAllocation} className="mb-6 p-4 bg-zinc-50 rounded border border-zinc-200 flex gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Category</label>
                  <select required value={newAllocCat} onChange={e => setNewAllocCat(e.target.value)} className="w-48 px-3 py-1.5 border border-zinc-300 rounded text-sm">
                    <option value="">Select...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Amount (₹)</label>
                  <input required type="number" step="0.01" min="0.01" value={newAllocAmount} onChange={e => setNewAllocAmount(e.target.value)} className="w-32 px-3 py-1.5 border border-zinc-300 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Notes</label>
                  <input type="text" value={newAllocNotes} onChange={e => setNewAllocNotes(e.target.value)} className="w-48 px-3 py-1.5 border border-zinc-300 rounded text-sm" />
                </div>
                <button type="submit" className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700">Save</button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50">
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Allocated (₹)</th>
                    <th className="px-4 py-3 text-right">Spent (₹)</th>
                    <th className="px-4 py-3 text-right">Remaining (₹)</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {summary.categoryBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No category allocations found.</td>
                    </tr>
                  )}
                  {summary.categoryBreakdown.map(c => (
                    <tr key={c.id} className={c.id.startsWith('unallocated') ? 'bg-orange-50' : ''}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{c.categoryName} {c.id.startsWith('unallocated') && <span className="text-[10px] bg-orange-200 text-orange-800 px-1 rounded ml-2">Unallocated</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.allocatedAmount}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{c.spentAmount}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-semibold ${c.overspent ? 'text-red-600' : 'text-zinc-900'}`}>{c.remainingAmount}</td>
                      <td className="px-4 py-3 text-center">
                        {c.overspent ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3" /> Overspent
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                            {c.utilizationPercentage}%
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          {!c.id.startsWith('unallocated') && !summary.semester.isLocked && (
                            <button onClick={() => handleDeleteAllocation(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded shadow-sm border border-zinc-200 p-6">
            <h2 className="text-lg font-bold text-zinc-900 mb-4">Monthly Expenditure</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {summary.monthlyBreakdown.length === 0 && (
                <div className="text-zinc-500 text-sm">No expenses found for this semester.</div>
              )}
              {summary.monthlyBreakdown.map(m => (
                <div key={m.month} className="p-4 border border-zinc-200 rounded">
                  <div className="text-xs text-zinc-500 font-semibold">{m.month}</div>
                  <div className="text-xl font-bold text-zinc-900 mt-1">₹{m.amount}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
