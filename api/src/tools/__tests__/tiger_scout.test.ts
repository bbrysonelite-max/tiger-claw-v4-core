import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_scout } from '../tiger_scout.js'
import { makeContext, type ToolResult } from './helpers.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mutable stores — mutate per-test to control getTenantState return values
let mockTenantState: Record<string, any> = {}
let mockLeads: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => mockLeads),
  saveLeads: vi.fn(async (_tid: string, leads: Record<string, any>) => { mockLeads = leads }),
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
  saveTenantState: vi.fn(),
}))

const TODAY = new Date().toISOString().slice(0, 10)

const BASE_ONBOARD = {
  phase: 'complete',
  icpBuilder: { idealPerson: 'entrepreneurs', problemFaced: 'need money' },
  icpCustomer: { idealPerson: 'tired parents' },
  icpSingle: {},
  flavor: 'network-marketer',
  language: 'en',
}

const FRESH_SCOUT_STATE = {
  burstCountToday: 0,
  burstCountDate: TODAY,
  totalLeadsDiscovered: 0,
  totalLeadsQualified: 0,
}

describe('tiger_scout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLeads = {}
    mockTenantState = {
      'onboard_state.json': BASE_ONBOARD,
      'scout_state.json': FRESH_SCOUT_STATE,
    }
  })

  it('executes a scout hunt and discovers leads', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        data: {
          children: [
            { data: { author: 'user1', title: 'Need more money', selftext: 'struggling', permalink: '/r/1' } }
          ]
        }
      })
    })

    const ctx = makeContext(new Map(), { config: { REGION: 'us-en' } })
    const result: ToolResult = await tiger_scout.execute({ action: 'hunt', mode: 'burst' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Hunt complete')
    expect(mockFetch).toHaveBeenCalled()
  })

  it('abides by burst limits and returns gracefully', async () => {
    mockTenantState['scout_state.json'] = {
      burstCountToday: 3,
      burstCountDate: TODAY,
      totalLeadsDiscovered: 0,
      totalLeadsQualified: 0,
    }

    const ctx = makeContext()
    const result = await tiger_scout.execute({ action: 'hunt', mode: 'burst' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Scout is cooling down')
  })

  it('rejects unknown actions', async () => {
    const ctx = makeContext()
    const result = await tiger_scout.execute({ action: 'invalid' as any }, ctx)

    expect(result.ok).toBe(false)
  })
})
