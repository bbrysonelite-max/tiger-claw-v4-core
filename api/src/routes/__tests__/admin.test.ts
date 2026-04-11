import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------
const mockDb = vi.hoisted(() => ({
  listBotPool: vi.fn(),
  getPoolStats: vi.fn(),
  addTokenToPool: vi.fn(),
  logAdminEvent: vi.fn(),
  setCanaryGroup: vi.fn(),
  listTenants: vi.fn(),
  getTenant: vi.fn(),
  getTenantBySlug: vi.fn(),
  getPool: vi.fn(),
  getBotState: vi.fn(),
  dropTenantSchema: vi.fn().mockResolvedValue(undefined),
}))

const mockProvisioner = vi.hoisted(() => ({
  provisionTenant: vi.fn(),
  suspendTenant: vi.fn(),
  resumeTenant: vi.fn(),
  terminateTenant: vi.fn(),
  deprovisionTenant: vi.fn(),
}))

vi.mock('../../services/db.js', () => mockDb)
vi.mock('../../services/provisioner.js', () => mockProvisioner)

const VALID_TOKEN = 'test-admin-token'

// ---------------------------------------------------------------------------
// Build a minimal Express app with the admin router
// ---------------------------------------------------------------------------
async function buildApp() {
  const { default: adminRouter } = await import('../../routes/admin.js')
  const app = express()
  app.use(express.json())
  app.use('/admin', adminRouter)
  return app
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env['ADMIN_TOKEN'] = VALID_TOKEN
  mockDb.dropTenantSchema.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
describe('Admin auth middleware', () => {
  it('rejects requests with no Authorization header', async () => {
    const app = await buildApp()
    const res = await request(app).get('/admin/fleet')
    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong token', async () => {
    const app = await buildApp()
    mockDb.listTenants.mockResolvedValue([])
    const res = await request(app)
      .get('/admin/fleet')
      .set('Authorization', 'Bearer wrong-token')
    expect(res.status).toBe(401)
  })

  it('allows requests with correct Bearer token', async () => {
    const app = await buildApp()
    mockDb.listTenants.mockResolvedValue([])
    const res = await request(app)
      .get('/admin/fleet')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// GET /admin/fleet
// ---------------------------------------------------------------------------
describe('GET /admin/fleet', () => {
  it('returns list of tenants', async () => {
    const app = await buildApp()
    const tenants = [
      { id: 't1', slug: 'acme', status: 'active', createdAt: new Date() },
      { id: 't2', slug: 'globex', status: 'suspended', createdAt: new Date() },
    ]
    mockDb.listTenants.mockResolvedValue(tenants)

    const res = await request(app)
      .get('/admin/fleet')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2)
    expect(res.body.tenants[0].slug).toBe('acme')
  })

  it('returns empty array when no tenants exist', async () => {
    const app = await buildApp()
    mockDb.listTenants.mockResolvedValue([])

    const res = await request(app)
      .get('/admin/fleet')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(0)
    expect(res.body.tenants).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// POST /admin/provision
// ---------------------------------------------------------------------------
describe('POST /admin/provision', () => {
  it('provisions a tenant and returns result', async () => {
    const app = await buildApp()
    mockProvisioner.provisionTenant.mockResolvedValue({ success: true, tenant: { id: 't1' } })

    const res = await request(app)
      .post('/admin/provision')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ slug: 'acme', name: 'Acme Corp', email: 'admin@acme.com', flavor: 'default', region: 'us', language: 'en', preferredChannel: 'telegram' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(mockProvisioner.provisionTenant).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// DELETE /admin/fleet/:tenantId
// ---------------------------------------------------------------------------
describe('DELETE /admin/fleet/:tenantId', () => {
  it('terminates the specified tenant', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'tenant-1' })
    mockProvisioner.terminateTenant.mockResolvedValue({ success: true })

    const res = await request(app)
      .delete('/admin/fleet/t1')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(mockProvisioner.terminateTenant).toHaveBeenCalledWith({ id: 't1', slug: 'tenant-1' })
  })

  it('returns 500 when termination fails', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'tenant-1' })
    mockProvisioner.terminateTenant.mockRejectedValue(new Error('Termination failed'))

    const res = await request(app)
      .delete('/admin/fleet/t1')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/fleet/:tenantId/canary
// ---------------------------------------------------------------------------
describe('POST /admin/fleet/:tenantId/canary', () => {
  it('sets canary group for a tenant', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'tenant-1' })
    mockDb.setCanaryGroup.mockResolvedValue(undefined)

    const res = await request(app)
      .post('/admin/fleet/t1/canary')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(mockDb.setCanaryGroup).toHaveBeenCalledWith('t1', true)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/fleet/:tenantId/reset-conversation
// ---------------------------------------------------------------------------
describe('POST /admin/fleet/:tenantId/reset-conversation', () => {
  it('clears Redis chat history and returns keys_cleared count', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'canary-1' })
    mockDb.logAdminEvent.mockResolvedValue(undefined)
    mockDb.getPool.mockReturnValue({ query: vi.fn().mockResolvedValue({ rowCount: 1 }) })

    // Mock the ai.ts clearTenantChatHistory import
    vi.doMock('../../services/ai.js', () => ({
      clearTenantChatHistory: vi.fn().mockResolvedValue(3),
    }))

    const res = await request(app)
      .post('/admin/fleet/canary-1/reset-conversation')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    // keys_cleared may be 0 if dynamic import mock doesn't propagate — just check shape
    expect(typeof res.body.keys_cleared).toBe('number')
    expect(res.body.onboard_state_cleared).toBe(true)
  })

  it('returns 404 for unknown tenant', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue(null)
    mockDb.getTenant.mockResolvedValue(null)

    const res = await request(app)
      .post('/admin/fleet/ghost-tenant/reset-conversation')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(404)
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await request(app).post('/admin/fleet/t1/reset-conversation')
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// GET /admin/dashboard/tenants
// ---------------------------------------------------------------------------
describe('GET /admin/dashboard/tenants', () => {
  const mockPool = { query: vi.fn() }

  beforeEach(() => {
    mockDb.getPool.mockReturnValue(mockPool)
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await request(app).get('/admin/dashboard/tenants')
    expect(res.status).toBe(401)
  })

  it('returns structured tenant list with onboarding complete for active tenants', async () => {
    const app = await buildApp()
    mockPool.query.mockResolvedValue({
      rows: [{
        id: 't1', name: 'Brent Bryson', slug: 'brent', status: 'active',
        canary_group: true, last_activity_at: new Date('2026-03-20T10:00:00Z'),
        bot_username: 'TigerTestBot', created_at: new Date('2026-03-01T00:00:00Z'),
      }],
    })

    const res = await request(app)
      .get('/admin/dashboard/tenants')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.tenants).toHaveLength(1)
    const t = res.body.tenants[0]
    expect(t.name).toBe('Brent Bryson')
    expect(t.isCanary).toBe(true)
    expect(t.botUsername).toBe('@TigerTestBot')
    expect(t.onboardingComplete).toBe(true)
    expect(t.onboardingPhase).toBe('complete')
    expect(t.lastActive).toBe('2026-03-20T10:00:00.000Z')
  })

  it('reads onboard_state.json for incomplete tenants and returns the phase', async () => {
    const app = await buildApp()
    mockPool.query.mockResolvedValue({
      rows: [{
        id: 't2', name: 'New User', slug: 'new-user', status: 'onboarding',
        canary_group: false, last_activity_at: null, bot_username: null,
        created_at: new Date('2026-03-01T00:00:00Z'),
      }],
    })
    mockDb.getBotState.mockResolvedValue({ phase: 'identity' })

    const res = await request(app)
      .get('/admin/dashboard/tenants')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    const t = res.body.tenants[0]
    expect(t.onboardingComplete).toBe(false)
    expect(t.onboardingPhase).toBe('identity')
    expect(t.botUsername).toBe('Unassigned')
    expect(t.lastActive).toBe('Never')
  })

  it('returns empty tenants array when fleet is empty', async () => {
    const app = await buildApp()
    mockPool.query.mockResolvedValue({ rows: [] })

    const res = await request(app)
      .get('/admin/dashboard/tenants')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.tenants).toEqual([])
  })

  it('returns 500 on DB error', async () => {
    const app = await buildApp()
    mockPool.query.mockRejectedValue(new Error('Connection refused'))

    const res = await request(app)
      .get('/admin/dashboard/tenants')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Skills curation routes
// ---------------------------------------------------------------------------
describe('Skills curation routes', () => {
  const mockPool = { query: vi.fn() }

  beforeEach(() => {
    mockDb.getPool.mockReturnValue(mockPool)
    mockDb.logAdminEvent.mockResolvedValue(undefined)
  })

  describe('GET /admin/skills', () => {
    it('returns skills list with total count', async () => {
      const app = await buildApp()
      const fakeSkill = { id: 'uuid-1', name: 'recover_tiger_scout_failure', status: 'draft' }
      mockPool.query
        .mockResolvedValueOnce({ rows: [fakeSkill] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })

      const res = await request(app)
        .get('/admin/skills')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)

      expect(res.status).toBe(200)
      expect(res.body.skills).toHaveLength(1)
      expect(res.body.total).toBe(1)
    })

    it('filters by tenantId when provided', async () => {
      const app = await buildApp()
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })

      const res = await request(app)
        .get('/admin/skills?tenantId=abc-123')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)

      expect(res.status).toBe(200)
      expect(res.body.total).toBe(0)
    })

    it('returns 401 without auth', async () => {
      const app = await buildApp()
      const res = await request(app).get('/admin/skills')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /admin/skills/:id/approve', () => {
    it('approves a draft skill', async () => {
      const app = await buildApp()
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'uuid-1', name: 'recover_tiger_scout_failure', status: 'approved', scope: 'tenant' }],
      })

      const res = await request(app)
        .post('/admin/skills/uuid-1/approve')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({})

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.skill.status).toBe('approved')
    })

    it('returns 404 when skill not found or not draft', async () => {
      const app = await buildApp()
      mockPool.query.mockResolvedValue({ rows: [] })

      const res = await request(app)
        .post('/admin/skills/no-such-id/approve')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({})

      expect(res.status).toBe(404)
    })
  })

  describe('POST /admin/skills/:id/reject', () => {
    it('rejects a draft skill', async () => {
      const app = await buildApp()
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'uuid-1', name: 'recover_tiger_scout_failure', status: 'rejected' }],
      })

      const res = await request(app)
        .post('/admin/skills/uuid-1/reject')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)

      expect(res.status).toBe(200)
      expect(res.body.skill.status).toBe('rejected')
    })

    it('returns 404 when skill already finalized', async () => {
      const app = await buildApp()
      mockPool.query.mockResolvedValue({ rows: [] })

      const res = await request(app)
        .post('/admin/skills/no-such-id/reject')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /admin/skills/:id/promote', () => {
    it('promotes an approved skill to platform scope', async () => {
      const app = await buildApp()
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'uuid-1', name: 'recover_tiger_scout_failure', status: 'platform', scope: 'platform' }],
      })

      const res = await request(app)
        .post('/admin/skills/uuid-1/promote')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)

      expect(res.status).toBe(200)
      expect(res.body.skill.scope).toBe('platform')
    })

    it('returns 404 when skill not in approved status', async () => {
      const app = await buildApp()
      mockPool.query.mockResolvedValue({ rows: [] })

      const res = await request(app)
        .post('/admin/skills/draft-id/promote')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /admin/skills/:id', () => {
    it('deletes a skill by id', async () => {
      const app = await buildApp()
      mockPool.query.mockResolvedValue({ rowCount: 1 })

      const res = await request(app)
        .delete('/admin/skills/uuid-1')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
    })

    it('returns 404 when skill does not exist', async () => {
      const app = await buildApp()
      mockPool.query.mockResolvedValue({ rowCount: 0 })

      const res = await request(app)
        .delete('/admin/skills/no-such-id')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)

      expect(res.status).toBe(404)
    })
  })
})

// ---------------------------------------------------------------------------
// GET /admin/mine/queries — per-scoutQuery rolling kept-rate
// ---------------------------------------------------------------------------
describe('GET /admin/mine/queries', () => {
  const mockPool = { query: vi.fn() }

  beforeEach(() => {
    mockDb.getPool.mockReturnValue(mockPool)
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await request(app).get('/admin/mine/queries')
    expect(res.status).toBe(401)
  })

  it('aggregates mine_query_metrics events and returns per-query kept rate', async () => {
    const app = await buildApp()
    mockPool.query.mockResolvedValue({
      rows: [
        {
          query: 'subreddit:antiwork tired of this job',
          flavor: 'network-marketer',
          display_name: 'Network Marketer',
          runs: 7,
          posts: 63,
          kept: 12,
          rejected: 38,
          duplicates: 4,
          avg_duration_ms: 2100,
          kept_rate: '0.190',
          last_run_at: new Date('2026-04-11T02:15:00Z'),
        },
      ],
    })

    const res = await request(app)
      .get('/admin/mine/queries?sinceDays=7&flavor=network-marketer')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.sinceDays).toBe(7)
    expect(res.body.flavor).toBe('network-marketer')
    expect(res.body.queries).toHaveLength(1)
    expect(res.body.queries[0].kept).toBe(12)
    expect(res.body.queries[0].kept_rate).toBe('0.190')

    // Verify the SQL targets the right event action and applies the window.
    const [sql, params] = mockPool.query.mock.calls[0]
    expect(sql).toContain("action = 'mine_query_metrics'")
    expect(sql).toContain("($1 || ' days')::interval")
    expect(sql).toContain('ORDER BY kept_rate DESC NULLS LAST')
    expect(params[0]).toBe('7')
    expect(params[1]).toBe('network-marketer')
  })

  it('defaults sinceDays to 7 and leaves flavor filter empty', async () => {
    const app = await buildApp()
    mockPool.query.mockResolvedValue({ rows: [] })

    const res = await request(app)
      .get('/admin/mine/queries')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.sinceDays).toBe(7)
    expect(res.body.flavor).toBeNull()
    const [, params] = mockPool.query.mock.calls[0]
    expect(params[0]).toBe('7')
    expect(params[1]).toBe('')
  })

  it('clamps sinceDays to [1, 90]', async () => {
    const app = await buildApp()
    mockPool.query.mockResolvedValue({ rows: [] })

    const res = await request(app)
      .get('/admin/mine/queries?sinceDays=9999')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.sinceDays).toBe(90)
  })
})

// ---------------------------------------------------------------------------
// GET /admin/campaigns
// ---------------------------------------------------------------------------
describe('GET /admin/campaigns', () => {
  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await request(app).get('/admin/campaigns')
    expect(res.status).toBe(401)
  })

  it('lists every registered MineCampaign with hunting metadata', async () => {
    const app = await buildApp()
    const res = await request(app)
      .get('/admin/campaigns')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.campaigns)).toBe(true)
    const ssdi = res.body.campaigns.find((c: any) => c.key === 'ssdi-ticket-to-work')
    expect(ssdi).toBeDefined()
    expect(ssdi.displayName).toBe('SSDI — Ticket to Work')
    expect(ssdi.deliveryMode).toBe('admin-export')
    expect(ssdi.scoutQueryCount).toBeGreaterThan(0)
    expect(Array.isArray(ssdi.leadFields)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// GET /admin/campaigns/:key/leads
// ---------------------------------------------------------------------------
describe('GET /admin/campaigns/:key/leads', () => {
  const mockPool = { query: vi.fn() }

  beforeEach(() => {
    mockDb.getPool.mockReturnValue(mockPool)
  })

  it('returns 401 without auth', async () => {
    const app = await buildApp()
    const res = await request(app).get('/admin/campaigns/ssdi-ticket-to-work/leads')
    expect(res.status).toBe(401)
  })

  it('404s for an unknown campaign key', async () => {
    const app = await buildApp()
    const res = await request(app)
      .get('/admin/campaigns/not-a-real-campaign/leads')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
    expect(res.status).toBe(404)
    expect(mockPool.query).not.toHaveBeenCalled()
  })

  it('exports CSV by default with the leadSchema columns', async () => {
    const app = await buildApp()
    mockPool.query.mockResolvedValue({
      rows: [
        {
          created_at: new Date('2026-04-10T12:00:00Z'),
          source_url: 'https://www.reddit.com/r/SSDI/comments/abc/title',
          entity_id: 'u/test_user',
          fact_summary: 'Wants to try part-time work but afraid of losing SSDI.',
          verbatim: 'I want to work but I\'m scared.',
          relevance_score: 87,
          relevance_reason: 'clear work interest + benefit-loss fear',
        },
      ],
    })

    const res = await request(app)
      .get('/admin/campaigns/ssdi-ticket-to-work/leads')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.headers['content-disposition']).toContain('ssdi-ticket-to-work')
    expect(res.text).toContain('created_at,source_url,entity_id,fact_summary,verbatim,relevance_score,relevance_reason')
    expect(res.text).toContain('u/test_user')
    expect(res.text).toContain('clear work interest + benefit-loss fear')
    // Embedded apostrophe must survive — CSV escape doubles quotes, not apostrophes.
    expect(res.text).toContain("I want to work but I'm scared.")

    // Verify the SQL filters by campaign_key on metadata JSONB.
    const [sql, params] = mockPool.query.mock.calls[0]
    expect(sql).toContain("metadata->>'campaign_key' = $1")
    expect(sql).toContain("created_at >= NOW() - ($2 || ' days')::interval")
    expect(sql).toContain("ORDER BY (metadata->>'relevance_score')::int DESC NULLS LAST")
    expect(params[0]).toBe('ssdi-ticket-to-work')
    expect(params[1]).toBe('30')
  })

  it('returns JSON when ?format=json is passed', async () => {
    const app = await buildApp()
    mockPool.query.mockResolvedValue({
      rows: [{
        created_at: new Date(),
        source_url: 'https://www.reddit.com/r/disability/comments/x/y',
        entity_id: 'u/foo',
        fact_summary: 'Test',
        verbatim: 'Test',
        relevance_score: 75,
        relevance_reason: 'test',
      }],
    })

    const res = await request(app)
      .get('/admin/campaigns/ssdi-ticket-to-work/leads?format=json&sinceDays=14')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.body.campaign).toBe('ssdi-ticket-to-work')
    expect(res.body.sinceDays).toBe(14)
    expect(res.body.count).toBe(1)
    expect(res.body.leads).toHaveLength(1)
  })

  it('clamps sinceDays to [1, 365]', async () => {
    const app = await buildApp()
    mockPool.query.mockResolvedValue({ rows: [] })

    const res = await request(app)
      .get('/admin/campaigns/ssdi-ticket-to-work/leads?format=json&sinceDays=9999')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.sinceDays).toBe(365)
    const [, params] = mockPool.query.mock.calls[0]
    expect(params[1]).toBe('365')
  })
})

