import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock IORedis first to avoid connection issues during import
vi.mock('ioredis', () => {
    return {
        default: vi.fn(),
    };
});

const processors = vi.hoisted(() => ({
    telegram: null as any,
    line: null as any,
    routine: null as any,
    cron: null as any,
}));

vi.mock('bullmq', () => {
    return {
        Queue: vi.fn().mockImplementation(function() {
            return { add: vi.fn().mockResolvedValue(true) };
        }),
        Worker: vi.fn().mockImplementation(function(name, processor, options) {
            if (name === 'telegram-webhooks') processors.telegram = processor;
            if (name === 'line-webhooks') processors.line = processor;
            if (name === 'ai-routines') processors.routine = processor;
            if (name === 'global-cron') processors.cron = processor;
            return {
                on: vi.fn(),
            };
        }),
    };
});

// Mock dependencies called by the workers
const mockProcessTelegramMessage = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const mockProcessLINEMessage = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const mockProcessSystemRoutine = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('../ai.js', () => ({
    processTelegramMessage: mockProcessTelegramMessage,
    processLINEMessage: mockProcessLINEMessage,
    processSystemRoutine: mockProcessSystemRoutine,
}));

const mockQuery = vi.hoisted(() => vi.fn().mockResolvedValue({ rows: [] }));
vi.mock('../db.js', () => ({
    getPool: vi.fn(() => ({ query: mockQuery })),
    getTenantBotUsername: vi.fn(),
}));

// Now safely import queue (which triggers the mocks and captures the processors)
import { telegramQueue, lineQueue, routineQueue, cronQueue } from '../queue.js';
// (Need a clean import that doesn't trigger unmocked stuff, dynamic import of our module handles the execution of top-level code)

describe('queue.ts workers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('telegramWorker', () => {
        it('bails out and returns success:false if botToken is missing', async () => {
             const job = { data: { tenantId: 't1', payload: {} } };
             const result = await processors.telegram(job);
             expect(result.success).toBe(false);
             expect(result.error).toBe("Missing botToken");
             expect(mockProcessTelegramMessage).not.toHaveBeenCalled();
        });

        it('skips processing and returns skipped:true if message has no text', async () => {
             const job = { data: { tenantId: 't1', botToken: 'token1', payload: { message: { chat: { id: 123 } } } } };
             const result = await processors.telegram(job);
             expect(result.success).toBe(true);
             expect(result.skipped).toBe(true);
             expect(mockProcessTelegramMessage).not.toHaveBeenCalled();
        });

        it('delegates valid text messages to processTelegramMessage', async () => {
             const job = { data: { tenantId: 't1', botToken: 'token1', payload: { message: { text: 'Hello', chat: { id: 123 } } } } };
             const result = await processors.telegram(job);
             expect(result.success).toBe(true);
             expect(mockProcessTelegramMessage).toHaveBeenCalledWith('t1', 'token1', 123, 'Hello');
        });
    });

    describe('lineWorker', () => {
        it('delegates to processLINEMessage', async () => {
            const job = { data: { tenantId: 't1', encryptedChannelAccessToken: 'enc1', userId: 'u1', text: 'Hi LINE' } };
            const result = await processors.line(job);
            expect(result.success).toBe(true);
            expect(mockProcessLINEMessage).toHaveBeenCalledWith('t1', 'enc1', 'u1', 'Hi LINE');
        });
    });

    describe('routineWorker', () => {
        it('delegates to processSystemRoutine', async () => {
            const job = { data: { tenantId: 't1', routineType: 'daily_scout' } };
            const result = await processors.routine(job);
            expect(result.success).toBe(true);
            expect(mockProcessSystemRoutine).toHaveBeenCalledWith('t1', 'daily_scout');
        });
    });

    describe('cronWorker', () => {
        it('queries active tenants and enqueues nurture check for each', async () => {
            mockQuery.mockResolvedValue({ rows: [{ id: 'tenant-1' }, { id: 'tenant-2' }] });
            
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

            await processors.cron();

            // Should have queried active tenants
            expect(mockQuery).toHaveBeenCalledWith("SELECT id FROM tenants WHERE status = 'active'");
            
            expect(routineQueue.add).toHaveBeenCalledTimes(2);
            expect(routineQueue.add).toHaveBeenCalledWith('nurture_check', expect.objectContaining({ tenantId: 'tenant-1' }), expect.any(Object));

            vi.useRealTimers();
        });

        it('includes daily_scout routine when hour is exactly 7 UTC', async () => {
            mockQuery.mockResolvedValue({ rows: [{ id: 'tenant-1' }] });
            
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-01T07:00:00Z'));

            await processors.cron();
            
            // Enqueues BOTH nurture_check and daily_scout
            expect(routineQueue.add).toHaveBeenCalledTimes(2);
            expect(routineQueue.add).toHaveBeenCalledWith('nurture_check', expect.any(Object), expect.any(Object));
            expect(routineQueue.add).toHaveBeenCalledWith('daily_scout', expect.any(Object), expect.any(Object));

            vi.useRealTimers();
        });
    });
});
