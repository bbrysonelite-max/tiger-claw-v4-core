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
  releaseBotToPool,
  assignBotToken,
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

// Phase 2: bot pool release cool-down
describe('releaseBotToPool', () => {
  it('stamps released_at=NOW() when releasing bot back to pool', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    await releaseBotToPool('bot-uuid-1')

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('released_at=NOW()'),
      ['bot-uuid-1']
    )
  })

  it('clears tenant_id and assigned_at on release', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    await releaseBotToPool('bot-uuid-2')

    const [sql] = mockQuery.mock.calls[0] as [string]
    expect(sql).toContain('tenant_id=NULL')
    expect(sql).toContain('assigned_at=NULL')
  })
})

describe('assignBotToken — cool-down enforcement', () => {
  it('excludes bots released within the last 30 minutes from pool selection', async () => {
    // withClient uses pool.connect() → client
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT (empty — no bots pass cool-down filter)
        .mockResolvedValueOnce(undefined), // ROLLBACK
      release: vi.fn(),
    }
    mockConnect.mockResolvedValueOnce(mockClient)

    const result = await assignBotToken('tenant-uuid-1')

    expect(result).toBeNull() // pool appears empty due to cool-down filter

    // Verify the SELECT query contains the cool-down WHERE clause
    const selectCall = mockClient.query.mock.calls.find(
      (call: any[]) => typeof call[0] === 'string' && (call[0] as string).includes('SELECT')
    )
    expect(selectCall).toBeDefined()
    const selectSql = selectCall![0] as string
    expect(selectSql).toContain('released_at IS NULL OR released_at <')
    expect(selectSql).toContain('30 minutes')
  })

  it('assigns the oldest available bot that passes the cool-down filter', async () => {
    const mockBot = {
      id: 'pool-bot-1',
      bot_token: 'enc:valid-token',
      bot_username: 'TestBot',
    }
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBot] }) // SELECT returns one bot
        .mockResolvedValueOnce(undefined) // UPDATE assigned
        .mockResolvedValueOnce(undefined), // COMMIT
      release: vi.fn(),
    }
    mockConnect.mockResolvedValueOnce(mockClient)

    const result = await assignBotToken('tenant-xyz')

    expect(result).not.toBeNull()
    expect(result?.botToken).toBe('enc:valid-token')
    expect(result?.botUsername).toBe('TestBot')
  })
})
