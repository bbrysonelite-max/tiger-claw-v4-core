import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_keys } from '../tiger_keys.js'
import { makeContext, type Storage, type ToolResult } from './helpers.js'

// tiger_keys validates and activates Google API keys via Gemini probe
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('tiger_keys', () => {
  let storage: Storage

  beforeEach(() => {
    vi.resetAllMocks()
    storage = new Map()
    process.env['ENCRYPTION_KEY'] = 'a'.repeat(32)
  })

  it('validates a good key, stores encrypted, returns ok:true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
    const ctx = makeContext(storage)

    const result: ToolResult = await tiger_keys.execute({ apiKey: 'AIza-good-key', action: 'activate' }, ctx)

    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('stores the key in encrypted form (not plaintext)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
    const ctx = makeContext(storage)

    await tiger_keys.execute({ apiKey: 'AIza-plaintext', action: 'activate' }, ctx)

    // Find any storage entry that might hold the key
    for (const [, val] of storage.entries()) {
      const str = typeof val === 'string' ? val : JSON.stringify(val)
      expect(str).not.toContain('AIza-plaintext')
    }
  })

  it('returns ok:false for an invalid key (403 from Gemini)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    const ctx = makeContext(storage)

    const result = await tiger_keys.execute({ apiKey: 'AIza-bad', action: 'activate' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok:false for a 401 response (expired key)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const ctx = makeContext(storage)

    const result = await tiger_keys.execute({ apiKey: 'AIza-expired', action: 'activate' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns current key status when action is "status"', async () => {
    storage.set('key_state', { layer: 'byok', valid: true, activatedAt: '2026-01-01' })
    const ctx = makeContext(storage)

    const result = await tiger_keys.execute({ action: 'status' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('byok')
  })

  it('returns "no key configured" status when storage is empty', async () => {
    const ctx = makeContext(storage) // empty storage

    const result = await tiger_keys.execute({ action: 'status' }, ctx)

    expect(result.ok).toBe(true)
    // Should indicate no key, not crash
    expect(result.output).toBeTruthy()
  })

  it('deactivates a key when action is "deactivate"', async () => {
    storage.set('key_state', { layer: 'byok', valid: true })
    const ctx = makeContext(storage)

    const result = await tiger_keys.execute({ action: 'deactivate' }, ctx)

    expect(result.ok).toBe(true)
    const state = storage.get('key_state') as Record<string, unknown>
    expect(state?.['valid']).toBe(false)
  })

  it('returns ok:false when apiKey is empty and action is activate', async () => {
    const ctx = makeContext(storage)

    const result = await tiger_keys.execute({ apiKey: '', action: 'activate' }, ctx)

    expect(result.ok).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns ok:false when action is unknown', async () => {
    const ctx = makeContext(storage)

    const result = await tiger_keys.execute({ action: 'warp-key' as never }, ctx)

    expect(result.ok).toBe(false)
  })

  it('handles network failure from Gemini probe gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const ctx = makeContext(storage)

    const result = await tiger_keys.execute({ apiKey: 'AIza-test', action: 'activate' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
