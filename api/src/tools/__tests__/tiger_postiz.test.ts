import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_postiz } from '../tiger_postiz.js'
import { makeContext } from './helpers.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../services/db.js', () => ({
  getTenant: vi.fn(async () => ({
    id: 'test-tenant',
    postizApiKey: 'encrypted-key-abc',
  })),
}))

vi.mock('../../services/pool.js', () => ({
  decryptToken: vi.fn(() => 'decrypted-postiz-api-key'),
}))

function mockPostizOk(body: unknown) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  })
}

function mockPostizError(status: number, message: string) {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ message }),
  })
}

describe('tiger_postiz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list_channels', () => {
    it('returns connected channels', async () => {
      mockPostizOk([
        { id: 'ch-1', name: 'Tiger LinkedIn', identifier: '@tiger', provider: 'linkedin' },
        { id: 'ch-2', name: 'Tiger X', identifier: '@tigerclaw', provider: 'twitter' },
      ])
      const ctx = makeContext()
      const result = await tiger_postiz.execute({ action: 'list_channels' }, ctx)
      expect(result.ok).toBe(true)
      expect(result.output).toContain('Tiger LinkedIn')
      expect(result.output).toContain('ch-2')
    })

    it('returns ok:true with no-channels message when none connected', async () => {
      mockPostizOk([])
      const ctx = makeContext()
      const result = await tiger_postiz.execute({ action: 'list_channels' }, ctx)
      expect(result.ok).toBe(true)
      expect(result.output).toContain('No social media channels connected')
    })
  })

  describe('schedule_post', () => {
    it('schedules a post successfully', async () => {
      mockPostizOk({ id: 'post-999' })
      const ctx = makeContext()
      const result = await tiger_postiz.execute({
        action: 'schedule_post',
        content: 'Your bot hunts while you sleep.',
        channel_ids: ['ch-1'],
        schedule_time: '2026-04-05T10:00:00Z',
      }, ctx)
      expect(result.ok).toBe(true)
      expect(result.output).toContain('post-999')
      expect(result.output).toContain('scheduled')
    })

    it('publishes immediately when no schedule_time given', async () => {
      mockPostizOk({ id: 'post-888' })
      const ctx = makeContext()
      const result = await tiger_postiz.execute({
        action: 'schedule_post',
        content: 'Live now.',
        channel_ids: ['ch-1'],
      }, ctx)
      expect(result.ok).toBe(true)
      expect(result.output).toContain('published')
    })

    it('returns ok:false when content is missing', async () => {
      const ctx = makeContext()
      const result = await tiger_postiz.execute({
        action: 'schedule_post',
        channel_ids: ['ch-1'],
      }, ctx)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('content is required')
    })

    it('returns ok:false when channel_ids is empty', async () => {
      const ctx = makeContext()
      const result = await tiger_postiz.execute({
        action: 'schedule_post',
        content: 'Some content',
        channel_ids: [],
      }, ctx)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('channel_id')
    })

    it('returns ok:false when Postiz API rejects', async () => {
      mockPostizError(422, 'Invalid channel ID')
      const ctx = makeContext()
      const result = await tiger_postiz.execute({
        action: 'schedule_post',
        content: 'Content',
        channel_ids: ['bad-id'],
      }, ctx)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Invalid channel ID')
    })
  })

  describe('get_analytics', () => {
    it('returns analytics for a channel', async () => {
      mockPostizOk({ reach: 500, engagement: 42, impressions: 1200 })
      const ctx = makeContext()
      const result = await tiger_postiz.execute({ action: 'get_analytics', channel_id: 'ch-1' }, ctx)
      expect(result.ok).toBe(true)
      expect(result.output).toContain('500')
      expect(result.output).toContain('42')
    })

    it('returns ok:false when channel_id is missing', async () => {
      const ctx = makeContext()
      const result = await tiger_postiz.execute({ action: 'get_analytics' }, ctx)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('channel_id is required')
    })
  })

  describe('error cases', () => {
    it('returns ok:false for unknown action', async () => {
      const ctx = makeContext()
      const result = await tiger_postiz.execute({ action: 'explode' as any }, ctx)
      expect(result.ok).toBe(false)
    })

    it('returns ok:false when tenant has no Postiz key configured', async () => {
      const { getTenant } = await import('../../services/db.js')
      vi.mocked(getTenant).mockResolvedValueOnce({ id: 'test-tenant', postizApiKey: null } as any)
      const ctx = makeContext()
      const result = await tiger_postiz.execute({ action: 'list_channels' }, ctx)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Postiz API key not configured')
    })
  })
})
