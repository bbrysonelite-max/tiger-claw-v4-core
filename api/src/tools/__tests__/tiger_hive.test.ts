import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_hive } from '../tiger_hive.js'
import { makeContext, type ToolResult } from './helpers.js'

let mockLeads: Record<string, any> = {}
let mockNurture: Record<string, any> = {}
let mockContacts: Record<string, any> = {}
let mockTenantState: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  saveLeads: vi.fn(),
  getNurture: vi.fn(async () => mockNurture),
  saveNurture: vi.fn(),
  getContacts: vi.fn(async () => mockContacts),
  saveContacts: vi.fn(),
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
  saveTenantState: vi.fn(async (_tid: string, file: string, data: unknown) => {
    mockTenantState[file] = data
  }),
}))

vi.mock('../../services/db.js', () => ({
  getPool: vi.fn(() => ({ query: vi.fn().mockResolvedValue({ rows: [] }) })),
  getHiveSignalWithFallback: vi.fn().mockRejectedValue(new Error('no db in test')),
}))

describe('tiger_hive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = {}
    mockNurture = {}
    mockContacts = {}
    mockTenantState = {}
    // INTERNAL_API_URL is required by query/submit; it will fail to connect
    // but the tool handles gracefully (returns ok:true from cache)
    process.env['INTERNAL_API_URL'] = 'http://127.0.0.1:19999'
    process.env['TIGER_CLAW_API_URL'] = 'http://127.0.0.1:19999'
  })

  it('list action returns ok:true with empty cache', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_hive.execute({ action: 'list' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('generate action returns ok:true even with empty leads', async () => {
    const ctx = makeContext()
    const result = await tiger_hive.execute({ action: 'generate' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('generate detects patterns when leads are present', async () => {
    mockLeads = {
      'lead-001': {
        id: 'lead-001', platform: 'telegram', displayName: 'Alice',
        oar: 'builder', qualified: true, qualifyingScore: 85,
        profileFit: 80, intentScore: 75, engagement: 60,
        builderScore: 75, customerScore: 60,
        intentSignalHistory: [{ type: 'income_complaint', strength: 70, detectedAt: new Date().toISOString() }],
        optedOut: false, discoveredAt: new Date().toISOString(),
      },
    }
    const ctx = makeContext()
    const result = await tiger_hive.execute({ action: 'generate' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.data).toBeTruthy()
  })

  it('query action returns ok:true (falls back to empty cache on unreachable API)', async () => {
    const ctx = makeContext()
    const result = await tiger_hive.execute({ action: 'query' }, ctx)

    // Tool falls back to local cache when API is unreachable
    expect(result.ok).toBe(true)
  }, 10000) // Allow up to 10s for connection timeout

  it('submit action saves locally and returns ok:true even when API unreachable', async () => {
    const ctx = makeContext()
    const result = await tiger_hive.execute({
      action: 'submit',
      category: 'icp',
      observation: 'Leads with a side hustle interest convert at 2x the baseline rate',
      dataPoints: 10,
      confidence: 0.85,
    }, ctx)

    // Saves locally even if API unreachable
    expect(result.ok).toBe(true)
  }, 10000)

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext()
    const result = await tiger_hive.execute({ action: 'delete' as never }, ctx)

    expect(result.ok).toBe(false)
  })

  it('list shows submitted patterns that were saved locally', async () => {
    const ctx = makeContext()
    // Submit first (saves to local cache)
    await tiger_hive.execute({
      action: 'submit',
      category: 'icp',
      observation: 'Local pattern for testing — no names or PII included',
      dataPoints: 5,
      confidence: 0.7,
    }, ctx)

    // Then list should include it
    const result = await tiger_hive.execute({ action: 'list' }, ctx)
    expect(result.ok).toBe(true)
    expect((result.data as any)?.submitted).toBeGreaterThanOrEqual(1)
  }, 10000)
})
