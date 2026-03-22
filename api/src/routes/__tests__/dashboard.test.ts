import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockDb = vi.hoisted(() => ({
  getTenantBySlug: vi.fn(),
  getTenant: vi.fn(),
  getBotForTenant: vi.fn(),
  getKeyState: vi.fn(),
  getSubscriptionStatus: vi.fn(),
  getTenantBotUsername: vi.fn(),
}))

vi.mock('../../services/db.js', () => mockDb)

async function buildApp() {
  const { default: dashboardRouter } = await import('../../routes/dashboard.js')
  const app = express()
  app.use(express.json())
  app.use('/dashboard', dashboardRouter)
  return app
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// GET /dashboard/:slug
// ---------------------------------------------------------------------------
describe('GET /dashboard/:slug', () => {
  it('returns full tenant status for a valid slug', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({
      id: 't1',
      slug: 'acme',
      status: 'active',
      email: 'admin@acme.com',
    })
    mockDb.getBotForTenant.mockResolvedValue({ id: 'b1', username: '@acme_bot' })
    mockDb.getKeyState.mockResolvedValue({ layer: 'byok', valid: true })
    mockDb.getSubscriptionStatus.mockResolvedValue({ plan: 'pro', active: true })

    const res = await request(app).get('/dashboard/acme')

    expect(res.status).toBe(200)
    expect(res.body.slug).toBe('acme')
    expect(res.body.status).toBe('active')
  })

  it('returns 404 when tenant slug does not exist', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue(null)

    const res = await request(app).get('/dashboard/nonexistent')

    expect(res.status).toBe(404)
  })

  it('includes bot info in response', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'acme', status: 'active' })
    mockDb.getBotForTenant.mockResolvedValue({ id: 'b1', username: '@acme_bot' })
    mockDb.getKeyState.mockResolvedValue({ layer: 'pool', valid: true })
    mockDb.getSubscriptionStatus.mockResolvedValue({ plan: 'starter', active: true })

    const res = await request(app).get('/dashboard/acme')

    expect(res.status).toBe(200)
    expect(res.body.bot?.id).toBe('b1')
  })

  it('includes key state in response', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'acme', status: 'active' })
    mockDb.getBotForTenant.mockResolvedValue({ id: 'b1', username: '@acme_bot' })
    mockDb.getKeyState.mockResolvedValue({ layer: 'byok', valid: true })
    mockDb.getSubscriptionStatus.mockResolvedValue({ plan: 'pro', active: true })

    const res = await request(app).get('/dashboard/acme')

    expect(res.body.keyState?.layer).toBe('byok')
  })

  it('handles suspended tenants', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'acme', status: 'suspended' })
    mockDb.getBotForTenant.mockResolvedValue(null)
    mockDb.getKeyState.mockResolvedValue(null)
    mockDb.getSubscriptionStatus.mockResolvedValue({ plan: 'pro', active: false })

    const res = await request(app).get('/dashboard/acme')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('suspended')
  })

  it('returns 500 when db lookup throws', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockRejectedValue(new Error('Connection refused'))

    const res = await request(app).get('/dashboard/acme')

    expect(res.status).toBe(500)
  })
})
