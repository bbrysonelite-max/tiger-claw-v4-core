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

import {
  listTenants,
  getTenant,
  logAdminEvent,
  listBotPool,
} from '../../services/db.js'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('listTenants', () => {
  it('returns all tenants from the read pool', async () => {
    const rows = [
      { id: 't1', slug: 'acme', status: 'active', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
      { id: 't2', slug: 'globex', status: 'suspended', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
    ]
    mockQuery.mockResolvedValueOnce({ rows })

    const result = await listTenants()

    expect(result.length).toBe(2)
    expect(mockQuery).toHaveBeenCalledOnce()
  })

  it('returns empty array when no tenants exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await listTenants()

    expect(result).toEqual([])
  })
})

describe('getTenant', () => {
  it('returns a tenant by id', async () => {
    const tenant = { id: 't1', slug: 'acme', status: 'active', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' }
    mockQuery.mockResolvedValueOnce({ rows: [tenant] })

    const result = await getTenant('t1')

    expect(result?.id).toEqual('t1')
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      expect.arrayContaining(['t1'])
    )
  })

  it('returns null when tenant does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const result = await getTenant('nonexistent')

    expect(result).toBeNull()
  })
})

describe('logAdminEvent', () => {
  it('inserts an admin event record', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })

    await logAdminEvent({ action: 'provision', tenantId: 't1' })

    expect(mockQuery).toHaveBeenCalledOnce()
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/INSERT/i)
    expect(params).toContain('provision')
  })
})

describe('listBotPool', () => {
  it('returns bots from the pool', async () => {
    const bots = [
      { id: 'b1', status: 'available', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
      { id: 'b2', status: 'assigned', tenantId: 't1', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
    ]
    mockQuery.mockResolvedValueOnce({ rows: bots })

    const result = await listBotPool()

    expect(result.length).toBe(2)
  })
})
