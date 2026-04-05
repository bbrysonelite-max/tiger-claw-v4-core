import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockDb = vi.hoisted(() => ({
  getTenant: vi.fn(),
  getTenantBySlug: vi.fn(),
  updateTenantStatus: vi.fn(),
  updateTenantChannelConfig: vi.fn(),
  logAdminEvent: vi.fn(),
}))

const mockQueue = vi.hoisted(() => ({
  routineQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  },
}))

vi.mock('../../services/db.js', () => mockDb)
vi.mock('../../services/queue.js', () => mockQueue)

async function buildApp() {
  const { default: tenantsRouter } = await import('../../routes/tenants.js')
  const app = express()
  app.use(express.json())
  app.use('/tenants', tenantsRouter)
  return app
}

const ADMIN_TOKEN = 'test-admin-token-32-chars-xxxxxxxx'

beforeEach(() => {
  vi.resetAllMocks()
  process.env['ADMIN_TOKEN'] = ADMIN_TOKEN
})

describe('PATCH /tenants/:id/status', () => {
  it('updates status of an active tenant', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1', status: 'pending' })
    mockDb.updateTenantStatus.mockResolvedValue(undefined)

    const res = await request(app).patch('/tenants/t1/status').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ status: 'active' })
    expect(res.status).toBe(200)
    expect(mockDb.updateTenantStatus).toHaveBeenCalledWith('t1', 'active')
  })

  it('returns 400 for invalid status', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1' })

    const res = await request(app).patch('/tenants/t1/status').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ status: 'unknown_status' })
    expect(res.status).toBe(400)
  })
})

describe('POST /tenants/:id/scout', () => {
  it('enqueues a scout job for a tenant', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1', slug: 'tenant-1' })

    const res = await request(app).post('/tenants/t1/scout').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ trigger: 'manual' })
    expect(res.status).toBe(200)
    expect(mockQueue.routineQueue.add).toHaveBeenCalled()
  })
})

describe('POST /tenants/:id/keys/activate', () => {
  it('deactivates onboarding key for a tenant', async () => {
    const app = await buildApp()
    mockDb.getTenant.mockResolvedValue({ id: 't1' })

    const res = await request(app).post('/tenants/t1/keys/activate').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({ action: 'deactivate_onboarding_key' })
    expect(res.status).toBe(200)
  })
})

describe('GET /tenants/:slug/channels', () => {
  it('returns channel config', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', whatsappEnabled: true, lineChannelSecret: 'sec', lineChannelAccessToken: 'tok' })

    const res = await request(app).get('/tenants/slug1/channels')
    expect(res.status).toBe(200)
    expect(res.body.whatsapp).toBe(true)
    expect(res.body.line).toBe(true)
  })
})

describe('POST /tenants/:slug/channels/whatsapp', () => {
  it('updates whatsapp config', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1' })

    const res = await request(app).post('/tenants/slug1/channels/whatsapp').send({ enabled: true })
    expect(res.status).toBe(200)
    expect(mockDb.updateTenantChannelConfig).toHaveBeenCalledWith('t1', { whatsappEnabled: true })
  })
})

describe('POST /tenants/:slug/channels/line', () => {
  it('updates line config', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1' })

    const res = await request(app).post('/tenants/slug1/channels/line').send({ channelSecret: 'sec', channelAccessToken: 'tok' })
    expect(res.status).toBe(200)
    expect(mockDb.updateTenantChannelConfig).toHaveBeenCalledWith('t1', expect.any(Object))
  })
})
