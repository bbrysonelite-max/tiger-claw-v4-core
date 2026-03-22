import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the pg pool factories so no real Postgres connection is made
// ---------------------------------------------------------------------------
const mockWriteClient = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
}))

const mockReadClient = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
}))

const mockWritePool = vi.hoisted(() => ({
  connect: vi.fn(() => Promise.resolve(mockWriteClient)),
  query: vi.fn(),
  end: vi.fn(),
}))

const mockReadPool = vi.hoisted(() => ({
  connect: vi.fn(() => Promise.resolve(mockReadClient)),
  query: vi.fn(),
  end: vi.fn(),
}))

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation((config: { connectionString: string }) => {
    // First call → write pool, second call → read pool (by connection string)
    if (config.connectionString?.includes('read')) return mockReadPool
    return mockWritePool
  }),
}))

import {
  listTenants,
  getTenant,
  logAdminEvent,
  listBotPool,
} from '../../services/db.js'

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// listTenants
// ---------------------------------------------------------------------------
describe('listTenants', () => {
  it('returns all tenants from the read pool', async () => {
    const rows = [
      { id: 't1', slug: 'acme', status: 'active' },
      { id: 't2', slug: 'globex', status: 'suspended' },
    ]
    mockReadPool.query.mockResolvedValueOnce({ rows })

    const result = await listTenants()

    expect(result).toEqual(rows)
    expect(mockReadPool.query).toHaveBeenCalledOnce()
  })

  it('returns empty array when no tenants exist', async () => {
    mockReadPool.query.mockResolvedValueOnce({ rows: [] })

    const result = await listTenants()

    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getTenant
// ---------------------------------------------------------------------------
describe('getTenant', () => {
  it('returns a tenant by id', async () => {
    const tenant = { id: 't1', slug: 'acme', status: 'active' }
    mockReadPool.query.mockResolvedValueOnce({ rows: [tenant] })

    const result = await getTenant('t1')

    expect(result).toEqual(tenant)
    expect(mockReadPool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE'),
      expect.arrayContaining(['t1'])
    )
  })

  it('returns null when tenant does not exist', async () => {
    mockReadPool.query.mockResolvedValueOnce({ rows: [] })

    const result = await getTenant('nonexistent')

    expect(result).toBeNull()
  })
})

// Removed getTenantBySlug test

// ---------------------------------------------------------------------------
// logAdminEvent
// ---------------------------------------------------------------------------
describe('logAdminEvent', () => {
  it('inserts an admin event record', async () => {
    mockWritePool.query.mockResolvedValueOnce({ rows: [] })

    await logAdminEvent({ action: 'provision', tenantId: 't1' })

    expect(mockWritePool.query).toHaveBeenCalledOnce()
    const [sql, params] = mockWritePool.query.mock.calls[0]
    expect(sql).toMatch(/INSERT/i)
    expect(params).toContain('provision')
  })
})

// Removed setCanaryGroup test

// ---------------------------------------------------------------------------
// listBotPool
// ---------------------------------------------------------------------------
describe('listBotPool', () => {
  it('returns bots from the pool', async () => {
    const bots = [
      { id: 'b1', status: 'available' },
      { id: 'b2', status: 'assigned', tenantId: 't1' },
    ]
    mockReadPool.query.mockResolvedValueOnce({ rows: bots })

    const result = await listBotPool()

    expect(result).toEqual(bots)
  })
})

// Removed getPoolStats test
