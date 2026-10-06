export interface ApiResponseEnvelope<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
    pages?: number
    totalPages?: number
    [key: string]: unknown
  }
}

export class ApiError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export async function fetchApi<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ data: T; meta?: ApiResponseEnvelope<T>['meta'] }> {
  const headers = new Headers(options?.headers)
  if (!headers.has('Content-Type') && options?.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers,
    })
  } catch (err: unknown) {
    throw new ApiError(
      'Network request failed. Please check your connection.',
      'NETWORK_ERROR',
      0,
      err
    )
  }

  let json: ApiResponseEnvelope<T> | null = null
  try {
    json = await res.json()
  } catch {
    // If not JSON
  }

  if (!res.ok || json?.success === false) {
    const status = res.status
    const code = json?.error?.code || `HTTP_${status}`
    let message = json?.error?.message

    if (!message) {
      if (status === 401) message = 'Please log in.'
      else if (status === 403) message = 'You do not have permission to perform this action.'
      else if (status === 404) message = 'Resource not found.'
      else if (status === 409) message = 'Conflict or resource locked.'
      else if (status >= 500) message = 'Something went wrong on the server.'
      else message = 'An unexpected error occurred.'
    }

    throw new ApiError(message, code, status, json?.error?.details)
  }

  return {
    data: json?.data as T,
    meta: json?.meta,
  }
}
