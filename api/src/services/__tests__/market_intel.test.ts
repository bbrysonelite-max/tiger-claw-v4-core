import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQuery = vi.hoisted(() => vi.fn())
const mockOn = vi.hoisted(() => vi.fn())
const mockConnect = vi.hoisted(() => vi.fn().mockResolvedValue({
  query: vi.fn(),
  release: vi.fn()
}))
const mockEnd = vi.hoisted(() => vi.fn())

vi.mock('pg', () => {
  return {
    Pool: class {
      on = mockOn;
      query = mockQuery;
      connect = mockConnect;
      end = mockEnd;
    }
  }
})

import { getMarketIntelligence } from '../market_intel.js'

const makeFact = (overrides: Record<string, any> = {}) => ({
  id: 'abc-123',
  domain: 'real-estate',
  category: 'market-trend',
  entity_label: 'Bay Area',
  fact_summary: 'Interest rates in the Bay Area dropped to 5.1%.',
  confidence_score: 85,
  source_url: 'https://reddit.com/r/realestate/1',
  captured_by: 'birdie',
  metadata: {},
  verified_at: new Date(),
  valid_until: null,
  ...overrides,
})

beforeEach(() => {
  mockQuery.mockReset()
})

describe('getMarketIntelligence', () => {
  it('returns facts for a matching domain', async () => {
    const row = makeFact()
    mockQuery.mockResolvedValueOnce({ rows: [row] })

    const result = await getMarketIntelligence('real-estate')

    expect(result).toHaveLength(1)
    expect(result[0].fact_summary).toBe('Interest rates in the Bay Area dropped to 5.1%.')
    expect(result[0].domain).toBe('real-estate')
  })

  it('passes correct SQL filters to the query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getMarketIntelligence('network-marketer', 3)

    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toContain('domain = $1')
    expect(sql).toContain('confidence_score >= $2')
    expect(sql).toContain("INTERVAL '7 days'")
    expect(sql).toContain('valid_until IS NULL OR valid_until > NOW()')
    expect(params[0]).toBe('network-marketer')
    expect(params[2]).toBe(3) // limit
  })

  it('returns empty array when no facts match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await getMarketIntelligence('real-estate')

    expect(result).toEqual([])
  })

  it('returns empty array immediately when domain is empty', async () => {
    const result = await getMarketIntelligence('')

    expect(mockQuery).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('does not return stale facts — query enforces 7-day window in SQL', async () => {
    // Stale filtering happens in SQL; verify the clause is present
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getMarketIntelligence('real-estate')

    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toContain("NOW() - INTERVAL '7 days'")
  })

  it('propagates DB errors so callers can catch them', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'))

    await expect(getMarketIntelligence('real-estate')).rejects.toThrow('DB connection lost')
  })

  it('defaults to limit 5 when not specified', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await getMarketIntelligence('real-estate')

    const [, params] = mockQuery.mock.calls[0]
    expect(params[2]).toBe(5)
  })
})
