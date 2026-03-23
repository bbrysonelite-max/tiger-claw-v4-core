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

  it('returns waitlisted:true when bot pool is empty', async () => {
    const app = await buildApp()
    mockProvisioner.provisionTenant.mockResolvedValue({ success: true, waitlisted: true })

    const res = await request(app)
      .post('/admin/provision')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)
      .send({ slug: 'acme', name: 'Acme Corp', flavor: 'default', region: 'us', language: 'en', preferredChannel: 'telegram' })

    expect(res.status).toBe(201)
    expect(res.body.waitlisted).toBe(true)
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
// GET /admin/pool/status
// ---------------------------------------------------------------------------
describe('GET /admin/pool/status', () => {
  it('returns pool stats', async () => {
    const app = await buildApp()
    mockDb.getPoolStats.mockResolvedValue({ total: 5, unassigned: 3, assigned: 2 })

    const res = await request(app)
      .get('/admin/pool/status')
      .set('Authorization', `Bearer ${VALID_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(5)
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

