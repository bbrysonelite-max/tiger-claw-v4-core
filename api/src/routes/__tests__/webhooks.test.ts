// Tiger Claw — webhooks.ts route tests
// Uses supertest to drive real Express requests through the router.
// Covers:
//   - POST /webhooks/telegram/:tenantId  (status gating, queue enqueueing)
//   - POST /webhooks/stripe              (missing config, bad sig, ignored events)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';

// ─── Hoist mock factories ─────────────────────────────────────────────────────
// Paths are RELATIVE TO THIS TEST FILE (not relative to webhooks.ts)
// This test is at: api/src/routes/__tests__/webhooks.test.ts
// api/src/services/db.ts     → ../../services/db.js
// api/src/services/queue.ts  → ../../services/queue.js
// api/src/routes/admin.ts    → ../admin.js
// api/src/services/pool.ts   → ../../services/pool.js

const mockGetTenant = vi.hoisted(() => vi.fn());
const mockTelegramQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'job-1' }));
const mockProvisionQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'job-2' }));
const mockLineQueueAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'job-3' }));
const mockCreateBYOKUser = vi.hoisted(() => vi.fn().mockResolvedValue('user-uuid'));
const mockCreateBYOKBot = vi.hoisted(() => vi.fn().mockResolvedValue('bot-uuid'));
const mockCreateBYOKConfig = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCreateBYOKSubscription = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendAdminAlert = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDecryptToken = vi.hoisted(() => vi.fn((s: string) => `decrypted:${s}`));
// Phase 1: Redis idempotency mocks
const mockRedisGet = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockRedisSet = vi.hoisted(() => vi.fn().mockResolvedValue('OK'));
// Phase 1: Stripe constructEvent + session retrieve mocks (shared across resets)
const mockConstructEvent = vi.hoisted(() => vi.fn());
const mockSessionsRetrieve = vi.hoisted(() => vi.fn());

// ─── Module mocks — paths relative to THIS test file ─────────────────────────

vi.mock('../../services/db.js', () => ({
  getTenant: mockGetTenant,
  createBYOKUser: mockCreateBYOKUser,
  createBYOKBot: mockCreateBYOKBot,
  createBYOKConfig: mockCreateBYOKConfig,
  createBYOKSubscription: mockCreateBYOKSubscription,
  logAdminEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/queue.js', () => ({
  provisionQueue: { add: mockProvisionQueueAdd },
  telegramQueue: { add: mockTelegramQueueAdd },
  lineQueue: { add: mockLineQueueAdd },
}));

vi.mock('../admin.js', () => ({
  sendAdminAlert: mockSendAdminAlert,
}));

vi.mock('../../services/pool.js', () => ({
  decryptToken: mockDecryptToken,
}));

// ─── Mock Stripe so the module doesn't try to connect ────────────────────────
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      webhooks: { constructEvent: mockConstructEvent },
      checkout: { sessions: { retrieve: mockSessionsRetrieve } },
    };
  }),
}));

// ─── Mock ioredis for idempotency tests ───────────────────────────────────────
// Must use regular function (not arrow) — arrow functions cannot be constructors
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      get: mockRedisGet,
      set: mockRedisSet,
    };
  }),
}));

// ─── Mock email service (imported by webhooks.ts, must not throw) ─────────────
vi.mock('../../services/email.js', () => ({
  sendStanStoreWelcome: vi.fn().mockResolvedValue(undefined),
}));

// ─── Test app factory ─────────────────────────────────────────────────────────

async function buildTestApp(): Promise<Express> {
  vi.resetModules();
  const app = express();
  // Stripe requires raw body for signature verification
  app.use('/webhooks/stripe', express.raw({ type: '*/*' }));
  app.use(express.json());
  const { default: webhooksRouter } = await import('../webhooks.js');
  app.use('/webhooks', webhooksRouter);
  return app;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACTIVE_TENANT = {
  id: 'tenant-abc-123',
  slug: 'test-tenant',
  status: 'active',
  botToken: 'bot-token-xyz',
  lineChannelSecret: undefined,
  lineChannelAccessToken: undefined,
};

const ONBOARDING_TENANT = { ...ACTIVE_TENANT, status: 'onboarding' };
const SUSPENDED_TENANT = { ...ACTIVE_TENANT, status: 'suspended' };

// ─── POST /webhooks/telegram/:tenantId ────────────────────────────────────────

describe('POST /webhooks/telegram/:tenantId', () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildTestApp();
  });

  it('returns 200 (silent ack) when tenant is not found', async () => {
    mockGetTenant.mockResolvedValue(null);

    const res = await request(app)
      .post('/webhooks/telegram/nonexistent-id')
      .send({ update_id: 1 });

    expect(res.status).toBe(200);
    expect(mockTelegramQueueAdd).not.toHaveBeenCalled();
  });

  it('returns 200 (silent ack) when tenant is suspended — no queue', async () => {
    mockGetTenant.mockResolvedValue(SUSPENDED_TENANT);

    const res = await request(app)
      .post('/webhooks/telegram/tenant-abc-123')
      .send({ update_id: 1 });

    expect(res.status).toBe(200);
    expect(mockTelegramQueueAdd).not.toHaveBeenCalled();
  });

  it('returns 200 (silent ack) when tenant is terminated — no queue', async () => {
    mockGetTenant.mockResolvedValue({ ...ACTIVE_TENANT, status: 'terminated' });

    const res = await request(app)
      .post('/webhooks/telegram/tenant-abc-123')
      .send({ update_id: 1 });

    expect(res.status).toBe(200);
    expect(mockTelegramQueueAdd).not.toHaveBeenCalled();
  });

  it('enqueues job and returns 200 for active tenant', async () => {
    mockGetTenant.mockResolvedValue(ACTIVE_TENANT);

    const payload = { message: { chat: { id: 123 }, text: 'hello' } };
    const res = await request(app)
      .post('/webhooks/telegram/tenant-abc-123')
      .send(payload);

    expect(res.status).toBe(200);
    expect(mockTelegramQueueAdd).toHaveBeenCalledWith(
      'telegram-webhook',
      expect.objectContaining({
        tenantId: 'tenant-abc-123',
        botToken: ACTIVE_TENANT.botToken,
      }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('enqueues job and returns 200 for onboarding tenant', async () => {
    mockGetTenant.mockResolvedValue(ONBOARDING_TENANT);

    const res = await request(app)
      .post('/webhooks/telegram/tenant-abc-123')
      .send({ message: { text: 'hi' } });

    expect(res.status).toBe(200);
    expect(mockTelegramQueueAdd).toHaveBeenCalled();
  });

  it('includes exponential backoff config in queue job', async () => {
    mockGetTenant.mockResolvedValue(ACTIVE_TENANT);

    await request(app)
      .post('/webhooks/telegram/tenant-abc-123')
      .send({ update_id: 99 });

    const queueCall = mockTelegramQueueAdd.mock.calls[0];
    expect(queueCall).toBeDefined();
    const opts = queueCall![2];
    expect(opts.backoff).toEqual({ type: 'exponential', delay: 2000 });
  });

  it('returns 500 when queue.add throws', async () => {
    mockGetTenant.mockResolvedValue(ACTIVE_TENANT);
    mockTelegramQueueAdd.mockRejectedValue(new Error('Redis down'));

    const res = await request(app)
      .post('/webhooks/telegram/tenant-abc-123')
      .send({ update_id: 1 });

    expect(res.status).toBe(500);
  });
});

// ─── POST /webhooks/stripe ────────────────────────────────────────────────────

describe('POST /webhooks/stripe', () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    delete process.env['STRIPE_SECRET_KEY'];
    delete process.env['STRIPE_WEBHOOK_SECRET'];
    app = await buildTestApp();
  });

  it('returns 503 when Stripe is not configured', async () => {
    // Module is cached — Stripe was initialized without a key
    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'test-sig')
      .send('{}');

    expect(res.status).toBe(503);
    expect(res.body.error).toContain('not configured');
  });
});

// ─── POST /webhooks/stripe — Phase 1 hardening ───────────────────────────────

describe('POST /webhooks/stripe — Phase 1 hardening', () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Configure Stripe so the early 503 guard passes
    process.env['STRIPE_SECRET_KEY'] = 'stripe_test_key_placeholder';
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_fake';
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    app = await buildTestApp();
  });

  afterEach(() => {
    delete process.env['STRIPE_SECRET_KEY'];
    delete process.env['STRIPE_WEBHOOK_SECRET'];
  });

  it('returns 200 with duplicate:true when session was already processed (idempotency guard)', async () => {
    // Stripe signature succeeds — returns a valid completed session event
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      id: 'evt_idem_test',
      data: { object: { id: 'cs_idem_123', payment_status: 'paid', metadata: {}, customer_details: { name: 'Test', email: 'test@example.com' } } },
    });
    // Redis says this session was already processed
    mockRedisGet.mockResolvedValue('1');

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', 'valid-sig')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
  });

  it('does NOT mark as duplicate when session is new (idempotency guard lets it through)', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      id: 'evt_new_test',
      data: { object: { id: 'cs_new_456', payment_status: 'paid', metadata: {}, customer_details: { name: 'Test', email: 'newuser@example.com' } } },
    });
    // Redis says session not yet processed
    mockRedisGet.mockResolvedValue(null);

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', 'valid-sig')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBeUndefined();
    // Redis.set must have been called to stamp this session
    expect(mockRedisSet).toHaveBeenCalledWith(
      expect.stringContaining('cs_new_456'),
      '1',
      'EX',
      expect.any(Number),
    );
  });

  it('returns 400 when Stripe signature is invalid AND fallback cannot verify session', async () => {
    // constructEvent throws — simulates real signature mismatch
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });
    // Fallback tries to fetch session from Stripe but it fails (e.g., session not found)
    mockSessionsRetrieve.mockRejectedValue(new Error('No such checkout.session'));

    const maliciousPayload = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_fake_999' } },
    });

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', 'bad-sig')
      .send(Buffer.from(maliciousPayload));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Webhook signature invalid');
  });

  it('returns 400 when Stripe signature is invalid AND retrieved session is not paid', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Signature mismatch');
    });
    // Stripe returns the session but it is not paid
    mockSessionsRetrieve.mockResolvedValue({ id: 'cs_unpaid_001', payment_status: 'unpaid' });

    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_unpaid_001' } },
    });

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', 'bad-sig')
      .send(Buffer.from(payload));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Webhook signature invalid');
  });

  it('ignores non-checkout events (returns 200, ignored:true)', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      id: 'evt_sub_del',
      data: { object: {} },
    });
    mockRedisGet.mockResolvedValue(null);

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/octet-stream')
      .set('stripe-signature', 'valid-sig')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe(true);
  });
});
