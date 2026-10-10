import { NextResponse } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { notificationService } from '@/server/services/notification.service'

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const notifications = await notificationService.getUserNotifications(user, page, limit)
    return NextResponse.json({
      data: notifications,
      meta: { page, limit },
    })
  } catch (error: any) {
    console.error('Failed to get notifications:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await notificationService.markAllAsRead(user)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to mark all notifications as read:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
