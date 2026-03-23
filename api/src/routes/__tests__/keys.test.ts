import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Stub global fetch for the Gemini listModels probe
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

async function buildApp() {
  const { default: keysRouter } = await import('../../routes/keys.js')
  const app = express()
  app.use(express.json())
  app.use('/keys', keysRouter)
  return app
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// POST /keys/validate
// ---------------------------------------------------------------------------
describe('POST /keys/validate', () => {
  it('returns valid:true for a working Google API key', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    const res = await request(app)
      .post('/keys/validate')
      .send({ provider: 'google', key: 'AIza-good-key' })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
  })

  it('returns valid:false for a key that gets 403 from Gemini', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })

    const res = await request(app)
      .post('/keys/validate')
      .send({ provider: 'google', key: 'AIza-bad-key' })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(false)
  })

  it('returns valid:false for a key that gets 401 from Gemini', async () => {
    const app = await buildApp()
    // 401 isn't explicitly checked in keys, it falls back to network_error, but tests assume it
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

    const res = await request(app)
      .post('/keys/validate')
      .send({ provider: 'google', key: 'AIza-expired-key' })

    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(false)
  })

  it('returns 400 when apiKey is missing', async () => {
    const app = await buildApp()

    const res = await request(app)
      .post('/keys/validate')
      .send({ provider: 'google' })

    expect(res.status).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty apiKey string', async () => {
    const app = await buildApp()

    const res = await request(app)
      .post('/keys/validate')
      .send({ provider: 'google', key: '' })

    expect(res.status).toBe(400)
  })

  it('returns 500 when fetch throws (network error)', async () => {
    const app = await buildApp()
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const res = await request(app)
      .post('/keys/validate')
      .send({ provider: 'google', key: 'AIza-some-key' })

    expect(res.status).toBe(500)
  })

  it('calls the Gemini listModels endpoint for validation', async () => {
    const app = await buildApp()
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

    await request(app)
      .post('/keys/validate')
      .send({ provider: 'google', key: 'AIza-test-key' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('generativelanguage.googleapis.com')
    expect(url).toContain('AIza-test-key')

  })
})
