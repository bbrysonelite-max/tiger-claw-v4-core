import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_aftercare } from '../tiger_aftercare.js'
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
  saveTenantState: vi.fn(async (_tid: string, file: string, data: unknown) => {
    mockTenantState[file] = data
  }),
}))

const COMPLETE_ONBOARD = {
  phase: 'complete',
  identity: { name: 'Brent', productOrOpportunity: 'supplements' },
  icpProspect: { idealPerson: 'entrepreneurs' },
  icpProduct: { idealPerson: 'parents' },
  icpSingle: {},
  flavor: 'network-marketer',
  language: 'en',
}

const ALICE_LEAD = {
  id: 'lead-001',
  displayName: 'Alice Johnson',
  platform: 'telegram',
}

describe('tiger_aftercare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = { 'lead-001': ALICE_LEAD }
    mockNurture = {}
    mockContacts = {}
    mockTenantState = {
      'onboard_state.json': COMPLETE_ONBOARD,
    }
  })

  it('enrolls a lead in aftercare and returns ok:true', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_aftercare.execute({
      action: 'enroll',
      leadId: 'lead-001',
      oar: 'customer',
    }, ctx)

    expect(result.ok).toBe(true)
  })

  it('persists aftercare record to storage after enroll', async () => {
    const ctx = makeContext()
    await tiger_aftercare.execute({
      action: 'enroll',
      leadId: 'lead-001',
      oar: 'customer',
    }, ctx)

    const saved = mockTenantState['aftercare.json']
    expect(saved).toBeTruthy()
    const records = Object.values(saved)
    expect(records.length).toBe(1)
    expect((records[0] as any).leadId).toBe('lead-001')
  })

  it('returns ok:false for unknown leadId', async () => {
    const ctx = makeContext()
    const result = await tiger_aftercare.execute({
      action: 'enroll',
      leadId: 'ghost-lead',
      oar: 'customer',
    }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when onboarding is not complete', async () => {
    mockTenantState['onboard_state.json'] = { phase: 'identity' }
    const ctx = makeContext()
    const result = await tiger_aftercare.execute({
      action: 'enroll',
      leadId: 'lead-001',
      oar: 'customer',
    }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Onboarding')
  })

  it('list action returns ok:true even with empty aftercare store', async () => {
    const ctx = makeContext()
    const result = await tiger_aftercare.execute({ action: 'list' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('check action returns ok:true', async () => {
    const ctx = makeContext()
    const result = await tiger_aftercare.execute({ action: 'check' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext()
    const result = await tiger_aftercare.execute({ action: 'quantum-touch' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('enrolling builder track creates builder aftercare record', async () => {
    const ctx = makeContext()
    await tiger_aftercare.execute({
      action: 'enroll',
      leadId: 'lead-001',
      oar: 'builder',
    }, ctx)

    const saved = mockTenantState['aftercare.json']
    const record = Object.values(saved)[0] as any
    expect(record.oar).toBe('builder')
  })
})
