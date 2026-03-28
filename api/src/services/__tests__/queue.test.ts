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
    getBotState: vi.fn(),
    setBotState: vi.fn(),
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
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT id, created_at"));
            
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

        // Phase 2: per-tenant error isolation
        it('continues processing other tenants when one tenant fails (error isolation)', async () => {
            const tenants = [
                { id: 'tenant-ok-1', created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
                { id: 'tenant-bad', created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
                { id: 'tenant-ok-2', created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
            ];
            mockQuery.mockResolvedValue({ rows: tenants });

            // getBotState throws for tenant-bad only
            const { getBotState } = await import('../db.js');
            (getBotState as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({})           // tenant-ok-1
                .mockRejectedValueOnce(new Error('DB timeout')) // tenant-bad → throws
                .mockResolvedValueOnce({});          // tenant-ok-2

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

            // Should NOT throw — per-tenant isolation catches the error
            await expect(processors.cron()).resolves.toBeUndefined();

            // tenant-ok-1 and tenant-ok-2 still got their nurture checks
            const nurtureCalls = (routineQueue.add as ReturnType<typeof vi.fn>).mock.calls
                .filter((call: any[]) => call[0] === 'nurture_check');
            expect(nurtureCalls.length).toBe(2); // only 2 of 3 tenants (bad one failed before add)

            vi.useRealTimers();
        });

        // Phase 2: trial reminder dedup via BullMQ jobId
        it('fires trial_reminder_24h with correct jobId for dedup', async () => {
            const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
            mockQuery.mockResolvedValue({ rows: [{ id: 'tenant-trial', created_at: createdAt }] });

            // No layer2Key, no h24 reminder sent yet
            const { getBotState } = await import('../db.js');
            (getBotState as ReturnType<typeof vi.fn>).mockResolvedValue({ trialRemindersSent: {} });

            vi.useFakeTimers();
            vi.setSystemTime(new Date());

            await processors.cron();

            // Trial reminder was enqueued with the correct dedup jobId
            expect(routineQueue.add).toHaveBeenCalledWith(
                'trial_reminder_24h',
                expect.objectContaining({ tenantId: 'tenant-trial', routineType: 'trial_reminder_24h' }),
                expect.objectContaining({ jobId: 'trial_reminder_24h_tenant-trial' })
            );

            vi.useRealTimers();
        });

        it('does NOT re-fire trial_reminder_24h when already sent (dedup via state)', async () => {
            const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
            mockQuery.mockResolvedValue({ rows: [{ id: 'tenant-trial', created_at: createdAt }] });

            // h24 already sent
            const { getBotState } = await import('../db.js');
            (getBotState as ReturnType<typeof vi.fn>).mockResolvedValue(
                { trialRemindersSent: { h24: true } }
            );

            vi.useFakeTimers();
            vi.setSystemTime(new Date());

            await processors.cron();

            // No trial reminder should have been added
            const trialCalls = (routineQueue.add as ReturnType<typeof vi.fn>).mock.calls
                .filter((call: any[]) => call[0] === 'trial_reminder_24h');
            expect(trialCalls.length).toBe(0);

            vi.useRealTimers();
        });

        // ── Value-gap detection tests (CLAUDE.md mandate) ─────────────────────

        it('enqueues value_gap_checkin at 9 AM UTC for tenants with no leads in 7 days', async () => {
            // First call: main tenant query. Second call: value-gap sub-query returns a row (tenant IS in gap).
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'tenant-gap', created_at: new Date().toISOString() }] })
                .mockResolvedValueOnce({ rows: [{ 1: 1 }] }); // gap query returns a row

            const { getBotState } = await import('../db.js');
            (getBotState as ReturnType<typeof vi.fn>).mockResolvedValue({ layer2Key: 'key', trialRemindersSent: {} });

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-01T09:00:00Z'));

            await processors.cron();

            const gapCalls = (routineQueue.add as ReturnType<typeof vi.fn>).mock.calls
                .filter((call: any[]) => call[0] === 'value_gap_checkin');
            expect(gapCalls.length).toBe(1);
            expect(gapCalls[0][1]).toMatchObject({ tenantId: 'tenant-gap', routineType: 'value_gap_checkin' });
            // jobId must be date-stamped for dedup
            expect(gapCalls[0][2]).toMatchObject({ jobId: 'value_gap_tenant-gap_2024-01-01' });

            vi.useRealTimers();
        });

        it('does NOT enqueue value_gap_checkin when tenant has a recent lead', async () => {
            // First call: main tenant query. Second call: value-gap query returns no rows (no gap).
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'tenant-healthy', created_at: new Date().toISOString() }] })
                .mockResolvedValueOnce({ rows: [] }); // no gap

            const { getBotState } = await import('../db.js');
            (getBotState as ReturnType<typeof vi.fn>).mockResolvedValue({ layer2Key: 'key', trialRemindersSent: {} });

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-01T09:00:00Z'));

            await processors.cron();

            const gapCalls = (routineQueue.add as ReturnType<typeof vi.fn>).mock.calls
                .filter((call: any[]) => call[0] === 'value_gap_checkin');
            expect(gapCalls.length).toBe(0);

            vi.useRealTimers();
        });

        it('does NOT enqueue value_gap_checkin outside of 9 AM UTC hour', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'tenant-gap', created_at: new Date().toISOString() }] });

            const { getBotState } = await import('../db.js');
            (getBotState as ReturnType<typeof vi.fn>).mockResolvedValue({ layer2Key: 'key', trialRemindersSent: {} });

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-01T10:00:00Z')); // 10 AM, not 9

            await processors.cron();

            const gapCalls = (routineQueue.add as ReturnType<typeof vi.fn>).mock.calls
                .filter((call: any[]) => call[0] === 'value_gap_checkin');
            expect(gapCalls.length).toBe(0);

            vi.useRealTimers();
        });

        it('continues cron cycle when value-gap DB query throws (error isolation)', async () => {
            // First call: main tenant query. Second call: value-gap query throws.
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 'tenant-gap', created_at: new Date().toISOString() }] })
                .mockRejectedValueOnce(new Error('DB timeout'));

            const { getBotState } = await import('../db.js');
            (getBotState as ReturnType<typeof vi.fn>).mockResolvedValue({ layer2Key: 'key', trialRemindersSent: {} });

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-01T09:00:00Z'));

            // Must not throw — inner try/catch isolates the gap query failure
            await expect(processors.cron()).resolves.toBeUndefined();

            // nurture_check still enqueued despite the gap error
            const nurtureCalls = (routineQueue.add as ReturnType<typeof vi.fn>).mock.calls
                .filter((call: any[]) => call[0] === 'nurture_check');
            expect(nurtureCalls.length).toBe(1);

            vi.useRealTimers();
        });
    });
});
