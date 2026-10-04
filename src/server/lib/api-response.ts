import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/server/types'

export function successResponse<T>(
  data: T,
  status = 200,
  meta?: ApiResponse<T>['meta']
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, meta }, { status })
}

export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status }
  )
}

export function notFoundResponse(resource: string): NextResponse<ApiResponse<never>> {
  return errorResponse('NOT_FOUND', `${resource} not found`, 404)
}

export function unauthorizedResponse(): NextResponse<ApiResponse<never>> {
  return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
}

export function forbiddenResponse(): NextResponse<ApiResponse<never>> {
  return errorResponse('FORBIDDEN', 'Insufficient permissions', 403)
}

export function validationErrorResponse(details: unknown): NextResponse<ApiResponse<never>> {
  return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422, details)
}
