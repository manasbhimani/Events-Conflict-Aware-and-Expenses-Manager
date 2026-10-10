import { NextResponse } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { notificationService } from '@/server/services/notification.service'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notification = await notificationService.markAsRead(user, id)

    return NextResponse.json(notification)
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Failed to mark notification as read:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
