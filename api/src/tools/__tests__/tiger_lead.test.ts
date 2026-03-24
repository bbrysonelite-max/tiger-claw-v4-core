import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_lead } from '../tiger_lead.js'
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

const ALICE_LEAD = {
  id: 'lead-001',
  platform: 'telegram',
  platformId: 'alice123',
  displayName: 'Alice Johnson',
  profileFit: 75,
  intentScore: 80,
  engagement: 50,
  rawIntentStrength: 80,
  builderScore: 70,
  customerScore: 68,
  qualifyingScore: 80,
  qualifyingOar: 'builder',
  oar: 'builder',
  primaryOar: 'builder',
  isUnicorn: false,
  unicornBonusApplied: false,
  qualified: true,
  qualifiedAt: '2026-03-01T00:00:00Z',
  optedOut: false,
  discoveredAt: '2026-02-01T00:00:00Z',
  lastSignalAt: '2026-03-01T00:00:00Z',
  lastScoredAt: '2026-03-01T00:00:00Z',
  purgeAt: '2026-06-01T00:00:00Z',
  intentSignalHistory: [],
  engagementEvents: [],
  involvementLevel: 1,
}

describe('tiger_lead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = { 'lead-001': { ...ALICE_LEAD } }
    mockNurture = {}
    mockContacts = {}
    mockTenantState = {}
  })

  it('returns detail view when contact is found by name', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_lead.execute({ name: 'Alice' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice Johnson')
  })

  it('returns ok:false when name param is empty', async () => {
    const ctx = makeContext()
    const result = await tiger_lead.execute({ name: '' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok:true with found:false when contact not in leads', async () => {
    const ctx = makeContext()
    const result = await tiger_lead.execute({ name: 'Nonexistent Person' }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.found).toBe(false)
  })

  it('includes score breakdown in output', async () => {
    const ctx = makeContext()
    const result = await tiger_lead.execute({ name: 'Alice' }, ctx)

    expect(result.output).toContain('75') // profileFit value
  })

  it('returns data with leadId when found', async () => {
    const ctx = makeContext()
    const result = await tiger_lead.execute({ name: 'Alice Johnson' }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.leadId).toBe('lead-001')
  })

  it('partial name match works (case insensitive)', async () => {
    const ctx = makeContext()
    const result = await tiger_lead.execute({ name: 'johnson' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice Johnson')
  })

  it('returns disambiguation when multiple leads match the name', async () => {
    mockLeads = {
      'lead-001': { ...ALICE_LEAD },
      'lead-002': { ...ALICE_LEAD, id: 'lead-002', displayName: 'Alice Smith' },
    }
    const ctx = makeContext()
    const result = await tiger_lead.execute({ name: 'alice' }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.ambiguous).toBe(true)
  })

  it('shows do-not-contact status for opted-out lead', async () => {
    mockLeads = { 'lead-001': { ...ALICE_LEAD, optedOut: true } }
    const ctx = makeContext()
    const result = await tiger_lead.execute({ name: 'Alice' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('do-not-contact')
  })
})
