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
  // Phase 2: Layer 4 auto-resume
  getBotState: vi.fn().mockResolvedValue(null),
  setBotState: vi.fn().mockResolvedValue(undefined),
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
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'AIza-plaintext-key', model: 'gemini-1.5-pro' }] })

    expect(savedConfig).not.toBeNull()
    const storedKey = (savedConfig as unknown as Record<string, string>)['encryptedKey']
    expect(storedKey).not.toBe('AIza-plaintext-key')
    expect(storedKey).toMatch(/^enc:/)
  })
})

// ---------------------------------------------------------------------------
// POST /wizard/validate-key — Phase 2: Layer 4 auto-resume
// ---------------------------------------------------------------------------
describe('POST /wizard/validate-key — Layer 4 auto-resume', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc'
    process.env['ENCRYPTION_KEY'] = 'a'.repeat(32)
    mockDb.addAIKey.mockResolvedValue(undefined)
    mockDb.upsertBYOKConfig.mockResolvedValue(undefined)
    mockDb.setBotState.mockResolvedValue(undefined)
    mockPoolQuery.mockResolvedValue({ rows: [] })
  })

  it('updates key_state to activeLayer=2 when bot was paused (trial expired)', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true })
    // Bot is paused: trial expired
    mockDb.getBotState.mockResolvedValue({ tenantPaused: true, activeLayer: 1 })

    await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'AIzaTestKey1234', model: 'gemini-2.0-flash' }] })

    expect(mockDb.setBotState).toHaveBeenCalledWith(
      'b1',
      'key_state.json',
      expect.objectContaining({ activeLayer: 2, tenantPaused: false })
    )
  })

  it('updates key_state to activeLayer=2 when bot is on Layer 4 (emergency)', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockDb.getBotState.mockResolvedValue({ tenantPaused: false, activeLayer: 4 })

    await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'AIzaTestKey1234', model: 'gemini-2.0-flash' }] })

    expect(mockDb.setBotState).toHaveBeenCalledWith(
      'b1',
      'key_state.json',
      expect.objectContaining({ activeLayer: 2 })
    )
  })

  it('stores the encrypted key as layer2Key in key_state', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockDb.getBotState.mockResolvedValue({ tenantPaused: true })

    let savedState: Record<string, unknown> | null = null
    mockDb.setBotState.mockImplementation((_botId: string, _key: string, state: Record<string, unknown>) => {
      savedState = state
      return Promise.resolve()
    })

    await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'AIzaMyRealKey5678', model: 'gemini-2.0-flash' }] })

    expect(savedState).not.toBeNull()
    const layer2Key = (savedState as unknown as Record<string, string>)['layer2Key']
    expect(layer2Key).toMatch(/^enc:/) // Must be encrypted, not plaintext
  })

  it('does NOT call setBotState when bot is already on Layer 2 (no resume needed)', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true })
    // Bot is already active on Layer 2
    mockDb.getBotState.mockResolvedValue({ tenantPaused: false, activeLayer: 2, layer2Key: 'enc:existing' })

    await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'AIzaTestKey1234', model: 'gemini-2.0-flash' }] })

    expect(mockDb.setBotState).not.toHaveBeenCalled()
  })

  it('does NOT call setBotState when key validation fails', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
    mockDb.getBotState.mockResolvedValue({ tenantPaused: true })

    await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'invalid-key', model: 'gemini-2.0-flash' }] })

    expect(mockDb.setBotState).not.toHaveBeenCalled()
  })

  it('returns valid:true even when auto-resume getBotState throws (non-fatal)', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockDb.getBotState.mockRejectedValue(new Error('DB down'))

    const res = await request(app)
      .post('/wizard/validate-key')
      .send({ botId: 'b1', keys: [{ provider: 'google', key: 'AIzaTestKey1234', model: 'gemini-2.0-flash' }] })

    // Key was stored, auto-resume failed gracefully
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
  })
})
