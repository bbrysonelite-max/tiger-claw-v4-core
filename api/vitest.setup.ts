import { beforeAll } from 'vitest';

beforeAll(() => {
    // Inject mock environment variables globally BEFORE any test runs
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.TIGER_CLAW_API_URL = 'http://localhost:4000';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
    process.env.ENCRYPTION_KEY = 'd12231134357ba94a7abfbf546ffef4142d46a1f0dcdf45f168ec225e6b17ee8';
    process.env.PLATFORM_ONBOARDING_KEY = 'test_key';
    process.env.PLATFORM_EMERGENCY_KEY = 'test_key';
});
