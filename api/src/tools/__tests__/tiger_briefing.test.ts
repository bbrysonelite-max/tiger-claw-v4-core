import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_briefing } from '../tiger_briefing.js'
import { makeContext, type ToolResult } from './helpers.js'

// Mutable stores
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

vi.mock('../../services/hiveEmitter.js', () => ({
  hiveAttributionLabel: vi.fn(() => 'test'),
  emitHiveEvent: vi.fn().mockResolvedValue(undefined),
}))

const COMPLETE_ONBOARD = {
  phase: 'complete',
  identity: { name: 'Brent', productOrOpportunity: 'supplements' },
  icpBuilder: { idealPerson: 'entrepreneurs' },
  icpCustomer: { idealPerson: 'parents' },
  icpSingle: {},
  flavor: 'network-marketer',
  language: 'en',
}

describe('tiger_briefing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = {}
    mockNurture = {}
    mockContacts = {}
    mockTenantState = {
      'onboard_state.json': COMPLETE_ONBOARD,
    }
  })

  it('generates a briefing with empty pipeline and returns ok:true', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_briefing.execute({ action: 'generate' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
    expect(result.output!.length).toBeGreaterThan(10)
  })

  it('generates a briefing that includes a newly qualified lead', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    mockLeads = {
      'lead-001': {
        id: 'lead-001',
        displayName: 'Alice',
        platform: 'telegram',
        qualified: true,
        qualifiedAt: new Date().toISOString(), // qualified today
        profileFit: 85,
        intentScore: 82,
        oar: 'builder',
        optedOut: false,
        intentSignalHistory: [],
      },
    }

    const ctx = makeContext()
    const result: ToolResult = await tiger_briefing.execute({ action: 'generate' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice')
  })

  it('mark_sent records the send timestamp', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockTenantState['briefing.json'] = {
      [today]: { date: today, generatedAt: new Date().toISOString(), output: 'Test briefing' },
    }

    const ctx = makeContext()
    const result = await tiger_briefing.execute({ action: 'mark_sent' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain(today)
  })

  it('history returns ok:true', async () => {
    const ctx = makeContext()
    const result = await tiger_briefing.execute({ action: 'history', limit: 3 }, ctx)

    expect(result.ok).toBe(true)
  })

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext()
    const result = await tiger_briefing.execute({ action: 'warp' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unknown action')
  })
})
