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
  getBYOKStatus: vi.fn(),
  getFoundingMemberDisplay: vi.fn(),
  getHiveSignalWithFallback: vi.fn(),
}))

vi.mock('../../services/db.js', () => mockDb)

vi.mock('../../services/hiveEmitter.js', () => ({
  emitHiveEvent: vi.fn(),
  hiveAttributionLabel: vi.fn(),
}))

async function buildApp() {
  const { default: dashboardRouter } = await import('../../routes/dashboard.js')
  const app = express()
  app.use(express.json())
  app.use('/dashboard', dashboardRouter)
  return app
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env.TIGER_CLAW_API_URL = 'http://localhost'
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
      createdAt: new Date(),
    })
    mockDb.getBotForTenant.mockResolvedValue({ id: 'b1', username: '@acme_bot' })
    mockDb.getKeyState.mockResolvedValue({ layer: 'byok', valid: true })
    mockDb.getSubscriptionStatus.mockResolvedValue({ plan: 'pro', active: true })
    mockDb.getFoundingMemberDisplay.mockResolvedValue(null)
    mockDb.getHiveSignalWithFallback.mockResolvedValue(null)

    const res = await request(app).get('/dashboard/acme')

    expect(res.status).toBe(200)
    expect(res.body.tenant.slug).toBe('acme')
    expect(res.body.tenant.status).toBe('active')
  })

  it('returns 404 when tenant slug does not exist', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue(null)

    const res = await request(app).get('/dashboard/nonexistent')

    expect(res.status).toBe(404)
  })

  it('includes bot info in response', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'acme', status: 'active', createdAt: new Date() })
    mockDb.getTenantBotUsername.mockResolvedValue('acme_bot')
    mockDb.getKeyState.mockResolvedValue({ layer: 'pool', valid: true })
    mockDb.getSubscriptionStatus.mockResolvedValue({ plan: 'starter', active: true })
    mockDb.getFoundingMemberDisplay.mockResolvedValue(null)
    mockDb.getHiveSignalWithFallback.mockResolvedValue(null)

    const res = await request(app).get('/dashboard/acme')

    expect(res.status).toBe(200)
    expect(res.body.bot?.username).toBe('@acme_bot')
  })

  it('includes key state in response', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'acme', status: 'active', createdAt: new Date() })
    mockDb.getBotForTenant.mockResolvedValue({ id: 'b1', username: 'acme_bot' })
    mockDb.getBYOKStatus.mockResolvedValue({ configured: true, connectionType: 'byok' }) // using byokstatus
    mockDb.getSubscriptionStatus.mockResolvedValue({ plan: 'pro', active: true })
    mockDb.getFoundingMemberDisplay.mockResolvedValue(null)
    mockDb.getHiveSignalWithFallback.mockResolvedValue(null)

    const res = await request(app).get('/dashboard/acme')

    expect(res.body.apiKey?.connectionType).toBe('byok')
  })

  it('handles suspended tenants', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockResolvedValue({ id: 't1', slug: 'acme', status: 'suspended', createdAt: new Date() })
    mockDb.getBotForTenant.mockResolvedValue(null)
    mockDb.getKeyState.mockResolvedValue(null)
    mockDb.getSubscriptionStatus.mockResolvedValue({ plan: 'pro', active: false })
    mockDb.getFoundingMemberDisplay.mockResolvedValue(null)
    mockDb.getHiveSignalWithFallback.mockResolvedValue(null)

    const res = await request(app).get('/dashboard/acme')

    expect(res.status).toBe(200)
    expect(res.body.tenant.status).toBe('suspended')
  })

  it('returns 500 when db lookup throws', async () => {
    const app = await buildApp()
    mockDb.getTenantBySlug.mockRejectedValue(new Error('Connection refused'))

    const res = await request(app).get('/dashboard/acme')

    expect(res.status).toBe(500)
  })
})
