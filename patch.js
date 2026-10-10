const fs = require('fs')

function patchEventService() {
  const filePath = 'src/server/services/event.service.ts'
  let content = fs.readFileSync(filePath, 'utf8')

  content = content.replace(
    /metadata: \{ note: 'Event submitted for verification' \},\s*\},?\s*\)\s*return updated/g,
    `metadata: { note: 'Event submitted for verification' },
          },
        })

        await notificationService.notifyCoreReviewers({
          type: 'EVENT_SUBMITTED',
          title: 'Event Submitted',
          message: \`Event '\${updated.title}' has been submitted and is awaiting verification.\`,
          linkUrl: \`/events/\${eventId}\`,
          idempotencyKey: \`evt_sub_\${eventId}_\${updated.updatedAt.getTime()}\`,
        }, user.id, tx)

        return updated`
  )

  content = content.replace(
    /metadata: \{ comment: comment \?\? 'Event verified by ACM Core' \},\s*\},?\s*\)\s*return updated/g,
    `metadata: { comment: comment ?? 'Event verified by ACM Core' },
          },
        })

        await notificationService.notifyUser(updated.createdByUserId, {
          type: 'EVENT_VERIFIED',
          title: 'Event Verified',
          message: \`Your event '\${updated.title}' has been verified by ACM Core.\`,
          linkUrl: \`/events/\${eventId}\`,
          idempotencyKey: \`evt_ver_\${eventId}_\${updated.updatedAt.getTime()}\`,
        }, user.id, tx)
        
        await notificationService.notifyClubRepresentatives(updated.clubId, {
          type: 'EVENT_VERIFIED',
          title: 'Event Verified',
          message: \`Event '\${updated.title}' has been verified by ACM Core.\`,
          linkUrl: \`/events/\${eventId}\`,
          idempotencyKey: \`evt_ver_club_\${eventId}_\${updated.updatedAt.getTime()}\`,
        }, user.id, tx)

        return updated`
  )

  // We need to distinguish REJECTED from CANCELLED since both use `metadata: { reason }`.
  // I can look for `afterState: { status: EventStatus.REJECTED },` vs `afterState: { status: EventStatus.CANCELLED },`.

  content = content.replace(
    /afterState: \{ status: EventStatus\.REJECTED \},\s*metadata: \{ reason \},\s*\},?\s*\)\s*return updated/g,
    `afterState: { status: EventStatus.REJECTED },
            metadata: { reason },
          },
        })

        await notificationService.notifyUser(updated.createdByUserId, {
          type: 'EVENT_REJECTED',
          title: 'Event Rejected',
          message: \`Your event '\${updated.title}' was rejected.\`,
          linkUrl: \`/events/\${eventId}\`,
          idempotencyKey: \`evt_rej_\${eventId}_\${updated.updatedAt.getTime()}\`,
        }, user.id, tx)
        
        await notificationService.notifyClubRepresentatives(updated.clubId, {
          type: 'EVENT_REJECTED',
          title: 'Event Rejected',
          message: \`Event '\${updated.title}' was rejected.\`,
          linkUrl: \`/events/\${eventId}\`,
          idempotencyKey: \`evt_rej_club_\${eventId}_\${updated.updatedAt.getTime()}\`,
        }, user.id, tx)

        return updated`
  )

  content = content.replace(
    /afterState: \{ status: EventStatus\.CANCELLED \},\s*metadata: \{ reason \},\s*\},?\s*\)\s*return updated/g,
    `afterState: { status: EventStatus.CANCELLED },
            metadata: { reason },
          },
        })

        await notificationService.notifyUser(updated.createdByUserId, {
          type: 'EVENT_CANCELLED',
          title: 'Event Cancelled',
          message: \`Event '\${updated.title}' has been cancelled.\`,
          linkUrl: \`/events/\${eventId}\`,
          idempotencyKey: \`evt_can_\${eventId}_\${updated.updatedAt.getTime()}\`,
        }, user.id, tx)
        
        await notificationService.notifyClubRepresentatives(updated.clubId, {
          type: 'EVENT_CANCELLED',
          title: 'Event Cancelled',
          message: \`Event '\${updated.title}' has been cancelled.\`,
          linkUrl: \`/events/\${eventId}\`,
          idempotencyKey: \`evt_can_club_\${eventId}_\${updated.updatedAt.getTime()}\`,
        }, user.id, tx)

        return updated`
  )

  fs.writeFileSync(filePath, content)
}

patchEventService()
