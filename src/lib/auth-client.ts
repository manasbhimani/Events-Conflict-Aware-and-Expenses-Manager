export type UserRoleType =
  | 'SUPER_ADMIN'
  | 'ACM_CORE'
  | 'ACM_EXEC'
  | 'CLUB_REP'
  | 'VIEWER'

export type ClientAction =
  | 'VIEW_CALENDAR'
  | 'VIEW_EVENT'
  | 'CREATE_EVENT'
  | 'UPDATE_EVENT'
  | 'SUBMIT_EVENT'
  | 'VERIFY_EVENT'
  | 'REJECT_EVENT'
  | 'CANCEL_EVENT'
  | 'ACKNOWLEDGE_CONFLICT'
  | 'RESOLVE_CONFLICT'
  | 'OVERRIDE_CONFLICT'
  | 'CREATE_EXPENSE'
  | 'UPDATE_EXPENSE'
  | 'APPROVE_EXPENSE'
  | 'REJECT_EXPENSE'
  | 'VIEW_BUDGET'
  | 'MANAGE_BUDGET'
  | 'LOCK_SEMESTER'
  | 'VIEW_ARCHIVE'
  | 'VIEW_REPORTS'
  | 'VIEW_AUDIT'

export const ROLE_PERMISSIONS: Record<UserRoleType, readonly ClientAction[]> = {
  SUPER_ADMIN: [
    'VIEW_CALENDAR',
    'VIEW_EVENT',
    'CREATE_EVENT',
    'UPDATE_EVENT',
    'SUBMIT_EVENT',
    'VERIFY_EVENT',
    'REJECT_EVENT',
    'CANCEL_EVENT',
    'ACKNOWLEDGE_CONFLICT',
    'RESOLVE_CONFLICT',
    'OVERRIDE_CONFLICT',
    'CREATE_EXPENSE',
    'UPDATE_EXPENSE',
    'APPROVE_EXPENSE',
    'REJECT_EXPENSE',
    'VIEW_BUDGET',
    'MANAGE_BUDGET',
    'LOCK_SEMESTER',
    'VIEW_ARCHIVE',
    'VIEW_REPORTS',
    'VIEW_AUDIT',
  ],
  ACM_CORE: [
    'VIEW_CALENDAR',
    'VIEW_EVENT',
    'CREATE_EVENT',
    'UPDATE_EVENT',
    'SUBMIT_EVENT',
    'VERIFY_EVENT',
    'REJECT_EVENT',
    'CANCEL_EVENT',
    'ACKNOWLEDGE_CONFLICT',
    'RESOLVE_CONFLICT',
    'OVERRIDE_CONFLICT',
    'CREATE_EXPENSE',
    'UPDATE_EXPENSE',
    'APPROVE_EXPENSE',
    'REJECT_EXPENSE',
    'VIEW_BUDGET',
    'MANAGE_BUDGET',
    'LOCK_SEMESTER',
    'VIEW_ARCHIVE',
    'VIEW_REPORTS',
    'VIEW_AUDIT',
  ],
  ACM_EXEC: [
    'VIEW_CALENDAR',
    'VIEW_EVENT',
    'CREATE_EVENT',
    'UPDATE_EVENT',
    'SUBMIT_EVENT',
    'CREATE_EXPENSE',
    'UPDATE_EXPENSE',
    'VIEW_BUDGET',
    'VIEW_ARCHIVE',
    'VIEW_REPORTS',
  ],
  CLUB_REP: [
    'VIEW_CALENDAR',
    'VIEW_EVENT',
    'CREATE_EVENT',
    'UPDATE_EVENT',
    'SUBMIT_EVENT',
    'ACKNOWLEDGE_CONFLICT',
    'CREATE_EXPENSE',
    'UPDATE_EXPENSE',
  ],
  VIEWER: [
    'VIEW_CALENDAR',
    'VIEW_EVENT',
  ],
}

export function canClient(role?: string | null, action?: ClientAction): boolean {
  if (!role || !action) return false
  const permissions = ROLE_PERMISSIONS[role as UserRoleType]
  return permissions ? permissions.includes(action) : false
}

export function canManageClubResource(
  userRole?: string | null,
  userClubId?: string | null,
  resourceClubId?: string | null
): boolean {
  if (!userRole) return false
  if (userRole === 'SUPER_ADMIN' || userRole === 'ACM_CORE') return true
  if (userRole === 'CLUB_REP' || userRole === 'ACM_EXEC') {
    return !!userClubId && !!resourceClubId && userClubId === resourceClubId
  }
  return false
}
