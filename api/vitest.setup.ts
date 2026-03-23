import { beforeAll, vi } from 'vitest';

if (!process.env.CI) {
    vi.mock('ioredis', () => {
        const MockRedis = vi.fn().mockImplementation(function() {
            return {
                on: vi.fn(),
                get: vi.fn(),
                set: vi.fn(),
                setex: vi.fn(),
                del: vi.fn(),
                quit: vi.fn(),
                keys: vi.fn().mockResolvedValue([]),
                pipeline: vi.fn(() => ({
                    exec: vi.fn().mockResolvedValue([]),
                })),
            };
        });
        return { default: MockRedis, Redis: MockRedis };
    });

    vi.mock('bullmq', () => {
        const MockQueue = vi.fn().mockImplementation(function() {
            return {
                add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
                on: vi.fn(),
                close: vi.fn(),
            };
        });
        const MockWorker = vi.fn().mockImplementation(function() {
            return {
                on: vi.fn(),
                close: vi.fn(),
            };
        });
        return { Queue: MockQueue, Worker: MockWorker };
    });

    vi.mock('redis', () => ({
        createClient: vi.fn(() => ({
            on: vi.fn(),
            connect: vi.fn().mockResolvedValue(undefined),
            get: vi.fn(),
            set: vi.fn(),
            quit: vi.fn(),
            disconnect: vi.fn()
        }))
    }));

    // Removed pg global mock to avoid conflict with db.test.ts
}

// Inject mock environment variables globally BEFORE any test runs
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.TIGER_CLAW_API_URL = 'http://localhost:4000';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
process.env.ENCRYPTION_KEY = 'd12231134357ba94a7abfbf546ffef4142d46a1f0dcdf45f168ec225e6b17ee8';
process.env.PLATFORM_ONBOARDING_KEY = 'test_key';
process.env.PLATFORM_EMERGENCY_KEY = 'test_key';
process.env.ENABLE_WORKERS = 'true';
process.env.ADMIN_TOKEN = 'test-admin-token';
