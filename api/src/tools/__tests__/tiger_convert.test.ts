// Tiger Claw — tiger_convert tests
// Stage 4: Conversion (Block 3.7 of TIGERCLAW-MASTER-SPEC-v2.md)
// Two paths: BUILDER (three-way handoff) and CUSTOMER (autonomous close)
// Actions: initiate | mark_sent | confirm | list

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_convert } from '../tiger_convert.js'
import { makeContext, type ToolResult } from './helpers.js'

// ─── Mutable in-memory stores (mimic tenant_data service pattern) ─────────────

let mockLeads: Record<string, any> = {}
let mockNurtureStore: Record<string, any> = {}
let mockTenantState: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  saveLeads: vi.fn(async (_tid: string, leads: Record<string, any>) => { mockLeads = leads }),
  getNurture: vi.fn(async () => mockNurtureStore),
  saveNurture: vi.fn(async (_tid: string, store: Record<string, any>) => { mockNurtureStore = store }),
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
  saveTenantState: vi.fn(async (_tid: string, file: string, data: unknown) => { mockTenantState[file] = data }),
}))

vi.mock('../../services/db.js', () => ({
  getLeadScoutProfile: vi.fn(async () => ({
    source: 'telegram',
    intentPatternTypes: ['career_transition'],
    profileFitScore: 82,
  })),
}))

vi.mock('../../services/hiveEmitter.js', () => ({
  emitHiveEvent: vi.fn().mockResolvedValue(undefined),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUILDER_LEAD = {
  id: 'lead-001',
  displayName: 'Alice',
  platform: 'telegram',
  profileFit: 85,
  intentScore: 80,
  oar: 'builder',
  qualified: true,
  optedOut: false,
  intentSignalHistory: [],
}

const CUSTOMER_LEAD = {
  id: 'lead-002',
  displayName: 'Bob',
  platform: 'telegram',
  profileFit: 82,
  intentScore: 88,
  oar: 'customer',
  qualified: true,
  optedOut: false,
  intentSignalHistory: [],
}

const OPTED_OUT_LEAD = {
  id: 'lead-003',
  displayName: 'Carol',
  platform: 'telegram',
  profileFit: 90,
  intentScore: 90,
  oar: 'builder',
  qualified: true,
  optedOut: true,
  intentSignalHistory: [],
}

function makeNurtureRecord(leadId: string, oar: string = 'builder'): Record<string, any> {
  return {
    id: `nurture-${leadId}`,
    leadId,
    leadDisplayName: mockLeads[leadId]?.displayName ?? 'Unknown',
    platform: 'telegram',
    oar,
    enrolledAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    status: 'active',
    touchHistory: [
      {
        touchNumber: 1,
        type: 'value_drop',
        messageText: 'Here is some value...',
        sentAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        responseClassification: 'hot',
      },
      {
        touchNumber: 3,
        type: 'gap_closing',
        messageText: 'Let me address your concern...',
        sentAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    ],
    lastOneToTenScore: 9,
    lastGapAnswer: 'I just need more time to think it over',
    oneToTenRound: 1,
  }
}

const ONBOARD_STATE = {
  phase: 'complete',
  flavor: 'network-marketer',
  botName: 'TestBot',
  identity: {
    name: 'Brent',
    productOrOpportunity: 'health products',
    yearsInProfession: '10',
    biggestWin: 'built a 1000-person team',
    differentiator: 'I focus on systems, not hype',
    contactPreference: 'telegram',
    contactHandle: '@brent',
  },
}

// ─── Helper to seed default fixture state ─────────────────────────────────────

function seedDefault() {
  mockLeads = {
    'lead-001': { ...BUILDER_LEAD },
    'lead-002': { ...CUSTOMER_LEAD },
    'lead-003': { ...OPTED_OUT_LEAD },
  }
  mockNurtureStore = {
    'nurture-lead-001': makeNurtureRecord('lead-001', 'builder'),
    'nurture-lead-002': makeNurtureRecord('lead-002', 'customer'),
  }
  mockTenantState = {
    'onboard_state.json': { ...ONBOARD_STATE },
    'conversions.json': {},
  }
}

// ─── initiate — builder path ──────────────────────────────────────────────────

describe('tiger_convert — initiate (builder)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedDefault()
  })

  it('returns ok:true for a valid builder lead', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    expect(result.ok).toBe(true)
  })

  it('generates all three builder messages', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    const data = result.data as Record<string, any>
    expect(data.tenantBriefText).toBeTruthy()
    expect(data.prospectEdificationText).toBeTruthy()
    expect(data.connectionText).toBeTruthy()
  })

  it('tenant brief mentions lead name and score', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    const data = result.data as Record<string, any>
    expect(data.tenantBriefText).toContain('Alice')
    expect(data.tenantBriefText).toContain('ready')
  })

  it('edification text mentions tenant name', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    const data = result.data as Record<string, any>
    expect(data.prospectEdificationText).toContain('Brent')
  })

  it('creates a conversions.json record with status=pending_delivery', async () => {
    const ctx = makeContext()
    await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    const conversions = mockTenantState['conversions.json'] as Record<string, any>
    const entry = Object.values(conversions)[0] as Record<string, any>
    expect(entry.status).toBe('pending_delivery')
    expect(entry.oar).toBe('builder')
  })

  it('returns skipped:true when lead already has an active conversion', async () => {
    const ctx = makeContext()
    // Initiate once
    await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    // Initiate again — should skip
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    expect(result.ok).toBe(true)
    expect((result.data as any).skipped).toBe(true)
  })
})

// ─── initiate — customer path ─────────────────────────────────────────────────

describe('tiger_convert — initiate (customer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedDefault()
  })

  it('returns ok:true for customer oar', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-002', nurtureId: 'nurture-lead-002' },
      ctx,
    )
    expect(result.ok).toBe(true)
  })

  it('generates autonomousCloseText and tenantNotificationText for customer path', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-002', nurtureId: 'nurture-lead-002' },
      ctx,
    )
    const data = result.data as Record<string, any>
    expect(data.autonomousCloseText).toBeTruthy()
    expect(data.tenantNotificationText).toBeTruthy()
    // Builder fields must NOT be present on customer path
    expect(data.tenantBriefText).toBeUndefined()
    expect(data.connectionText).toBeUndefined()
  })

  it('customer close text mentions the lead name', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-002', nurtureId: 'nurture-lead-002' },
      ctx,
    )
    const data = result.data as Record<string, any>
    expect(data.autonomousCloseText).toContain('Bob')
  })
})

// ─── initiate — error cases ───────────────────────────────────────────────────

describe('tiger_convert — initiate errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedDefault()
  })

  it('returns ok:false when leadId is not found', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'ghost', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns ok:false when nurtureId is not found', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'ghost-nurture' },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns ok:false when lead has opted out', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-003', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('opted out')
  })

  it('returns ok:false when onboarding is not complete', async () => {
    mockTenantState['onboard_state.json'] = { phase: 'identity' }
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Onboarding not complete')
  })

  it('returns ok:false when onboard_state.json is missing entirely', async () => {
    delete mockTenantState['onboard_state.json']
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    expect(result.ok).toBe(false)
  })
})

// ─── mark_sent ────────────────────────────────────────────────────────────────

describe('tiger_convert — mark_sent', () => {
  let conversionId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    seedDefault()
    // Initiate a builder conversion to get a conversionId
    const ctx = makeContext()
    const result = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    conversionId = (result.data as any).conversionId
  })

  it('advances status to tenant_briefed', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'mark_sent', conversionId, step: 'tenant_briefed' },
      ctx,
    )
    expect(result.ok).toBe(true)
    const conversions = mockTenantState['conversions.json'] as Record<string, any>
    expect(conversions[conversionId].status).toBe('tenant_briefed')
  })

  it('advances status to prospect_edified', async () => {
    const ctx = makeContext()
    await tiger_convert.execute({ action: 'mark_sent', conversionId, step: 'tenant_briefed' }, ctx)
    const result: ToolResult = await tiger_convert.execute(
      { action: 'mark_sent', conversionId, step: 'prospect_edified' },
      ctx,
    )
    expect(result.ok).toBe(true)
    const conversions = mockTenantState['conversions.json'] as Record<string, any>
    expect(conversions[conversionId].status).toBe('prospect_edified')
  })

  it('advances status to connected', async () => {
    const ctx = makeContext()
    await tiger_convert.execute({ action: 'mark_sent', conversionId, step: 'tenant_briefed' }, ctx)
    await tiger_convert.execute({ action: 'mark_sent', conversionId, step: 'prospect_edified' }, ctx)
    const result: ToolResult = await tiger_convert.execute(
      { action: 'mark_sent', conversionId, step: 'connected' },
      ctx,
    )
    expect(result.ok).toBe(true)
    const conversions = mockTenantState['conversions.json'] as Record<string, any>
    expect(conversions[conversionId].status).toBe('connected')
  })

  it('marks customer_closed on tenant_notified step', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'mark_sent', conversionId, step: 'tenant_notified' },
      ctx,
    )
    expect(result.ok).toBe(true)
    const conversions = mockTenantState['conversions.json'] as Record<string, any>
    expect(conversions[conversionId].status).toBe('customer_closed')
  })

  it('returns ok:false for unknown conversionId', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'mark_sent', conversionId: 'ghost-id', step: 'tenant_briefed' },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })
})

// ─── confirm ──────────────────────────────────────────────────────────────────

describe('tiger_convert — confirm', () => {
  let conversionId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    seedDefault()
    const ctx = makeContext()
    const result = await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    conversionId = (result.data as any).conversionId
  })

  it('returns ok:true and marks status as confirmed', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'confirm', conversionId },
      ctx,
    )
    expect(result.ok).toBe(true)
    const conversions = mockTenantState['conversions.json'] as Record<string, any>
    expect(conversions[conversionId].status).toBe('confirmed')
  })

  it('marks lead.converted = true', async () => {
    const ctx = makeContext()
    await tiger_convert.execute({ action: 'confirm', conversionId }, ctx)
    expect(mockLeads['lead-001'].converted).toBe(true)
  })

  it('sets involvementLevel to at least 2 on the lead', async () => {
    const ctx = makeContext()
    await tiger_convert.execute({ action: 'confirm', conversionId }, ctx)
    expect(mockLeads['lead-001'].involvementLevel).toBeGreaterThanOrEqual(2)
  })

  it('stamps confirmedAt on the conversion record', async () => {
    const ctx = makeContext()
    await tiger_convert.execute({ action: 'confirm', conversionId }, ctx)
    const conversions = mockTenantState['conversions.json'] as Record<string, any>
    expect(conversions[conversionId].confirmedAt).toBeTruthy()
  })

  it('output instructs to enroll in tiger_aftercare (builder)', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'confirm', conversionId },
      ctx,
    )
    expect(result.output).toContain('tiger_aftercare')
    expect(result.output).toContain('builder')
  })

  it('returns ok:false for unknown conversionId', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'confirm', conversionId: 'ghost' },
      ctx,
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('emits a hive conversion event (non-fatal if it throws)', async () => {
    const { emitHiveEvent } = await import('../../services/hiveEmitter.js')
    ;(emitHiveEvent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('hive down'))

    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute(
      { action: 'confirm', conversionId },
      ctx,
    )
    // Must not crash — hive errors are non-fatal
    expect(result.ok).toBe(true)
  })
})

// ─── list ─────────────────────────────────────────────────────────────────────

describe('tiger_convert — list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedDefault()
  })

  it('returns ok:true with "No conversions yet" when store is empty', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute({ action: 'list' }, ctx)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('No conversions')
  })

  it('lists initiated conversions', async () => {
    const ctx = makeContext()
    await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    const result: ToolResult = await tiger_convert.execute({ action: 'list' }, ctx)
    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice')
    const data = result.data as Record<string, any>
    expect(data.total).toBe(1)
  })

  it('includes summary by status', async () => {
    const ctx = makeContext()
    await tiger_convert.execute(
      { action: 'initiate', leadId: 'lead-001', nurtureId: 'nurture-lead-001' },
      ctx,
    )
    const result: ToolResult = await tiger_convert.execute({ action: 'list' }, ctx)
    const data = result.data as Record<string, any>
    expect(data.byStatus).toHaveProperty('pending_delivery')
  })
})

// ─── unknown action ───────────────────────────────────────────────────────────

describe('tiger_convert — unknown action', () => {
  it('returns ok:false for unrecognised action', async () => {
    seedDefault()
    const ctx = makeContext()
    const result: ToolResult = await tiger_convert.execute({ action: 'zap' }, ctx)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unknown action')
  })
})
