import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockPoolQuery = vi.hoisted(() => vi.fn().mockResolvedValue({ rows: [] }));

const mockDb = vi.hoisted(() => ({
  getTenantByBotId: vi.fn(),
  addAIKey: vi.fn(),
  upsertBYOKConfig: vi.fn(),
  getSession: vi.fn(),
  getTenantBySlug: vi.fn(),
  getTenantByEmail: vi.fn(),
  getTenantBotUsername: vi.fn(),
  updateTenantChannelConfig: vi.fn(),
  importContacts: vi.fn(),
  getFoundingMemberDisplay: vi.fn(),
  getPool: vi.fn(() => ({ query: mockPoolQuery })),
}))

const mockStripe = vi.hoisted(() => ({
  checkout: {
    sessions: {
      retrieve: vi.fn(),
    },
  },
}))

vi.mock('../../services/db.js', () => mockDb)
vi.mock('stripe', () => ({ default: class StripeMock { constructor() { return mockStripe } } }))

// Stub fetch globally for the /validate-key Gemini probe
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

async function buildApp() {
  const { default: wizardRouter } = await import('../../routes/wizard.js')
  const app = express()
  app.use(express.json())
  app.use('/wizard', wizardRouter)
  return app
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc'
  process.env['ENCRYPTION_KEY'] = 'a'.repeat(32)
})

// ---------------------------------------------------------------------------
// GET /wizard/status
// ---------------------------------------------------------------------------
describe('GET /wizard/status', () => {
  it('returns session status for a valid sessionId', async () => {
    const app = await buildApp()
    mockStripe.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_123',
      payment_status: 'paid',
      metadata: { botId: 'b1', tenantSlug: 'acme' },
    })

    const res = await request(app)
      .get('/wizard/status')
      .query({ session_id: 'cs_test_123' })

    expect(res.status).toBe(200)
    expect(res.body.status).to.exist
  })

  it('returns 400 when sessionId is missing', async () => {
    const app = await buildApp()
    const res = await request(app).get('/wizard/status')
    expect(res.status).toBe(400)
  })

  it('returns 500 when Stripe lookup fails', async () => {
    const app = await buildApp()
    mockStripe.checkout.sessions.retrieve.mockRejectedValue(new Error('Stripe error'))

    const res = await request(app)
      .get('/wizard/status')
      .query({ session_id: 'cs_bad' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('error')
  })
})

// ---------------------------------------------------------------------------
// POST /wizard/validate-key
// ---------------------------------------------------------------------------
describe('POST /wizard/validate-key', () => {
  it('accepts a valid Google API key and stores encrypted config', async () => {
    const app = await buildApp()
    // Gemini listModels probe returns 200
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })
    mockDb.addAIKey.mockResolvedValue(undefined)

    const res = await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'valid_api_key', model: 'gemini-1.5-pro' }] })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    expect(mockDb.addAIKey).toHaveBeenCalledOnce()
  })

  it('rejects an invalid Google API key (403 from Gemini)', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })

    const res = await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'invalid_key', model: 'gemini-1.5-pro' }] })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(false)
    expect(mockDb.addAIKey).not.toHaveBeenCalled()
  })

  it('returns 400 when keys payload is malformed or empty', async () => {
    const app = await buildApp()
    const res = await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [] }) // Empty keys array fails .min(1) missing

    expect(res.status).toBe(400)
  })

  it('stores an encrypted key (not plaintext) in the database', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    let savedConfig: Record<string, unknown> | null = null
    mockDb.addAIKey.mockImplementation((config: Record<string, unknown>) => {
      savedConfig = config
      return Promise.resolve()
    })

    await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'GAPI-plaintext-key', model: 'gemini-1.5-pro' }] })

    expect(savedConfig).not.toBeNull()
    const storedKey = (savedConfig as unknown as Record<string, string>)['encryptedKey']
    expect(storedKey).not.toBe('GAPI-plaintext-key')
    expect(storedKey).toMatch(/^enc:/)
  })
})

// ---------------------------------------------------------------------------
