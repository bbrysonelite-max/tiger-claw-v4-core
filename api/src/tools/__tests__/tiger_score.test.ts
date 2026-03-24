import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_score } from '../tiger_score.js'
import { makeContext, type ToolResult } from './helpers.js'

let mockLeads: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  saveLeads: vi.fn(async (_tid: string, data: unknown) => { mockLeads = data as any }),
}))

vi.mock('../../services/hiveEmitter.js', () => ({
  emitHiveEvent: vi.fn().mockResolvedValue(undefined),
}))

const EXISTING_LEAD = {
  id: 'lead-001',
  platform: 'telegram',
  platformId: 'u1',
  displayName: 'Alice',
  profileFit: 70,
  intentScore: 60,
  engagement: 0,
  rawIntentStrength: 60,
  builderScore: 50,
  customerScore: 47,
  qualifyingScore: 50,
  oar: 'builder',
  primaryOar: 'builder',
  isUnicorn: false,
  unicornBonusApplied: false,
  qualified: false,
  qualifyingOar: 'builder',
  optedOut: false,
  intentSignalHistory: [],
  engagementEvents: [],
  involvementLevel: 0,
  discoveredAt: new Date().toISOString(),
  lastSignalAt: new Date().toISOString(),
  lastScoredAt: new Date().toISOString(),
  purgeAt: new Date(Date.now() + 90 * 86400000).toISOString(),
}

describe('tiger_score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = {}
  })

  it('scores a new lead and returns ok:true', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_score.execute({
      action: 'score',
      platform: 'telegram',
      platformId: 'user123',
      displayName: 'Alice Johnson',
      profileFit: 80,
      intentSignals: [{ type: 'income_complaint', strength: 70, detectedAt: new Date().toISOString() }],
      oar: 'builder',
    }, ctx)

    expect(result.ok).toBe(true)
  })

  it('persists the scored lead to storage', async () => {
    const ctx = makeContext()
    await tiger_score.execute({
      action: 'score',
      platform: 'telegram',
      platformId: 'user123',
      displayName: 'Alice Johnson',
      profileFit: 80,
      intentSignals: [],
      oar: 'builder',
    }, ctx)

    const saved = Object.values(mockLeads)
    expect(saved.length).toBe(1)
    expect((saved[0] as any).displayName).toBe('Alice Johnson')
  })

  it('includes score in output', async () => {
    const ctx = makeContext()
    const result = await tiger_score.execute({
      action: 'score',
      platform: 'telegram',
      platformId: 'user123',
      displayName: 'Alice Johnson',
      profileFit: 80,
      intentSignals: [],
      oar: 'builder',
    }, ctx)

    expect(result.output).toBeTruthy()
  })

  it('returns ok:false when platform is missing', async () => {
    const ctx = makeContext()
    const result = await tiger_score.execute({
      action: 'score',
      platformId: 'user123',
      displayName: 'Alice',
      profileFit: 80,
      intentSignals: [],
      oar: 'builder',
    }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false when displayName is missing', async () => {
    const ctx = makeContext()
    const result = await tiger_score.execute({
      action: 'score',
      platform: 'telegram',
      platformId: 'user123',
      displayName: '',
      profileFit: 80,
      intentSignals: [],
      oar: 'builder',
    }, ctx)

    expect(result.ok).toBe(false)
  })

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext()
    const result = await tiger_score.execute({ action: 'unknown' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('list action returns ok:true', async () => {
    const ctx = makeContext()
    const result = await tiger_score.execute({ action: 'list' }, ctx)

    expect(result.ok).toBe(true)
  })

  it('list action with filter:all includes existing leads in output', async () => {
    mockLeads = { 'lead-001': { ...EXISTING_LEAD } }
    const ctx = makeContext()
    const result = await tiger_score.execute({ action: 'list', filter: 'all' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Alice')
  })

  it('lead with max scores is computed with positive builderScore', async () => {
    const ctx = makeContext()
    await tiger_score.execute({
      action: 'score',
      platform: 'telegram',
      platformId: 'user999',
      displayName: 'HighFit',
      profileFit: 100,
      intentSignals: [{ type: 'income_complaint', strength: 100, detectedAt: new Date().toISOString() }],
      oar: 'builder',
    }, ctx)

    const saved = Object.values(mockLeads)[0] as any
    // builderScore = 100*0.30 + 100*0.45 + 0*0.25 = 75 (engagement is 0 at score time)
    // 75 < 80 threshold so not qualified yet — engagement events push it over
    expect(saved.builderScore).toBeGreaterThan(0)
    expect(saved.profileFit).toBe(100)
  })

  it('update_engagement records an engagement event for an existing lead', async () => {
    mockLeads = { 'lead-001': { ...EXISTING_LEAD } }
    const ctx = makeContext()
    const result = await tiger_score.execute({
      action: 'update_engagement',
      leadId: 'lead-001',
      event: 'replied',
    }, ctx)

    expect(result.ok).toBe(true)
  })
})
