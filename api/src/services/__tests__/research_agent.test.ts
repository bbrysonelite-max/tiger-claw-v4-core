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

describe('runResearchAgent — campaign tagging', () => {
  it('passes campaignKey through to tiger_refine when scraping campaign posts', async () => {
    // Reddit returns one usable post so tiger_refine actually fires.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          children: [{
            data: {
              title: 'I want to work but afraid of losing my SSDI',
              selftext: 'Anyone know how this even works? I had no idea there was a program.',
              permalink: '/r/SSDI/comments/abc123/title',
              author: 'test_user_42',
            },
          }],
        },
      }),
    }) as any;

    mockTigerRefineExecute.mockResolvedValue({
      ok: true,
      data: { facts: [], rejectedCount: 0 },
    });

    const { runResearchAgent } = await import('../research_agent.js');
    await runResearchAgent(
      'run_camp_1',
      'campaign:ssdi-ticket-to-work',
      'SSDI — Ticket to Work',
      ['subreddit:SSDI return to work'],
      undefined,
      'ssdi-ticket-to-work',
    );

    // tiger_refine must receive campaignKey on its params so it can stamp
    // metadata.campaign_key on every saved fact downstream.
    expect(mockTigerRefineExecute).toHaveBeenCalledTimes(1);
    const refineParams = mockTigerRefineExecute.mock.calls[0][0];
    expect(refineParams.campaignKey).toBe('ssdi-ticket-to-work');
    expect(refineParams.domain).toBe('SSDI — Ticket to Work');
  });

  it('omits campaignKey for normal flavor runs (backwards compat)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          children: [{
            data: {
              title: 'Tired of MLM grind',
              selftext: 'Looking for something more legitimate this time.',
              permalink: '/r/antiwork/comments/xyz/title',
              author: 'flavor_test',
            },
          }],
        },
      }),
    }) as any;

    mockTigerRefineExecute.mockResolvedValue({
      ok: true,
      data: { facts: [], rejectedCount: 0 },
    });

    const { runResearchAgent } = await import('../research_agent.js');
    await runResearchAgent(
      'run_flav_1',
      'network-marketer',
      'Network Marketer',
      ['subreddit:antiwork tired'],
    );

    expect(mockTigerRefineExecute).toHaveBeenCalledTimes(1);
    const refineParams = mockTigerRefineExecute.mock.calls[0][0];
    expect(refineParams.campaignKey).toBeUndefined();
  });
});
