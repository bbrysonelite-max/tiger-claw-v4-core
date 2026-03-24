import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_keys } from '../tiger_keys.js'
import { makeContext, type ToolResult } from './helpers.js'

let mockBotStates: Record<string, any> = {}

vi.mock('../../services/db.js', () => ({
  getBotState: vi.fn(async (_workdir: string, file: string) => mockBotStates[file] ?? null),
  setBotState: vi.fn(async (_workdir: string, file: string, data: unknown) => {
    mockBotStates[file] = data
  }),
  getTenant: vi.fn(async () => ({
    id: 'test-tenant',
    slug: 'test-slug',
    layer1_api_key: null,
    layer2_api_key: null,
    layer3_api_key: null,
    layer4_api_key: null,
  })),
  getPool: vi.fn(() => ({ query: vi.fn().mockResolvedValue({ rows: [] }) })),
}))

vi.mock('../../services/email.js', () => ({
  sendKeyAbuseWarning: vi.fn().mockResolvedValue(undefined),
}))

describe('tiger_keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBotStates = {}
    // notifyAdmin requires INTERNAL_API_URL; connection will fail fast (ECONNREFUSED) which is fine
    process.env['INTERNAL_API_URL'] = 'http://127.0.0.1:19999'
  })

  it('status returns ok:true with default state when storage is empty', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_keys.execute({ action: 'status' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
  })

  it('status shows layer info from stored key_state', async () => {
    mockBotStates['key_state.json'] = {
      activeLayer: 1,
      layer1MessageCountToday: 5,
      layer1CountDate: new Date().toISOString().slice(0, 10),
      layer1BurstCount: 2,
      layer1BurstWindowStart: new Date().toISOString(),
      layer3MessageCountToday: 0,
      layer3CountDate: '',
      layer4TotalMessages: 0,
      tenantPaused: false,
      events: [],
      lastUpdated: new Date().toISOString(),
    }
    const ctx = makeContext()
    const result = await tiger_keys.execute({ action: 'status' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
  })

  it('report_error for rate_limited decides wait action', async () => {
    const ctx = makeContext()
    const result = await tiger_keys.execute({
      action: 'report_error',
      httpStatus: 429,
      isTimeout: false,
      toolName: 'tiger_scout',
    }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.decision).toBe('wait')
  })

  it('report_error for invalid key (401) decides rotate', async () => {
    const ctx = makeContext()
    const result = await tiger_keys.execute({
      action: 'report_error',
      httpStatus: 401,
      isTimeout: false,
      toolName: 'tiger_scout',
    }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.decision).toBe('rotate')
  })

  it('rotate action returns ok:true', async () => {
    const ctx = makeContext()
    const result = await tiger_keys.execute({ action: 'rotate' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('restore_key with invalid layer returns ok:false', async () => {
    const ctx = makeContext()
    // layer must be 2 or 3 — passing nothing is invalid
    const result = await tiger_keys.execute({ action: 'restore_key' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Layer')
  })

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext()
    const result = await tiger_keys.execute({ action: 'warp-key' as never }, ctx)

    expect(result.ok).toBe(false)
  })

  it('tenantPaused state causes report_error to return no_action', async () => {
    mockBotStates['key_state.json'] = {
      activeLayer: 1,
      tenantPaused: true,
      layer1MessageCountToday: 0,
      layer1CountDate: '',
      layer1BurstCount: 0,
      layer1BurstWindowStart: new Date().toISOString(),
      layer3MessageCountToday: 0,
      layer3CountDate: '',
      layer4TotalMessages: 0,
      events: [],
      lastUpdated: new Date().toISOString(),
    }
    const ctx = makeContext()
    const result = await tiger_keys.execute({
      action: 'report_error',
      httpStatus: 429,
      isTimeout: false,
      toolName: 'tiger_scout',
    }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.decision).toBe('no_action')
  })
})
