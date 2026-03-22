import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockDb = vi.hoisted(() => ({
  getTenant: vi.fn(),
  getHiveData: vi.fn(),
  setHiveData: vi.fn(),
  listTenants: vi.fn(),
}))

vi.mock('../../services/db.js', () => mockDb)

async function buildApp() {
  const { default: hiveRouter } = await import('../../routes/hive.js')
  const app = express()
  app.use(express.json())
  app.use('/hive', hiveRouter)
  return app
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// GET /hive/:key
// ---------------------------------------------------------------------------
describe('GET /hive/:key', () => {
  it('returns hive value for a known key', async () => {
    const app = await buildApp()
    mockDb.getHiveData.mockResolvedValue({ value: 'shared-data', updatedAt: '2026-01-01' })

    const res = await request(app).get('/hive/shared-config')

    expect(res.status).toBe(200)
    expect(res.body.value).toBe('shared-data')
  })

  it('returns 404 for an unknown hive key', async () => {
    const app = await buildApp()
    mockDb.getHiveData.mockResolvedValue(null)

    const res = await request(app).get('/hive/nonexistent-key')

    expect(res.status).toBe(404)
  })

  it('returns 500 when db throws', async () => {
    const app = await buildApp()
    mockDb.getHiveData.mockRejectedValue(new Error('DB error'))

    const res = await request(app).get('/hive/some-key')

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// POST /hive/:key
// ---------------------------------------------------------------------------
describe('POST /hive/:key', () => {
  it('stores a value under a hive key', async () => {
    const app = await buildApp()
    mockDb.setHiveData.mockResolvedValue(undefined)

    const res = await request(app)
      .post('/hive/shared-config')
      .send({ value: 'new-shared-value', tenantId: 't1' })

    expect(res.status).toBe(200)
    expect(mockDb.setHiveData).toHaveBeenCalledWith(
      'shared-config',
      expect.objectContaining({ value: 'new-shared-value' })
    )
  })

  it('returns 400 when value is missing from body', async () => {
    const app = await buildApp()

    const res = await request(app)
      .post('/hive/shared-config')
      .send({ tenantId: 't1' }) // no value

    expect(res.status).toBe(400)
  })

  it('returns 500 when db write fails', async () => {
    const app = await buildApp()
    mockDb.setHiveData.mockRejectedValue(new Error('Write failed'))

    const res = await request(app)
      .post('/hive/shared-config')
      .send({ value: 'data', tenantId: 't1' })

    expect(res.status).toBe(500)
  })
})
