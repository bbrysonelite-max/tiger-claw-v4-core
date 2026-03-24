import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_move } from '../tiger_move.js'
import { makeContext, type ToolResult } from './helpers.js'

let mockLeads: Record<string, any> = {}
let mockNurture: Record<string, any> = {}
let mockContacts: Record<string, any> = {}
let mockTenantState: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  saveLeads: vi.fn(async (_tid: string, data: unknown) => { mockLeads = data as any }),
  getNurture: vi.fn(async () => mockNurture),
  saveNurture: vi.fn(async (_tid: string, data: unknown) => { mockNurture = data as any }),
  getContacts: vi.fn(async () => mockContacts),
  saveContacts: vi.fn(async (_tid: string, data: unknown) => { mockContacts = data as any }),
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
}))

// Minimal valid lead record for tiger_move tests
const makeLeadRecord = (id: string, displayName: string, manualStatus?: string) => ({
  id,
  platform: 'telegram',
  platformId: `plat-${id}`,
  displayName,
  profileFit: 60,
  intentScore: 50,
  engagement: 0,
  rawIntentStrength: 50,
  builderScore: 40,
  customerScore: 37,
  qualifyingScore: 40,
  oar: 'builder',
  primaryOar: 'builder',
  isUnicorn: false,
  unicornBonusApplied: false,
  qualified: false,
  qualifyingOar: 'builder',
  optedOut: false,
  discoveredAt: '2026-01-01T00:00:00Z',
  lastSignalAt: '2026-01-01T00:00:00Z',
  lastScoredAt: '2026-01-01T00:00:00Z',
  purgeAt: '2026-06-01T00:00:00Z',
  intentSignalHistory: [],
  engagementEvents: [],
  involvementLevel: 0,
  manualStatus,
})

describe('tiger_move', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = {
      'lead-001': makeLeadRecord('lead-001', 'Alice'),
      'lead-002': makeLeadRecord('lead-002', 'Bob', 'contacted'),
    }
    mockNurture = {}
    mockContacts = {}
    mockTenantState = {}
  })

  it('returns confirmation prompt without confirm:true', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_move.execute({ name: 'Alice', status: 'contacted' }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.awaitingConfirmation).toBe(true)
  })

  it('moves lead to new status with confirm:true', async () => {
    const ctx = makeContext()
    const result = await tiger_move.execute({ name: 'Alice', status: 'contacted', confirm: true }, ctx)

    expect(result.ok).toBe(true)
    expect(mockLeads['lead-001'].manualStatus).toBe('contacted')
  })

  it('returns ok:false for unknown contact name', async () => {
    const ctx = makeContext()
    const result = await tiger_move.execute({ name: 'Ghost Person', status: 'contacted' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok:false for invalid target status', async () => {
    const ctx = makeContext()
    const result = await tiger_move.execute({ name: 'Alice', status: 'galaxy-brain' as never }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:true when already at target status (no change)', async () => {
    const ctx = makeContext()
    const result = await tiger_move.execute({ name: 'Bob', status: 'contacted' }, ctx)

    expect(result.ok).toBe(true)
    expect((result.data as any)?.changed).toBe(false)
  })

  it('moves to nurture and persists', async () => {
    const ctx = makeContext()
    await tiger_move.execute({ name: 'Alice', status: 'nurture', confirm: true }, ctx)

    expect(mockLeads['lead-001'].manualStatus).toBe('nurture')
  })

  it('do-not-contact with confirm:true marks lead as opted out', async () => {
    const ctx = makeContext()
    await tiger_move.execute({ name: 'Alice', status: 'do-not-contact', confirm: true }, ctx)

    expect(mockLeads['lead-001'].optedOut).toBe(true)
  })

  it('returns ok:false when name is empty', async () => {
    const ctx = makeContext()
    const result = await tiger_move.execute({ name: '', status: 'contacted' }, ctx)

    expect(result.ok).toBe(false)
  })
})
