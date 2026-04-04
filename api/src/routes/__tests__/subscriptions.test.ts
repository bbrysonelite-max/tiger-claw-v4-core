import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockQuery = vi.hoisted(() => vi.fn().mockResolvedValue({ rows: [{id: 'b1'}] }))

const mockDb = vi.hoisted(() => ({
  createBYOKUser: vi.fn(),
  createBYOKBot: vi.fn(),
  getPool: vi.fn(() => ({ query: mockQuery })),
}))

const mockStripe = vi.hoisted(() => ({
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
}))

vi.mock('../../services/db.js', () => mockDb)
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function() { return mockStripe })
}))

async function buildApp() {
  const { default: subscriptionsRouter } = await import('../../routes/subscriptions.js')
  const app = express()
  app.use(express.json())
  app.use('/subscriptions', subscriptionsRouter)
  return app
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env['STRIPE_SECRET_KEY'] = 'sk_test_abc'
  process.env['STRIPE_PRICE_BYOK'] = 'price_test_byok'
  process.env['FRONTEND_URL'] = 'https://example.com'
  mockQuery.mockResolvedValue({ rows: [{id: 'b1'}] })
})

describe('POST /subscriptions/register', () => {
  it('creates a BYOK user and bot, returns botId', async () => {
    const app = await buildApp()
    mockDb.createBYOKUser.mockResolvedValue('u1')
    mockDb.createBYOKBot.mockResolvedValue('b1')

    const res = await request(app)
      .post('/subscriptions/register')
      .send({ email: 'user@example.com', name: 'Test User', niche: 'Sales' })

    expect(res.status).toBe(200)
    expect(res.body.botId).toBe('b1')
    expect(mockDb.createBYOKUser).toHaveBeenCalledWith('user@example.com', 'Test User')
    expect(mockDb.createBYOKBot).toHaveBeenCalledWith('u1', 'Test User', 'Sales')
  })

  it('returns 400 when missing required fields', async () => {
    const app = await buildApp()
    const res = await request(app)
      .post('/subscriptions/register')
      .send({ name: 'No Email' })

    expect(res.status).toBe(400)
  })
})

describe('POST /subscriptions/checkout', () => {
  it('creates a Stripe checkout session for a valid botId', async () => {
    const app = await buildApp()
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })

    const res = await request(app)
      .post('/subscriptions/checkout')
      .send({ botId: 'b1', email: 'user@example.com', name: 'User', niche: 'Test' })

    expect(res.status).toBe(200)
    expect(res.body.url).toContain('checkout.stripe.com')
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledOnce()
  })

  it('verifies botId ownership before creating session', async () => {
    const app = await buildApp()
    // Bot belongs to a different owner
    mockQuery.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/subscriptions/checkout')
      .send({ botId: 'b1', email: 'attacker@example.com', name: 'A', niche: 'B' })

    expect(res.status).toBe(403)
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('returns 400 when botId is missing', async () => {
    const app = await buildApp()
    const res = await request(app)
      .post('/subscriptions/checkout')
      .send({ email: 'user@example.com', name: 'A', niche: 'B' })

    expect(res.status).toBe(400)
  })

  it('passes metadata including botId to Stripe session', async () => {
    const app = await buildApp()
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })

    await request(app)
      .post('/subscriptions/checkout')
      .send({ botId: 'b1', email: 'user@example.com', name: 'A', niche: 'B' })

    const callArg = mockStripe.checkout.sessions.create.mock.calls[0][0]
    expect(callArg.metadata?.botId).toBe('b1')
    expect(callArg.metadata?.flavor).toBe('B')
  })
})
