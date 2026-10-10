import { NotificationType, Prisma } from '@prisma/client'
import prisma from '@/server/lib/prisma'
import { SessionUser } from '@/server/types'
import { NotFoundError, ForbiddenError } from '@/server/lib/errors'

export type CreateNotificationInput = {
  userId: string
  type: NotificationType
  title: string
  message: string
  linkUrl?: string
  payload?: any
  idempotencyKey?: string
}

export class NotificationService {
  /**
   * Creates a notification, optionally within an existing transaction.
   * If an idempotencyKey is provided and a notification with that key already exists,
   * it gracefully catches the unique constraint violation and returns the existing one (or null)
   * to prevent duplicate notifications.
   */
  async createNotification(
    input: CreateNotificationInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma

    try {
      return await db.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          linkUrl: input.linkUrl,
          payload: input.payload || Prisma.JsonNull,
          idempotencyKey: input.idempotencyKey,
        },
      })
    } catch (error: any) {
      if (error.code === 'P2002' && input.idempotencyKey) {
        // Unique constraint failed on idempotencyKey. 
        // This means the notification was already created.
        return null
      }
      throw error
    }
  }

  async getUserNotifications(user: SessionUser, page = 1, limit = 20, unreadOnly = false) {
    const skip = (page - 1) * limit
    
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ])

    return {
      items,
      total,
      pages: Math.ceil(total / limit),
      page,
      limit,
    }
  }

  async getUnreadCount(user: SessionUser) {
    const count = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    })
    return { count }
  }

  async markAsRead(user: SessionUser, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      throw new NotFoundError('Notification not found')
    }

    if (notification.userId !== user.id) {
      throw new ForbiddenError('You can only modify your own notifications')
    }

    return await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
  }

  async notifyCoreReviewers(
    input: Omit<CreateNotificationInput, 'userId'>,
    actorId?: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma
    const coreUsers = await db.user.findMany({
      where: {
        role: { in: ['ACM_CORE', 'SUPER_ADMIN'] },
        isActive: true,
      },
      select: { id: true },
    })

    const promises = coreUsers
      .filter((user) => user.id !== actorId)
      .map((user) =>
        this.createNotification(
          {
            ...input,
            userId: user.id,
            idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}-${user.id}` : undefined,
          },
          tx
        )
      )

    await Promise.all(promises)
  }

  async notifyClubRepresentatives(
    clubId: string,
    input: Omit<CreateNotificationInput, 'userId'>,
    actorId?: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma
    const clubUsers = await db.user.findMany({
      where: {
        clubId,
        role: 'CLUB_REP',
        isActive: true,
      },
      select: { id: true },
    })

    const promises = clubUsers
      .filter((user) => user.id !== actorId)
      .map((user) =>
        this.createNotification(
          {
            ...input,
            userId: user.id,
            idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}-${user.id}` : undefined,
          },
          tx
        )
      )

    await Promise.all(promises)
  }

  async notifyUser(
    userId: string,
    input: Omit<CreateNotificationInput, 'userId'>,
    actorId?: string,
    tx?: Prisma.TransactionClient
  ) {
    if (userId === actorId) return null

    return this.createNotification(
      {
        ...input,
        userId,
        idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}-${userId}` : undefined,
      },
      tx
    )
  }

  async markAllAsRead(user: SessionUser) {
    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
    return { count: result.count }
  }
}

export const notificationService = new NotificationService()
