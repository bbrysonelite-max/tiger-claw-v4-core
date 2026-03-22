import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockDb = vi.hoisted(() => ({
  getTenant: vi.fn(),
  updateTenantStatus: vi.fn(),
}))

const mockProvisioner = vi.hoisted(() => ({
  suspendTenant: vi.fn(),
  resumeTenant: vi.fn(),
}))

const mockQueue = vi.hoisted(() => ({
  scoutQueue: {
    add: vi.fn(),
  },
}))

vi.mock('../../services/db.js', () => mockDb)
vi.mock('../../services/provisioner.js', () => mockProvisioner)
vi.mock('../../services/queue.js', () => mockQueue)

async function buildApp() {
  const { default: tenantsRouter } = await import('../../routes/tenants.js')
  const app = express()
  app.use(express.json())
  app.use('/tenants', tenantsRouter)
  return app
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// PATCH /tenants/:id/status
// ---------------------------------------------------------------------------
describe('PATCH /tenants/:id/status', () => {
  it('suspends an active tenant', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1', status: 'active' })
    mockProvisioner.suspendTenant.mockResolvedValue({ success: true })

    const res = await request(app)
      .patch('/tenants/t1/status')
      .send({ status: 'suspended' })

    expect(res.status).toBe(200)
    expect(mockProvisioner.suspendTenant).toHaveBeenCalledWith('t1')
  })

  it('resumes a suspended tenant', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1', status: 'suspended' })
    mockProvisioner.resumeTenant.mockResolvedValue({ success: true })

    const res = await request(app)
      .patch('/tenants/t1/status')
      .send({ status: 'active' })

    expect(res.status).toBe(200)
    expect(mockProvisioner.resumeTenant).toHaveBeenCalledWith('t1')
  })

  it('returns 404 when tenant does not exist', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue(null)

    const res = await request(app)
      .patch('/tenants/missing/status')
      .send({ status: 'suspended' })

    expect(res.status).toBe(404)
  })

  it('returns 400 for an invalid status value', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1', status: 'active' })

    const res = await request(app)
      .patch('/tenants/t1/status')
      .send({ status: 'obliterated' })

    expect(res.status).toBe(400)
  })

  it('returns 500 when provisioner throws', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1', status: 'active' })
    mockProvisioner.suspendTenant.mockRejectedValue(new Error('Provisioner unavailable'))

    const res = await request(app)
      .patch('/tenants/t1/status')
      .send({ status: 'suspended' })

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// POST /tenants/:id/scout
// ---------------------------------------------------------------------------
describe('POST /tenants/:id/scout', () => {
  it('enqueues a scout job for an active tenant', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1', status: 'active', slug: 'acme' })
    mockQueue.scoutQueue.add.mockResolvedValue({ id: 'job-1' })

    const res = await request(app)
      .post('/tenants/t1/scout')
      .send({ target: 'https://example.com' })

    expect(res.status).toBe(202)
    expect(mockQueue.scoutQueue.add).toHaveBeenCalledOnce()
  })

  it('returns 404 when tenant does not exist', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue(null)

    const res = await request(app)
      .post('/tenants/missing/scout')
      .send({ target: 'https://example.com' })

    expect(res.status).toBe(404)
  })

  it('rejects scout for suspended tenant', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1', status: 'suspended' })

    const res = await request(app)
      .post('/tenants/t1/scout')
      .send({ target: 'https://example.com' })

    expect(res.status).toBe(403)
    expect(mockQueue.scoutQueue.add).not.toHaveBeenCalled()
  })
})
