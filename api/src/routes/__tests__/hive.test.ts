import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockDb = vi.hoisted(() => ({
  queryHivePatterns: vi.fn(),
  insertHivePattern: vi.fn(),
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
  process.env['TIGER_CLAW_HIVE_TOKEN'] = 'test-hive-token'
})

// ---------------------------------------------------------------------------
// GET /hive/patterns
// ---------------------------------------------------------------------------
describe('GET /hive/patterns', () => {
  it('returns patterns matching query', async () => {
    const app = await buildApp()
    mockDb.queryHivePatterns.mockResolvedValue([
      { id: 1, flavor: 'test', region: 'us', category: 'objection', observation: 'They said no', dataPoints: 1, confidence: 50, submittedAt: new Date() }
    ])

    const res = await request(app)
      .get('/hive/patterns?flavor=test')
      .set('x-hive-token', 'test-hive-token')

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(1)
    expect(res.body.patterns[0].observation).toBe('They said no')
  })

  it('returns 400 if flavor is missing', async () => {
    const app = await buildApp()

    const res = await request(app)
      .get('/hive/patterns')
      .set('x-hive-token', 'test-hive-token')

    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /hive/patterns
// ---------------------------------------------------------------------------
describe('POST /hive/patterns', () => {
  it('stores a pattern', async () => {
    const app = await buildApp()
    mockDb.insertHivePattern.mockResolvedValue({ id: 123, submittedAt: new Date() })

    const res = await request(app)
      .post('/hive/patterns')
      .set('x-hive-token', 'test-hive-token')
      .send({ flavor: 'test', region: 'us', category: 'objection', observation: 'They said perhaps' })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe(123)
  })

  it('returns 400 when missing fields', async () => {
    const app = await buildApp()

    const res = await request(app)
      .post('/hive/patterns')
      .set('x-hive-token', 'test-hive-token')
      .send({ flavor: 'test' }) // missing others

    expect(res.status).toBe(400)
  })

  it('rejects PII with 422', async () => {
    const app = await buildApp()

    const res = await request(app)
      .post('/hive/patterns')
      .set('x-hive-token', 'test-hive-token')
      .send({ flavor: 'test', region: 'us', category: 'obj', observation: 'Call John Doe at 555-123-4567' })

    expect(res.status).toBe(422)
    expect(res.body.piiDetected).toContain('phone number')
  })
})
