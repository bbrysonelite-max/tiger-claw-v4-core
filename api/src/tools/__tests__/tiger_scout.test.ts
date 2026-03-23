import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_scout } from '../tiger_scout.js'
import { makeContext, type ToolResult } from './helpers.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../services/tenant_data.js', () => ({
  getLeads: vi.fn(async () => ({})),
  saveLeads: vi.fn(),
  getTenantState: vi.fn(async (tid, file) => {
    if (file === 'onboard_state.json') {
      return {
        phase: 'complete',
        icpBuilder: { idealPerson: 'entrepreneurs', problemFaced: 'need money' },
        icpCustomer: { idealPerson: 'tired parents' },
        icpSingle: {},
        flavor: 'network-marketer',
        language: 'en'
      }
    }
    if (file === 'scout_state.json') {
      return {
        burstCountToday: 0,
        burstCountDate: '2026-01-01',
        totalLeadsDiscovered: 0,
        totalLeadsQualified: 0
      }
    }
    return null;
  }),
  saveTenantState: vi.fn(),
}))

describe.skip('tiger_scout', () => {
  beforeEach(() => {
    vi.resetAllMocks()
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

    const ctx = makeContext(new Map(), { config: { REGION: 'us-en' } }) // US enables Reddit
    const result: ToolResult = await tiger_scout.execute({ action: 'hunt', mode: 'burst' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Scans Complete')
    expect(mockFetch).toHaveBeenCalled()
  })

  it('abides by burst limits and returns gracefully', async () => {
    // Override the mock for this specific test
    vi.mocked(await import('../../services/tenant_data.js')).getTenantState.mockResolvedValueOnce({
      phase: 'complete',
      icpBuilder: {}, icpCustomer: {}, icpSingle: {}, flavor: 'network-marketer'
    }).mockResolvedValueOnce({
      burstCountToday: 3, // LIMIT EXCEEDED
      burstCountDate: new Date().toISOString().slice(0, 10),
      totalLeadsDiscovered: 0,
      totalLeadsQualified: 0
    });

    const ctx = makeContext()
    const result = await tiger_scout.execute({ action: 'hunt', mode: 'burst' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Maximum 3 burst scans')
  })

  it('rejects unknown actions', async () => {
    const ctx = makeContext()
    const result = await tiger_scout.execute({ action: 'invalid' as any }, ctx)

    expect(result.ok).toBe(false)
  })
})
