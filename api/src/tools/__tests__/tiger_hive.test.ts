import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_hive } from '../tiger_hive.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

vi.mock('../../services/db.js', () => ({
  getPool: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({ rows: [{ count: '0' }] })
  }))
}))

// tiger_hive shares or reads cross-tenant data via the hive pattern
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.resetAllMocks()
  process.env['TIGER_CLAW_API_URL'] = 'http://localhost:4000'
})

describe.skip('tiger_hive', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new Map()
  })

  it('reads a hive key and returns ok:true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: 'shared-intel', updatedAt: '2026-03-01' }),
    })
    const ctx = makeContext(storage)
    const result: ToolResult = await tiger_hive.execute({ action: 'read', key: 'market-intel' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('shared-intel')
  })

  it('writes a value to a hive key and returns ok:true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    const ctx = makeContext(storage)
    const result = await tiger_hive.execute({
      action: 'write',
      key: 'market-intel',
      value: 'new-data',
    }, ctx)

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/hive/market-intel'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns ok:false when read returns 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const ctx = makeContext(storage)
    const result = await tiger_hive.execute({ action: 'read', key: 'missing-key' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_hive.execute({ action: 'delete' as never, key: 'some-key' }, ctx)

    expect(result.ok).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns ok:false when key is empty', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_hive.execute({ action: 'read', key: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when write action has no value', async () => {
    const ctx = makeContext(storage)
    const result = await tiger_hive.execute({ action: 'write', key: 'some-key' }, ctx)

    expect(result.ok).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns ok:false when API call throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const ctx = makeContext(storage)
    const result = await tiger_hive.execute({ action: 'read', key: 'market-intel' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
