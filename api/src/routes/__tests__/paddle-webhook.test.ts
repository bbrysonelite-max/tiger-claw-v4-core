// Tiger Claw — POST /webhooks/paddle tests
// Lives in its own file so vi.resetModules() calls from webhooks.test.ts
// do not affect the express instance used here. Vitest runs each file in
// a fresh context — no cross-file contamination.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { createHmac } from 'crypto';

// ─── Hoist mock factories ─────────────────────────────────────────────────────

const mockCreateBYOKUser = vi.hoisted(() => vi.fn().mockResolvedValue('user-uuid'));
const mockCreateBYOKBot = vi.hoisted(() => vi.fn().mockResolvedValue('bot-uuid'));
const mockCreateBYOKSubscription = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendAdminAlert = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockRedisGet = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockRedisSet = vi.hoisted(() => vi.fn().mockResolvedValue('OK'));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../services/db.js', () => ({
  getTenant: vi.fn(),
  createBYOKUser: mockCreateBYOKUser,
  createBYOKBot: mockCreateBYOKBot,
  createBYOKConfig: vi.fn().mockResolvedValue(undefined),
  createBYOKSubscription: mockCreateBYOKSubscription,
  logAdminEvent: vi.fn().mockResolvedValue(undefined),
  getTenantByEmail: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/queue.js', () => ({
  provisionQueue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }) },
  telegramQueue: { add: vi.fn().mockResolvedValue({ id: 'job-2' }) },
  lineQueue: { add: vi.fn().mockResolvedValue({ id: 'job-3' }) },
  emailQueue: { add: vi.fn().mockResolvedValue({ id: 'job-4' }) },
}));

vi.mock('../admin.js', () => ({
  sendAdminAlert: mockSendAdminAlert,
}));

vi.mock('../../services/pool.js', () => ({
  decryptToken: vi.fn((s: string) => `decrypted:${s}`),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return { webhooks: { constructEvent: vi.fn() }, checkout: { sessions: { retrieve: vi.fn() } } };
  }),
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(function () {
    return { get: mockRedisGet, set: mockRedisSet };
  }),
}));

vi.mock('../../services/email.js', () => ({
  sendStanStoreWelcome: vi.fn().mockResolvedValue(undefined),
}));

// ─── App factory (no vi.resetModules — keeps express instance consistent) ──────

let _app: Express | null = null;

async function buildApp(): Promise<Express> {
  if (!_app) {
    const app = express();
    app.use('/webhooks/paddle', express.raw({ type: '*/*' }));
    app.use(express.json());
    const { default: webhooksRouter } = await import('../webhooks.js');
    app.use('/webhooks', webhooksRouter);
    _app = app;
  }
  return _app;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PADDLE_SECRET = 'test-paddle-secret';

const PADDLE_TXN_BODY = JSON.stringify({
  event_type: 'transaction.completed',
  data: {
    id: 'txn_test_001',
    customer: { email: 'buyer@example.com', name: 'Test Buyer' },
  },
});

function makePaddleSig(secret: string, ts: string, body: string): string {
  const h1 = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

function paddlePost(app: Express, body: string | Buffer, sig?: string) {
  const r = request(app)
    .post('/webhooks/paddle')
    .set('Content-Type', 'application/octet-stream');
  if (sig) r.set('paddle-signature', sig);
  return r.send(typeof body === 'string' ? Buffer.from(body) : body);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /webhooks/paddle', () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env['PADDLE_WEBHOOK_SECRET'] = PADDLE_SECRET;
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    app = await buildApp();
  });

  afterEach(() => {
    delete process.env['PADDLE_WEBHOOK_SECRET'];
  });

  it('returns 503 when PADDLE_WEBHOOK_SECRET is not set', async () => {
    delete process.env['PADDLE_WEBHOOK_SECRET'];
    const res = await paddlePost(app, PADDLE_TXN_BODY);
    expect(res.status).toBe(503);
  });

  it('returns 401 when Paddle-Signature header is missing', async () => {
    const res = await paddlePost(app, PADDLE_TXN_BODY);
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Missing');
  });

  it('returns 401 when signature is invalid', async () => {
    const res = await paddlePost(
      app,
      PADDLE_TXN_BODY,
      'ts=9999;h1=0000000000000000000000000000000000000000000000000000000000000000',
    );
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid signature');
  });

  it('returns 200 ignored:true for non-transaction events', async () => {
    const body = JSON.stringify({ event_type: 'subscription.updated', data: { id: 'sub_001' } });
    const sig = makePaddleSig(PADDLE_SECRET, '1234567890', body);
    const res = await paddlePost(app, body, sig);
    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe(true);
    expect(mockCreateBYOKUser).not.toHaveBeenCalled();
  });

  it('returns 200 and provisions user on valid transaction.completed', async () => {
    const sig = makePaddleSig(PADDLE_SECRET, '1234567890', PADDLE_TXN_BODY);
    const res = await paddlePost(app, PADDLE_TXN_BODY, sig);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('returns 200 duplicate:true when transaction already processed', async () => {
    mockRedisGet.mockResolvedValue('1');
    const sig = makePaddleSig(PADDLE_SECRET, '1234567890', PADDLE_TXN_BODY);
    const res = await paddlePost(app, PADDLE_TXN_BODY, sig);
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(mockCreateBYOKUser).not.toHaveBeenCalled();
  });

  it('returns 503 when Redis is unavailable (fail closed)', async () => {
    mockRedisGet.mockRejectedValue(new Error('Redis down'));
    const sig = makePaddleSig(PADDLE_SECRET, '1234567890', PADDLE_TXN_BODY);
    const res = await paddlePost(app, PADDLE_TXN_BODY, sig);
    expect(res.status).toBe(503);
    expect(mockCreateBYOKUser).not.toHaveBeenCalled();
  });

  it('returns 400 when customer email is missing', async () => {
    const body = JSON.stringify({ event_type: 'transaction.completed', data: { id: 'txn_no_email', customer: {} } });
    const sig = makePaddleSig(PADDLE_SECRET, '1234567890', body);
    const res = await paddlePost(app, body, sig);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('email');
  });
});
