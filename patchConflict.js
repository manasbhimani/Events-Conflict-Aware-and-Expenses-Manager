const fs = require('fs')

function patchConflictService() {
  const filePath = 'src/server/services/conflict.service.ts'
  let content = fs.readFileSync(filePath, 'utf8')

  // Add import if missing
  if (!content.includes("notificationService")) {
    content = content.replace(
      "import { prisma } from '@/server/lib/prisma'",
      "import { prisma } from '@/server/lib/prisma'\nimport { notificationService } from './notification.service'"
    )
  }

  // Inside detectConflicts, where we push to results
  // Find: results.push(record)
  // Replace with notification logic
  const findStr = `results.push(record)
      }`
  const replaceStr = `results.push(record)

          // Notification Logic
          const existing = existingConflicts.find(ex => 
            ex.eventAId === record.eventAId && 
            ex.eventBId === record.eventBId && 
            ex.conflictType === record.conflictType
          )
          
          if (!existing) {
             const otherEventId = record.eventAId === event.id ? record.eventBId : record.eventAId
             const otherEvent = await tx.event.findUnique({ where: { id: otherEventId }, select: { clubId: true, title: true } })
             
             await notificationService.notifyCoreReviewers({
               type: 'CONFLICT_FLAGGED',
               title: 'New Conflict Detected',
               message: \`Conflict of type '\${record.conflictType}' detected between '\${event.title}' and '\${otherEvent?.title}'.\`,
               linkUrl: \`/conflicts/\`,
               idempotencyKey: \`conflict_new_\${record.id}\`,
             }, user.id, tx)
             
             await notificationService.notifyClubRepresentatives(event.clubId, {
               type: 'CONFLICT_FLAGGED',
               title: 'New Conflict Detected',
               message: \`Conflict of type '\${record.conflictType}' detected for your event '\${event.title}'.\`,
               linkUrl: \`/conflicts/\`,
               idempotencyKey: \`conflict_new_\${record.id}_A\`,
             }, user.id, tx)

             if (otherEvent) {
               await notificationService.notifyClubRepresentatives(otherEvent.clubId, {
                 type: 'CONFLICT_FLAGGED',
                 title: 'New Conflict Detected',
                 message: \`Conflict of type '\${record.conflictType}' detected for your event '\${otherEvent.title}'.\`,
                 linkUrl: \`/conflicts/\`,
                 idempotencyKey: \`conflict_new_\${record.id}_B\`,
               }, user.id, tx)
             }
          } else if (existing.severity !== record.severity) {
             // Severity changed
             const otherEventId = record.eventAId === event.id ? record.eventBId : record.eventAId
             const otherEvent = await tx.event.findUnique({ where: { id: otherEventId }, select: { clubId: true, title: true } })
             
             await notificationService.notifyCoreReviewers({
               type: 'CONFLICT_FLAGGED',
               title: 'Conflict Severity Changed',
               message: \`Severity changed to '\${record.severity}' for conflict between '\${event.title}' and '\${otherEvent?.title}'.\`,
               linkUrl: \`/conflicts/\`,
               idempotencyKey: \`conflict_sev_\${record.id}_\${record.severity}\`,
             }, user.id, tx)
          }
      }`
  
  content = content.replace(findStr, replaceStr)

  fs.writeFileSync(filePath, content)
}

patchConflictService()
