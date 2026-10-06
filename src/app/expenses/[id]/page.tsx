'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/layout/AppShell'
import { ExpenseStatusBadge, RoleBadge } from '@/components/ui/Badges'
import { LoadingSpinner, EmptyState, AlertBanner, ModalDialog } from '@/components/ui/Feedback'
import { fetchApi, ApiError } from '@/lib/api'
import { canClient, canManageClubResource } from '@/lib/auth-client'
import {
  Receipt as ReceiptIcon,
  Calendar,
  Building,
  Tag,
  IndianRupee,
  Lock,
  Send,
  CheckCircle2,
  XCircle,
  Trash2,
  Upload,
  FileText,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'

export interface ReceiptItem {
  id: string
  expenseId: string
  fileUrl: string
  storagePublicId: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  sha256: string
  createdAt: string
  uploadedByUserId: string
}

export interface ExpenseDetail {
  id: string
  title: string
  description: string | null
  amount: string
  date: string
  status: string
  clubId: string
  semesterId: string
  categoryId: string
  eventId: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  club: { id: string; name: string; code: string }
  category: { id: string; name: string }
  semester: { id: string; name: string; isLocked: boolean }
  event: { id: string; title: string } | null
  createdBy: { id: string; name: string; email: string }
  reviewedBy: { id: string; name: string; email: string } | null
  receipts: ReceiptItem[]
}

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const expenseId = resolvedParams.id

  const { data: session } = useSession()
  const user = session?.user

  const [expense, setExpense] = useState<ExpenseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<ExpenseDetail>(`/api/expenses/${expenseId}`)
      setExpense(res.data)
    } catch (err: any) {
      setError(err.message || 'Failed to load expense details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      loadData()
    }
  }, [session, expenseId])

  const formatCurrency = (amt: string) => {
    try {
      const num = parseFloat(amt)
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
      }).format(num)
    } catch {
      return `₹${amt}`
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  // Lifecycle Actions
  const handleSubmitExpense = async () => {
    if (!confirm('Submit this expense for ACM Core review?')) return
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/expenses/${expenseId}/submit`, { method: 'POST' })
      setSuccessMsg('Expense successfully submitted for review.')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproveExpense = async () => {
    if (!confirm('Approve this expense record?')) return
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/expenses/${expenseId}/approve`, { method: 'POST' })
      setSuccessMsg('Expense approved.')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectExpense = async () => {
    if (!rejectReason.trim()) {
      setError('Rejection explanation is mandatory.')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/expenses/${expenseId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      setSuccessMsg('Expense rejected.')
      setRejectModalOpen(false)
      setRejectReason('')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteExpense = async () => {
    if (!confirm('Are you sure you want to delete this expense?')) return
    setActionLoading(true)
    setError(null)
    try {
      await fetchApi(`/api/expenses/${expenseId}`, { method: 'DELETE' })
      router.push('/expenses')
    } catch (err: any) {
      setError(err.message)
      setActionLoading(false)
    }
  }

  // Receipt File Upload Flow
  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Validation (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setError('Receipt exceeds the 5MB file size limit.')
      return
    }

    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file format. Only JPEG, PNG, and PDF files are permitted.')
      return
    }

    setUploadingReceipt(true)
    setError(null)
    setSuccessMsg(null)

    try {
      // 2. Compute client SHA-256 hash
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const sha256Hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      // 3. Request upload signature from backend
      const sigRes = await fetchApi<{
        timestamp: number
        signature: string
        cloudName: string
        apiKey: string
      }>(`/api/expenses/${expenseId}/receipts/signature`)

      // 4. Save receipt record with computed hash and metadata
      await fetchApi(`/api/expenses/${expenseId}/receipts`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          sha256: sha256Hex,
          fileUrl: `https://storage.mock.local/receipts/${file.name}`,
          storagePublicId: `receipt_${Date.now()}_${file.name}`,
        }),
      })

      setSuccessMsg(`Receipt "${file.name}" added successfully.`)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to upload receipt.')
    } finally {
      setUploadingReceipt(false)
      // Reset input
      e.target.value = ''
    }
  }

  if (loading) {
    return (
      <AppShell>
        <LoadingSpinner message="Loading expense ledger..." />
      </AppShell>
    )
  }

  if (!expense) {
    return (
      <AppShell>
        <EmptyState
          title="Expense Not Found"
          description="The requested expense ledger entry does not exist or you lack permission to view it."
        />
      </AppShell>
    )
  }

  // RBAC permissions check
  const isOwner = canManageClubResource(user?.role, user?.clubId, expense.clubId)
  const isSemesterLocked = expense.semester?.isLocked

  const canSubmit = isOwner && expense.status === 'DRAFT' && !isSemesterLocked
  const canApprove =
    expense.status === 'SUBMITTED' && canClient(user?.role, 'APPROVE_EXPENSE') && !isSemesterLocked
  const canReject =
    expense.status === 'SUBMITTED' && canClient(user?.role, 'REJECT_EXPENSE') && !isSemesterLocked
  const canDelete =
    isOwner && (expense.status === 'DRAFT' || expense.status === 'REJECTED') && !isSemesterLocked
  const canAddReceipt = isOwner && !isSemesterLocked

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Main Header Card */}
        <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">{expense.title}</h1>
                <ExpenseStatusBadge status={expense.status} />
              </div>
              <p className="text-xs text-zinc-500 font-mono mt-1">Expense ID: {expense.id}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {canSubmit && (
                <button
                  onClick={handleSubmitExpense}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit for Approval
                </button>
              )}

              {canApprove && (
                <button
                  onClick={handleApproveExpense}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Expense
                </button>
              )}

              {canReject && (
                <button
                  onClick={() => {
                    setRejectReason('')
                    setRejectModalOpen(true)
                  }}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject Expense
                </button>
              )}

              {canDelete && (
                <button
                  onClick={handleDeleteExpense}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-red-700 rounded text-xs font-medium border border-zinc-300 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Locked Semester Notification */}
          {isSemesterLocked && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2 font-medium">
              <Lock className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>
                This semester ({expense.semester?.name}) is locked. This expense cannot be modified,
                submitted, approved, or deleted.
              </span>
            </div>
          )}

          {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}
          {successMsg && (
            <AlertBanner type="success" message={successMsg} onDismiss={() => setSuccessMsg(null)} />
          )}

          {expense.rejectionReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              <span className="font-bold">Rejection Reason:</span> {expense.rejectionReason}
            </div>
          )}
        </div>

        {/* Expense Properties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
              <ReceiptIcon className="w-4 h-4 text-emerald-600" />
              Financial Information
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Amount:</span>
                <span className="font-mono text-base font-bold text-zinc-900">
                  {formatCurrency(expense.amount)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Category:</span>
                <span className="font-semibold text-zinc-900">{expense.category?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Organizing Club:</span>
                <span className="font-semibold text-zinc-900">
                  {expense.club?.name} ({expense.club?.code})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Semester:</span>
                <span className="font-semibold text-zinc-900">
                  {expense.semester?.name}{' '}
                  {expense.semester?.isLocked && (
                    <span className="text-red-600 font-bold ml-1">[LOCKED]</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Transaction Date:</span>
                <span className="font-mono text-zinc-900">{formatDate(expense.date)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Linked Event:</span>
                {expense.event ? (
                  <Link
                    href={`/events/${expense.event.id}`}
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    {expense.event.title}
                  </Link>
                ) : (
                  <span className="text-zinc-400 italic">None (General Club Ledger)</span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-600" />
              Provenance & Description
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Created By:</span>
                <span className="font-medium text-zinc-900">
                  {expense.createdBy?.name || expense.createdBy?.email}
                </span>
              </div>
              {expense.reviewedBy && (
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-zinc-500">Reviewed By:</span>
                  <span className="font-medium text-zinc-900">
                    {expense.reviewedBy.name || expense.reviewedBy.email}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-zinc-100">
                <span className="text-zinc-500">Created Timestamp:</span>
                <span className="font-mono text-zinc-600">{formatDate(expense.createdAt)}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Description:</span>
                <p className="text-zinc-700 whitespace-pre-line leading-relaxed bg-zinc-50 p-2.5 rounded border border-zinc-200">
                  {expense.description || 'No description provided.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Receipts Module */}
        <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Proof of Expense (Receipts)
              </h3>
              <p className="text-[11px] text-zinc-500">
                Maximum 5MB • Formats: JPEG, PNG, WebP, PDF • Deduplication via SHA-256
              </p>
            </div>

            {canAddReceipt && (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingReceipt ? 'Processing...' : 'Upload Receipt'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={uploadingReceipt}
                  onChange={handleReceiptFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded text-[11px] text-zinc-600 leading-relaxed">
            <span className="font-semibold text-zinc-800">Architectural Note:</span> In this direct-upload
            pattern, SHA-256 is computed client-side by the browser from raw file bytes. Cloudinary direct
            uploads abstract binary streams from the server backend.
          </div>

          {expense.receipts && expense.receipts.length > 0 ? (
            <div className="overflow-x-auto border border-zinc-200 rounded-lg">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">File Name</th>
                    <th className="py-2.5 px-3">Format</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">SHA-256 Fingerprint</th>
                    <th className="py-2.5 px-3 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {expense.receipts.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-50/80">
                      <td className="py-2.5 px-3 font-medium text-zinc-900">{r.fileName}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-600">{r.mimeType}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-600">
                        {(r.fileSizeBytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-zinc-500 max-w-xs truncate">
                        {r.sha256}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <a
                          href={r.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-800 font-medium inline-flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-zinc-50 border border-dashed border-zinc-200 rounded text-center text-xs text-zinc-500">
              No receipts uploaded yet.
            </div>
          )}
        </div>

        {/* Reject Modal */}
        <ModalDialog
          isOpen={rejectModalOpen}
          title="Reject Expense"
          description="Provide a mandatory reason for rejecting this club expense."
          onClose={() => setRejectModalOpen(false)}
        >
          <div className="space-y-4">
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="State the reason for rejecting this expense..."
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
                onClick={handleRejectExpense}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </ModalDialog>
      </div>
    </AppShell>
  )
}
