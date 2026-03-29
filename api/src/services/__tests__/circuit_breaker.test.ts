import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAIProvider } from '../ai.js';
import * as db from '../db.js';
import IORedis from 'ioredis';

// Mock Redis
const mockRedisInstance = vi.hoisted(() => ({
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    incrby: vi.fn(),
    hincrby: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
    keys: vi.fn().mockResolvedValue([]),
}));

vi.mock('ioredis', () => {
    return {
        default: class {
            constructor() { return mockRedisInstance; }
            get = mockRedisInstance.get;
            set = mockRedisInstance.set;
            incr = mockRedisInstance.incr;
            incrby = mockRedisInstance.incrby;
            hincrby = mockRedisInstance.hincrby;
            expire = mockRedisInstance.expire;
            del = mockRedisInstance.del;
            keys = mockRedisInstance.keys;
        },
    };
});

// Mock pool.js
vi.mock('../pool.js', () => ({
    decryptToken: vi.fn((t) => t.startsWith('enc:') ? t.replace('enc:', '') : t),
}));

// Mock DB functions
vi.mock('../db.js', () => {
    return {
        getTenant: vi.fn(),
        getPool: vi.fn(() => ({
            query: vi.fn(),
        })),
        getReadPool: vi.fn(() => ({
            query: vi.fn(),
        })),
        getWritePool: vi.fn(() => ({
            query: vi.fn(),
        })),
        getBotState: vi.fn().mockResolvedValue(null),
        setBotState: vi.fn(),
        decryptToken: vi.fn((t) => t.startsWith('enc:') ? t.replace('enc:', '') : t),
        sendAdminAlert: vi.fn(),
    };
});

describe('Gemini Circuit Breaker', () => {
    const tenantId = 'test-tenant-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolveAIProvider returns OpenRouter when Gemini circuit is tripped', async () => {
        // 1. Setup circuit trip in Redis
        mockRedisInstance.get.mockImplementation((key: string) => {
            if (key.includes('tripped')) return Promise.resolve('1');
            return Promise.resolve(null);
        });

        // 2. Mock bot_ai_config to have both Gemini and OpenRouter
        vi.mocked(db.getPool).mockReturnValue({
            query: vi.fn().mockResolvedValue({
                rows: [
                    { provider: 'google', model: 'gemini-2.0-flash', encrypted_key: 'enc:gemini-key' },
                    { provider: 'openrouter', model: 'openai/gpt-4o', encrypted_key: 'enc:or-key' },
                ]
            }),
        } as any);

        // 3. Resolve provider
        const provider = await resolveAIProvider(tenantId);

        // 4. Verify it picked OpenRouter
        expect(provider?.provider).toBe('openai');
        expect(provider?.baseURL).toContain('openrouter.ai');
        expect(provider?.key).toBe('or-key');
    });

    it('resolveAIProvider returns Gemini when circuit is NOT tripped', async () => {
        // 1. Circuit NOT tripped
        mockRedisInstance.get.mockResolvedValue(null);

        // 2. Mock bot_ai_config
        vi.mocked(db.getPool).mockReturnValue({
            query: vi.fn().mockResolvedValue({
                rows: [
                    { provider: 'google', model: 'gemini-2.0-flash', encrypted_key: 'enc:gemini-key' },
                ]
            }),
        } as any);

        // 3. Resolve provider
        const provider = await resolveAIProvider(tenantId);

        // 4. Verify Gemini
        expect(provider?.provider).toBe('google');
        expect(provider?.key).toBe('gemini-key');
    });
});
