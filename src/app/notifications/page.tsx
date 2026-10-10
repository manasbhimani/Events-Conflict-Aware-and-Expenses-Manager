'use client'

import React, { useEffect, useState } from 'react'
import { Bell, Check, ExternalLink, Calendar, Receipt, AlertTriangle } from 'lucide-react'
import Link from 'next/link'


type Notification = {
  id: string
  type: string
  title: string
  message: string
  linkUrl: string | null
  readAt: string | null
  createdAt: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      if (data.data) {
        setNotifications(data.data)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    } catch (error) {
      console.error(error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'PATCH' })
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
    } catch (error) {
      console.error(error)
    }
  }

  const getIconForType = (type: string) => {
    if (type.startsWith('EVENT')) return <Calendar className="w-5 h-5 text-indigo-400" />
    if (type.startsWith('EXPENSE')) return <Receipt className="w-5 h-5 text-emerald-400" />
    if (type.startsWith('CONFLICT')) return <AlertTriangle className="w-5 h-5 text-amber-400" />
    return <Bell className="w-5 h-5 text-zinc-400" />
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Notifications</h1>
          <p className="text-zinc-400">View and manage your alerts</p>
        </div>
        <button
          onClick={markAllAsRead}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors text-sm font-medium"
        >
          <Check className="w-4 h-4" />
          Mark all as read
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-400">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <Bell className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-1">No notifications yet</h3>
          <p className="text-zinc-400">You're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-lg border flex gap-4 \${
                n.readAt ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-800/80 border-indigo-500/30 shadow-lg shadow-indigo-500/10'
              }`}
            >
              <div className="pt-1">
                {getIconForType(n.type)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h3 className={`font-semibold \${n.readAt ? 'text-zinc-300' : 'text-white'}`}>
                    {n.title}
                  </h3>
                  <span className="text-xs text-zinc-500">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-zinc-400 mt-1 whitespace-pre-line">{n.message}</p>
                
                <div className="mt-4 flex items-center gap-4">
                  {n.linkUrl && (
                    <Link
                      href={n.linkUrl}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      View Details
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}
                  {!n.readAt && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
