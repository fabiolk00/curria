import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

// Use vi.hoisted to create mock at module scope
const { mockRpcFn, mockCleanupImportJobs, mockCleanupPdfImportJobs, mockDeleteLt } = vi.hoisted(() => ({
  mockRpcFn: vi.fn(),
  mockCleanupImportJobs: vi.fn(),
  mockCleanupPdfImportJobs: vi.fn(),
  mockDeleteLt: vi.fn(),
}))

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: () => ({
    rpc: mockRpcFn,
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        lt: mockDeleteLt,
      })),
    })),
  }),
}))

vi.mock('@/lib/linkedin/import-jobs', () => ({
  cleanupOldImportJobs: mockCleanupImportJobs,
}))

vi.mock('@/lib/profile/pdf-import-jobs', () => ({
  cleanupOldPdfImportJobs: mockCleanupPdfImportJobs,
}))

describe('GET /api/cron/cleanup', () => {
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-123'
    vi.clearAllMocks()
    mockCleanupImportJobs.mockResolvedValue(0)
    mockCleanupPdfImportJobs.mockResolvedValue(0)
    mockDeleteLt.mockResolvedValue({ count: 0, error: null })
  })

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret
  })

  describe('Authentication', () => {
    it('rejects requests without Authorization header', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/cleanup')
      const res = await GET(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('rejects requests with incorrect CRON_SECRET', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        headers: {
          authorization: 'Bearer wrong-secret',
        },
      })
      const res = await GET(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('accepts requests with correct CRON_SECRET', async () => {
      mockRpcFn.mockResolvedValueOnce({
        data: [{ deleted_count: 0 }],
        error: null,
      })

      const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        headers: {
          authorization: 'Bearer test-secret-123',
        },
      })
      const res = await GET(req)

      expect(res.status).toBe(200)
    })
  })

  describe('Successful cleanup', () => {
    it('returns deleted count from RPC response', async () => {
      mockRpcFn.mockResolvedValueOnce({
        data: [{ deleted_count: 1500 }],
        error: null,
      })

      const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        headers: {
          authorization: 'Bearer test-secret-123',
        },
      })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.processedEvents).toBe(1500)
      expect(body.linkedInJobs).toBe(0)
      expect(body.pdfImportJobs).toBe(0)
    })

    it('returns 0 when no records are deleted', async () => {
      mockRpcFn.mockResolvedValueOnce({
        data: [{ deleted_count: 0 }],
        error: null,
      })

      const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        headers: {
          authorization: 'Bearer test-secret-123',
        },
      })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.processedEvents).toBe(0)
      expect(body.linkedInJobs).toBe(0)
      expect(body.pdfImportJobs).toBe(0)
    })

    it('handles gracefully when deleted_count is missing', async () => {
      mockRpcFn.mockResolvedValueOnce({
        data: [{}], // Missing deleted_count
        error: null,
      })

      const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        headers: {
          authorization: 'Bearer test-secret-123',
        },
      })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.processedEvents).toBe(0)
      expect(body.linkedInJobs).toBe(0)
      expect(body.pdfImportJobs).toBe(0)
    })
  })

  describe('Error handling', () => {
    it('returns 500 when RPC call fails', async () => {
      mockRpcFn.mockResolvedValueOnce({
        data: null,
        error: new Error('Function cleanup_old_processed_events does not exist'),
      })
      mockDeleteLt.mockResolvedValueOnce({
        count: 0,
        error: new Error('fallback delete failed'),
      })

      const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        headers: {
          authorization: 'Bearer test-secret-123',
        },
      })
      const res = await GET(req)

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBeDefined()
    })

    it('falls back to direct processed_events cleanup when the RPC is missing from schema cache', async () => {
      mockRpcFn.mockResolvedValueOnce({
        data: null,
        error: new Error('Could not find the function public.cleanup_old_processed_events(p_days_old) in the schema cache'),
      })
      mockDeleteLt.mockResolvedValueOnce({
        count: 12,
        error: null,
      })

      const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        headers: {
          authorization: 'Bearer test-secret-123',
        },
      })
      const res = await GET(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.processedEvents).toBe(12)
      expect(mockDeleteLt).toHaveBeenCalledWith('created_at', expect.any(String))
    })

    it('calls RPC with correct function name and parameters', async () => {
      mockRpcFn.mockResolvedValueOnce({
        data: [{ deleted_count: 100 }],
        error: null,
      })

      const req = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        headers: {
          authorization: 'Bearer test-secret-123',
        },
      })
      await GET(req)

      expect(mockRpcFn).toHaveBeenCalledWith('cleanup_old_processed_events', {
        p_days_old: 30,
      })
    })
  })
})
