import React from 'react'
import { auth } from '@/server/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { EventForm } from '@/components/events/EventForm'
import { canClient } from '@/lib/auth-client'

export default async function NewEventPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  if (!canClient(session.user.role, 'CREATE_EVENT')) {
    redirect('/events')
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Create New Event</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Initiate a new event proposal in DRAFT state. You can submit it for review once ready.
          </p>
        </div>

        <EventForm />
      </div>
    </AppShell>
  )
}
