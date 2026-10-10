import { NextResponse } from 'next/server'
import { requireUser } from '@/server/lib/auth'
import { notificationService } from '@/server/services/notification.service'

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const count = await notificationService.getUnreadCount(user)
    return NextResponse.json({ count })
  } catch (error: any) {
    console.error('Failed to get unread notifications count:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
