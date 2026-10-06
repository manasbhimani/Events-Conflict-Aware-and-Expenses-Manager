import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchApi, ApiError } from '@/lib/api'

describe('Frontend API Client (fetchApi) Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves data and meta on successful 200 response', async () => {
    const mockData = [{ id: '1', title: 'Test' }]
    const mockMeta = { page: 1, limit: 10, total: 1 }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockData, meta: mockMeta }),
    } as any)

    const result = await fetchApi<typeof mockData>('/api/test')
    expect(result.data).toEqual(mockData)
    expect(result.meta).toEqual(mockMeta)
  })

  it('throws ApiError on HTTP 401 Unauthorized', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: { code: 'UNAUTHORIZED' } }),
    } as any)

    await expect(fetchApi('/api/protected')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Please log in.',
    })
  })

  it('throws ApiError on HTTP 403 Forbidden with custom error message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You cannot access another club.' },
      }),
    } as any)

    await expect(fetchApi('/api/club-resource')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You cannot access another club.',
    })
  })

  it('throws ApiError on HTTP 409 Conflict with state message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: { code: 'SEMESTER_LOCKED', message: 'Semester is locked.' },
      }),
    } as any)

    await expect(fetchApi('/api/expenses')).rejects.toMatchObject({
      status: 409,
      code: 'SEMESTER_LOCKED',
      message: 'Semester is locked.',
    })
  })

  it('throws ApiError on Network connection error with code NETWORK_ERROR', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Failed to fetch'))

    await expect(fetchApi('/api/network-down')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Network request failed. Please check your connection.',
    })
  })
})
