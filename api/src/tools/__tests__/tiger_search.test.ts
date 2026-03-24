import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_search } from '../tiger_search.js'
import { makeContext, type ToolResult } from './helpers.js'

let mockLeads: Record<string, any> = {}
let mockNurture: Record<string, any> = {}
let mockContacts: Record<string, any> = {}
let mockTenantState: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  getNurture: vi.fn(async () => mockNurture),
  getContacts: vi.fn(async () => mockContacts),
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
}))

const makeLeadRecord = (id: string, displayName: string, extra: Record<string, unknown> = {}) => ({
  id,
  platform: 'telegram',
  platformId: `plat-${id}`,
  displayName,
  profileFit: 70,
  intentScore: 60,
  engagement: 0,
  rawIntentStrength: 60,
  builderScore: 55,
  customerScore: 50,
  qualifyingScore: 55,
  oar: 'builder',
  primaryOar: 'builder',
  isUnicorn: false,
  unicornBonusApplied: false,
  qualified: false,
  qualifyingOar: 'builder',
  optedOut: false,
  discoveredAt: '2026-01-01T00:00:00Z',
  lastSignalAt: '2026-01-01T00:00:00Z',
  intentSignalHistory: [],
  engagementEvents: [],
  involvementLevel: 0,
  tags: [],
  ...extra,
})

describe('tiger_search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = {
      'lead-001': makeLeadRecord('lead-001', 'Alice Johnson', { tags: ['vip'] }),
      'lead-002': makeLeadRecord('lead-002', 'Bob Smith'),
      'lead-003': makeLeadRecord('lead-003', 'Carol White', { tags: ['vip'] }),
    }
    mockNurture = {}
    mockContacts = {}
    mockTenantState = {}
  })

  it('returns matching leads for a name query', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_search.execute({ query: 'Alice' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice')
  })

  it('returns ok:false with empty query', async () => {
    const ctx = makeContext()
    const result = await tiger_search.execute({ query: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:true with empty results when no match', async () => {
    const ctx = makeContext()
    const result = await tiger_search.execute({ query: 'nonexistent-contact-xyz' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
    expect((result.data as any)?.total).toBe(0)
  })

  it('partial name match works across multiple leads', async () => {
    const ctx = makeContext()
    const result = await tiger_search.execute({ query: 'o' }, ctx) // matches Bob and Carol

    expect(result.ok).toBe(true)
    const total = (result.data as any)?.total
    expect(total).toBeGreaterThanOrEqual(2)
  })

  it('status filter syntax works (status:new)', async () => {
    // All test leads have no contacts or nurture, so they're 'new' by default
    const ctx = makeContext()
    const result = await tiger_search.execute({ query: 'status:new' }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.total).toBeGreaterThanOrEqual(3)
  })

  it('tag keyword matches leads with that tag', async () => {
    const ctx = makeContext()
    const result = await tiger_search.execute({ query: 'vip' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice')
    expect(result.output).toContain('Carol')
  })

  it('results limited to 10 when many leads match', async () => {
    // Seed 20 leads
    for (let i = 4; i <= 20; i++) {
      mockLeads[`lead-0${i}`] = makeLeadRecord(`lead-0${i}`, `Person ${i}`)
    }
    const ctx = makeContext()
    const result = await tiger_search.execute({ query: 'person' }, ctx)

    expect(result.ok).toBe(true)
    const showing = (result.data as any)?.showing ?? 0
    expect(showing).toBeLessThanOrEqual(10)
  })

  it('score filter syntax works (score:60+)', async () => {
    // All test leads have qualifyingScore:55, so score:60+ should match 0 leads
    const ctx = makeContext()
    const result = await tiger_search.execute({ query: 'score:60+' }, ctx)

    expect(result.ok).toBe(true)
    // No leads above 60 in this seed
    expect((result.data as any)?.total).toBe(0)
  })
})
