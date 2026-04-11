import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks for db.js (logAdminEvent) and orchestrator (reportResearchComplete)
// ---------------------------------------------------------------------------
const mockLogAdminEvent = vi.hoisted(() => vi.fn());
const mockReportResearchComplete = vi.hoisted(() => vi.fn());
const mockIsAlreadyMined = vi.hoisted(() => vi.fn());
const mockTigerRefineExecute = vi.hoisted(() => vi.fn());

vi.mock('../db.js', () => ({
  logAdminEvent: mockLogAdminEvent,
}));

vi.mock('../orchestrator.js', () => ({
  reportResearchComplete: mockReportResearchComplete,
}));

vi.mock('../market_intel.js', () => ({
  isAlreadyMined: mockIsAlreadyMined,
}));

vi.mock('../../tools/tiger_refine.js', () => ({
  tiger_refine: { execute: mockTigerRefineExecute },
}));

// ---------------------------------------------------------------------------
// Mock global fetch so fetchReddit returns empty Reddit results deterministically
// ---------------------------------------------------------------------------
const originalFetch = global.fetch;

beforeEach(() => {
  vi.resetAllMocks();
  // Clear Oxylabs env so fetchReddit takes the direct Reddit path.
  delete process.env['OXYLABS_USERNAME'];
  delete process.env['OXYLABS_PASSWORD'];

  // Reddit direct fetch → empty children array → parseRedditPosts returns [].
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { children: [] } }),
  }) as any;

  mockIsAlreadyMined.mockResolvedValue(false);
  mockLogAdminEvent.mockResolvedValue(undefined);
  mockReportResearchComplete.mockResolvedValue(undefined);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('runResearchAgent — per-query metrics', () => {
  it('emits one mine_query_metrics event per scoutQuery with full counter shape', async () => {
    const { runResearchAgent } = await import('../research_agent.js');

    const queries = [
      'subreddit:antiwork tired of this job',
      'subreddit:careerguidance ready for a change',
      'subreddit:findapath stuck in my job',
    ];

    const result = await runResearchAgent(
      'run_test_abc',
      'network-marketer',
      'Network Marketer',
      queries,
    );

    // One metrics event per query — even though posts came back empty,
    // the zero-signal is still worth logging so dead subs are visible.
    expect(mockLogAdminEvent).toHaveBeenCalledTimes(queries.length);

    for (let i = 0; i < queries.length; i++) {
      const call = mockLogAdminEvent.mock.calls[i];
      expect(call[0]).toBe('mine_query_metrics');
      expect(call[1]).toBeUndefined();
      const details = call[2];
      expect(details.runId).toBe('run_test_abc');
      expect(details.flavor).toBe('network-marketer');
      expect(details.displayName).toBe('Network Marketer');
      expect(details.query).toBe(queries[i]);
      expect(details.posts).toBe(0);
      expect(details.factsKept).toBe(0);
      expect(details.factsRejected).toBe(0);
      expect(details.duplicates).toBe(0);
      expect(typeof details.durationMs).toBe('number');
    }

    // Run-level counters should also reflect the empty result.
    expect(result.factsSaved).toBe(0);
    expect(result.factsRejected).toBe(0);
    expect(result.postsFound).toBe(0);
  });

  it('still reports to orchestrator even when all queries return zero posts', async () => {
    const { runResearchAgent } = await import('../research_agent.js');

    await runResearchAgent(
      'run_test_xyz',
      'network-marketer',
      'Network Marketer',
      ['subreddit:findapath stuck'],
    );

    expect(mockReportResearchComplete).toHaveBeenCalledWith('run_test_xyz', 0);
  });
});
