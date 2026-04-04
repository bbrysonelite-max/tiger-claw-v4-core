import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Stub global fetch for the Gemini listModels probe
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockVerifySessionToken = vi.hoisted(() => vi.fn())

// Mock verifySessionToken so tests don't need a real HMAC session
vi.mock('../../routes/auth.js', () => ({
  verifySessionToken: mockVerifySessionToken,
  default: { post: vi.fn() },
}))

const VALID_SESSION = 'test-session-token'

let app: express.Express

beforeEach(async () => {
  vi.resetAllMocks()
  vi.stubGlobal('fetch', mockFetch)
  mockVerifySessionToken.mockReturnValue({ email: 'test@example.com', botId: 'bot-1', userId: 'user-1', expires: Date.now() + 86400000 })
  const { default: keysRouter } = await import('../../routes/keys.js')
  app = express()
  app.use(express.json())
  app.use('/keys', keysRouter)
})

async function buildApp() {
  return app
}

// ---------------------------------------------------------------------------
// POST /keys/validate
// ---------------------------------------------------------------------------
describe('POST /keys/validate', () => {
  it('returns 401 without a session token', async () => {
    mockVerifySessionToken.mockReturnValueOnce(null)
    const app = await buildApp()
    const res = await request(app)
      .post('/keys/validate')
      .send({ provider: 'google', key: 'GAPI-good-key' })
    expect(res.status).toBe(401)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns valid:true for a working Google API key', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const res = await request(app)
      .post('/keys/validate')
      .set('x-session-token', VALID_SESSION)
      .send({ provider: 'google', key: 'GAPI-good-key' })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
  })

  it('returns valid:false for a key that gets 403 from Gemini', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })

    const res = await request(app)
      .post('/keys/validate')
      .set('x-session-token', VALID_SESSION)
      .send({ provider: 'google', key: 'GAPI-bad-key' })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(false)
  })

  it('returns valid:false for a key that gets 401 from Gemini', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

    const res = await request(app)
      .post('/keys/validate')
      .set('x-session-token', VALID_SESSION)
      .send({ provider: 'google', key: 'GAPI-expired-key' })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(false)
  })

  it('returns 400 when apiKey is missing', async () => {
    const app = await buildApp()

    const res = await request(app)
      .post('/keys/validate')
      .set('x-session-token', VALID_SESSION)
      .send({ provider: 'google' })

    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty apiKey string', async () => {
    const app = await buildApp()

    const res = await request(app)
      .post('/keys/validate')
      .set('x-session-token', VALID_SESSION)
      .send({ provider: 'google', key: '' })

    expect(res.status).toBe(400)
  })

  it('returns 500 when fetch throws (network error)', async () => {
    const app = await buildApp()
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const res = await request(app)
      .post('/keys/validate')
      .set('x-session-token', VALID_SESSION)
      .send({ provider: 'google', key: 'GAPI-some-key' })

    expect(res.status).toBe(500)
  })

  it('calls the Gemini listModels endpoint with key in header, not URL', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    await request(app)
      .post('/keys/validate')
      .set('x-session-token', VALID_SESSION)
      .send({ provider: 'google', key: 'GAPI-test-key' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('generativelanguage.googleapis.com')
    expect(url).not.toContain('GAPI-test-key') // key must NOT be in URL
    expect(options?.headers?.['x-goog-api-key']).toBe('GAPI-test-key')
  })
})
