import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError, UnauthorizedError, ForbiddenError, NotFoundError, BusinessRuleError, ValidationError } from '@/server/lib/errors'
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

export function unauthorizedResponse(message = 'Authentication required'): NextResponse<ApiResponse<never>> {
  return errorResponse('UNAUTHORIZED', message, 401)
}

export function forbiddenResponse(message = 'Insufficient permissions'): NextResponse<ApiResponse<never>> {
  return errorResponse('FORBIDDEN', message, 403)
}

export function validationErrorResponse(details: unknown, message = 'Invalid request data'): NextResponse<ApiResponse<never>> {
  return errorResponse('VALIDATION_ERROR', message, 400, details)
}

/**
 * Standard error handler for API route handlers.
 * Catches domain errors, Zod errors, and maps to uniform HTTP JSON responses.
 */
export function handleApiError(error: unknown): NextResponse<ApiResponse<never>> {
  if (error instanceof ZodError) {
    return errorResponse(
      'VALIDATION_ERROR',
      error.issues[0]?.message ?? 'Invalid request data',
      400,
      error.format()
    )
  }

  if (error instanceof ValidationError) {
    return errorResponse('VALIDATION_ERROR', error.message, 400, error.details)
  }

  if (error instanceof UnauthorizedError) {
    return unauthorizedResponse(error.message)
  }

  if (error instanceof ForbiddenError) {
    return forbiddenResponse(error.message)
  }

  if (error instanceof NotFoundError) {
    return notFoundResponse(error.message)
  }

  if (error instanceof BusinessRuleError) {
    return errorResponse('INVALID_STATE_TRANSITION', error.message, 400)
  }

  if (error instanceof AppError) {
    return errorResponse(error.code, error.message, error.statusCode)
  }

  console.error('Unhandled API Error:', error)
  return errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred', 500)
}
