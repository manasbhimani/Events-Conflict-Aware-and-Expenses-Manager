import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/server/lib/prisma'
import { notificationService } from '@/server/services/notification.service'
import { NotificationType } from '@prisma/client'

describe('Phase 7 Notification Service & Transactions', () => {
  beforeEach(async () => {
    await prisma.notification.deleteMany()
    await prisma.user.deleteMany({ where: { email: { startsWith: 'notiftest' } } })
  })

  it('safely handles duplicate idempotency keys without aborting transactions', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Test Notif',
        email: 'notiftest1@example.com',
        role: 'ACM_CORE'
      }
    })

    // This creates the first one
    await prisma.$transaction(async (tx) => {
      await notificationService.notifyUser(user.id, {
        type: NotificationType.EVENT_SUBMITTED,
        title: 'Title 1',
        message: 'Message 1',
        
        idempotencyKey: 'test_key_1'
      }, undefined, tx)
    })

    // This creates a duplicate inside a transaction.
    // If it threw P2002 and wasn't handled properly by Postgres (ON CONFLICT DO NOTHING),
    // the transaction would abort and the second create would fail.
    await prisma.$transaction(async (tx) => {
      await notificationService.notifyUser(user.id, {
        type: NotificationType.EVENT_SUBMITTED,
        title: 'Title 2',
        message: 'Message 2',
        
        idempotencyKey: 'test_key_1' // duplicate key!
      }, undefined, tx)

      // This should succeed if transaction wasn't aborted
      await notificationService.notifyUser(user.id, {
        type: NotificationType.EVENT_SUBMITTED,
        title: 'Title 3',
        message: 'Message 3',
        
        idempotencyKey: 'test_key_2' // new key
      }, undefined, tx)
    })

    const notifs = await prisma.notification.findMany({ where: { userId: user.id } })
    expect(notifs.length).toBe(2)
    console.log(notifs); expect(notifs.find(n => n.idempotencyKey === 'test_key_1-' + user.id)).toBeDefined()
    expect(notifs.find(n => n.idempotencyKey === 'test_key_2-' + user.id)).toBeDefined()
  })

  it('isolates unread count and read actions per user', async () => {
    const user1 = await prisma.user.create({
      data: { name: 'User 1', email: 'notiftest2@example.com', role: 'VIEWER' }
    })
    const user2 = await prisma.user.create({
      data: { name: 'User 2', email: 'notiftest3@example.com', role: 'VIEWER' }
    })

    await notificationService.notifyUser(user1.id, {
      type: NotificationType.EVENT_CANCELLED,
      title: 'For User 1',
      message: 'msg',
      
      idempotencyKey: 'u1_1'
    })
    
    await notificationService.notifyUser(user2.id, {
      type: NotificationType.EVENT_CANCELLED,
      title: 'For User 2',
      message: 'msg',
      
      idempotencyKey: 'u2_1'
    })

    expect(await notificationService.getUnreadCount({ id: user1.id } as any)).toEqual({ count: 1 })
    expect(await notificationService.getUnreadCount({ id: user2.id } as any)).toEqual({ count: 1 })

    await notificationService.markAllAsRead({ id: user1.id } as any)

    expect(await notificationService.getUnreadCount({ id: user1.id } as any)).toEqual({ count: 0 })
    expect(await notificationService.getUnreadCount({ id: user2.id } as any)).toEqual({ count: 1 })

    // Attempting to read another user's notification should fail
    const notif2 = await prisma.notification.findFirst({ where: { userId: user2.id } })
    await expect(notificationService.markAsRead({ id: user1.id } as any, notif2!.id)).rejects.toThrow('You can only modify your own notifications')
  })
})
