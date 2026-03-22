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

const VALID_TOKEN = 'test-admin-token'

beforeEach(() => {
  vi.resetAllMocks()
  process.env['ADMIN_TOKEN'] = VALID_TOKEN
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
      { id: 't1', slug: 'acme', status: 'active' },
      { id: 't2', slug: 'globex', status: 'suspended' },
    ]
    mockDb.listTenants.mockResolvedValue(tenants)

    const res = await request(app)
      .get('/admin/fleet')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual(tenants)
  })

  it('returns empty array when no tenants exist', async () => {
    const app = await buildApp()
    mockDb.listTenants.mockResolvedValue([])

    const res = await request(app)
      .get('/admin/fleet')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// POST /admin/provision
// ---------------------------------------------------------------------------
describe('POST /admin/provision', () => {
  it('provisions a tenant and returns result', async () => {
    const app = await buildApp()
    mockProvisioner.provisionTenant.mockResolvedValue({ success: true, tenantId: 't1' })

    const res = await request(app)
      .post('/admin/provision')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ slug: 'acme', email: 'admin@acme.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(mockProvisioner.provisionTenant).toHaveBeenCalledOnce()
  })

  it('returns waitlisted:true when bot pool is empty', async () => {
    const app = await buildApp()
    mockProvisioner.provisionTenant.mockResolvedValue({ success: true, waitlisted: true })

    const res = await request(app)
      .post('/admin/provision')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ slug: 'acme', email: 'admin@acme.com' })

    expect(res.status).toBe(200)
    expect(res.body.waitlisted).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/fleet/:id/terminate
// ---------------------------------------------------------------------------
describe('POST /admin/fleet/:id/terminate', () => {
  it('terminates the specified tenant', async () => {
    const app = await buildApp()
    mockProvisioner.terminateTenant.mockResolvedValue({ success: true })

    const res = await request(app)
      .post('/admin/fleet/t1/terminate')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(mockProvisioner.terminateTenant).toHaveBeenCalledWith('t1')
  })

  it('returns 500 when termination fails', async () => {
    const app = await buildApp()
    mockProvisioner.terminateTenant.mockRejectedValue(new Error('Termination failed'))

    const res = await request(app)
      .post('/admin/fleet/t1/terminate')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// GET /admin/pool
// ---------------------------------------------------------------------------
describe('GET /admin/pool', () => {
  it('returns pool stats and bot list', async () => {
    const app = await buildApp()
    mockDb.getPoolStats.mockResolvedValue({ total: 5, available: 3, assigned: 2 })
    mockDb.listBotPool.mockResolvedValue([
      { id: 'b1', status: 'available' },
      { id: 'b2', status: 'assigned', tenantId: 't1' },
    ])

    const res = await request(app)
      .get('/admin/pool')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.stats.total).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Canary group
// ---------------------------------------------------------------------------
describe('POST /admin/canary', () => {
  it('sets canary group for a tenant', async () => {
    const app = await buildApp()
    mockDb.setCanaryGroup.mockResolvedValue(undefined)

    const res = await request(app)
      .post('/admin/canary')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ tenantId: 't1', group: 'beta' })

    expect(res.status).toBe(200)
    expect(mockDb.setCanaryGroup).toHaveBeenCalledWith('t1', 'beta')
  })
})
