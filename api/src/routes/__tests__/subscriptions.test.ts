import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockDb = vi.hoisted(() => ({
  createUser: vi.fn(),
  createBot: vi.fn(),
  getBotByOwner: vi.fn(),
  getTenantByBotId: vi.fn(),
}))

const mockStripe = vi.hoisted(() => ({
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
}))

vi.mock('../../services/db.js', () => mockDb)
vi.mock('stripe', () => ({ default: vi.fn(() => mockStripe) }))

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
  process.env['STRIPE_PRICE_ID'] = 'price_test_123'
  process.env['APP_URL'] = 'https://example.com'
})

// ---------------------------------------------------------------------------
// POST /subscriptions/register
// ---------------------------------------------------------------------------
describe('POST /subscriptions/register', () => {
  it('creates a user and bot, returns botId', async () => {
    const app = await buildApp()
    mockDb.createUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' })
    mockDb.createBot.mockResolvedValue({ id: 'b1', ownerId: 'u1' })

    const res = await request(app)
      .post('/subscriptions/register')
      .send({ email: 'user@example.com', name: 'Test User' })

    expect(res.status).toBe(200)
    expect(res.body.botId).toBe('b1')
    expect(mockDb.createUser).toHaveBeenCalledOnce()
    expect(mockDb.createBot).toHaveBeenCalledOnce()
  })

  it('returns 400 when email is missing', async () => {
    const app = await buildApp()
    const res = await request(app)
      .post('/subscriptions/register')
      .send({ name: 'No Email' })

    expect(res.status).toBe(400)
  })

  it('returns 500 when user creation fails', async () => {
    const app = await buildApp()
    mockDb.createUser.mockRejectedValue(new Error('DB error'))

    const res = await request(app)
      .post('/subscriptions/register')
      .send({ email: 'user@example.com' })

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// POST /subscriptions/checkout
// ---------------------------------------------------------------------------
describe('POST /subscriptions/checkout', () => {
  it('creates a Stripe checkout session for a valid botId', async () => {
    const app = await buildApp()
    mockDb.getBotByOwner.mockResolvedValue({ id: 'b1', ownerId: 'u1' })
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })

    const res = await request(app)
      .post('/subscriptions/checkout')
      .send({ botId: 'b1', email: 'user@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.url).toContain('checkout.stripe.com')
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledOnce()
  })

  it('verifies botId ownership before creating session', async () => {
    const app = await buildApp()
    // Bot belongs to a different owner
    mockDb.getBotByOwner.mockResolvedValue(null)

    const res = await request(app)
      .post('/subscriptions/checkout')
      .send({ botId: 'b1', email: 'attacker@example.com' })

    expect(res.status).toBe(403)
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it('returns 400 when botId is missing', async () => {
    const app = await buildApp()
    const res = await request(app)
      .post('/subscriptions/checkout')
      .send({ email: 'user@example.com' })

    expect(res.status).toBe(400)
  })

  it('passes metadata including botId to Stripe session', async () => {
    const app = await buildApp()
    mockDb.getBotByOwner.mockResolvedValue({ id: 'b1' })
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })

    await request(app)
      .post('/subscriptions/checkout')
      .send({ botId: 'b1', email: 'user@example.com' })

    const callArg = mockStripe.checkout.sessions.create.mock.calls[0][0]
    expect(callArg.metadata?.botId).toBe('b1')
  })
})
