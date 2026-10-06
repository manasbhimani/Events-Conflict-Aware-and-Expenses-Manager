import React from 'react'
import { AlertCircle, CheckCircle, Info, XCircle, Loader2 } from 'lucide-react'

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-2 text-zinc-500">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

export function EmptyState({
  title = 'No items found',
  description = 'There are no records matching your criteria.',
  action,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-dashed border-zinc-300 rounded-lg">
      <Info className="w-10 h-10 text-zinc-400 mb-3" />
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function AlertBanner({
  type = 'info',
  title,
  message,
  onDismiss,
}: {
  type?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  message: string
  onDismiss?: () => void
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  }

  const icons = {
    info: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
    success: <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
  }

  return (
    <div className={`p-4 rounded-md border flex items-start gap-3 ${styles[type]}`}>
      {icons[type]}
      <div className="flex-1 text-sm">
        {title && <div className="font-semibold">{title}</div>}
        <div>{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-zinc-400 hover:text-zinc-600 font-bold ml-2 text-base leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function ModalDialog({
  isOpen,
  title,
  description,
  children,
  onClose,
}: {
  isOpen: boolean
  title: string
  description?: string
  children: React.ReactNode
  onClose: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">{title}</h3>
          {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
