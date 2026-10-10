const fs = require('fs')

function patchExpenseService() {
  const filePath = 'src/server/services/expense.service.ts'
  let content = fs.readFileSync(filePath, 'utf8')

  // Add import if missing
  if (!content.includes("notificationService")) {
    content = content.replace(
      "import { prisma } from '@/server/lib/prisma'",
      "import { prisma } from '@/server/lib/prisma'\nimport { notificationService } from './notification.service'"
    )
  }

  // SUBMIT
  content = content.replace(
    /afterState: \{ status: ExpenseStatus\.SUBMITTED \},\s*\}\s*\)\s*return updated/g,
    `afterState: { status: ExpenseStatus.SUBMITTED },
        }
      })

      await notificationService.notifyCoreReviewers({
        type: 'EXPENSE_SUBMITTED',
        title: 'Expense Submitted',
        message: \`Expense '\${updated.description}' for \$\${updated.amount} has been submitted and is awaiting approval.\`,
        linkUrl: \`/expenses/\${expenseId}\`,
        idempotencyKey: \`exp_sub_\${expenseId}_\${updated.updatedAt.getTime()}\`,
      }, user.id, tx)

      return updated`
  )

  // APPROVE
  content = content.replace(
    /afterState: \{ status: ExpenseStatus\.APPROVED \},\s*\},?\s*\)\s*return updated/g,
    `afterState: { status: ExpenseStatus.APPROVED },
        },
      })

      await notificationService.notifyUser(updated.createdByUserId, {
        type: 'EXPENSE_APPROVED',
        title: 'Expense Approved',
        message: \`Your expense '\${updated.description}' for \$\${updated.amount} has been approved.\`,
        linkUrl: \`/expenses/\${expenseId}\`,
        idempotencyKey: \`exp_app_\${expenseId}_\${updated.updatedAt.getTime()}\`,
      }, user.id, tx)

      return updated`
  )

  // REJECT
  content = content.replace(
    /afterState: \{ status: ExpenseStatus\.REJECTED \},\s*metadata: \{ reason \},\s*\},?\s*\)\s*return updated/g,
    `afterState: { status: ExpenseStatus.REJECTED },
          metadata: { reason },
        },
      })

      await notificationService.notifyUser(updated.createdByUserId, {
        type: 'EXPENSE_REJECTED',
        title: 'Expense Rejected',
        message: \`Your expense '\${updated.description}' for \$\${updated.amount} was rejected.\`,
        linkUrl: \`/expenses/\${expenseId}\`,
        idempotencyKey: \`exp_rej_\${expenseId}_\${updated.updatedAt.getTime()}\`,
      }, user.id, tx)

      return updated`
  )

  fs.writeFileSync(filePath, content)
}

patchExpenseService()
