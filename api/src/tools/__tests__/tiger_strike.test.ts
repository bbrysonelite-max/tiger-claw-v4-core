import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tiger_strike_harvest } from '../tiger_strike_harvest.js';
import { tiger_strike_draft } from '../tiger_strike_draft.js';
import { tiger_strike_engage } from '../tiger_strike_engage.js';
import { makeContext } from './helpers.js';

// Mock DB
const mockQuery = vi.fn();
vi.mock('../../services/db.js', () => ({
  getReadPool: () => ({ query: mockQuery }),
  getWritePool: () => ({ query: mockQuery }),
}));

// Mock Tenant Data
let mockTenantState: Record<string, any> = {};
vi.mock('../../services/tenant_data.js', () => ({
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
}));

// callGemini pass-through so generateContent mock works normally
vi.mock('../../services/geminiGateway.js', () => ({
  callGemini: (fn: () => Promise<unknown>) => fn(),
}));

// Mock Gemini (for drafting)
vi.mock('@google/generative-ai', () => {
  class MockModel {
    generateContent = vi.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify({ score: 85, reason: 'Test reason' }),
      },
    });
  }
  class MockGenAI {
    getGenerativeModel = vi.fn().mockReturnValue(new MockModel());
  }
  return {
    GoogleGenerativeAI: MockGenAI,
    SchemaType: {},
  };
});

describe('Tiger Strike Pipeline', () => {
  const context = makeContext(new Map(), {
    config: {
      TIGER_CLAW_TENANT_ID: 'test-tenant',
      BOT_FLAVOR: 'network-marketer',
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ONBOARDING_KEY = 'test-key';
    mockTenantState = {
      'onboard_state.json': { phase: 'complete', identity: { name: 'Test Operator' } },
    };
  });

  describe('tiger_strike_harvest', () => {
    it('fetches and queues facts', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'fact-1', domain: 'Network Marketer', confidence_score: 90, fact_summary: 'Test fact' },
        ],
      });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // for markFactsQueued

      const result = await tiger_strike_harvest.execute({ action: 'fetch' }, context);

      expect(result.ok).toBe(true);
      expect((result.data as any).facts).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('returns status summary', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total_facts: 10, unengaged_facts: 5, queued_facts: 2, engaged_facts: 2, archived_facts: 1 }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [{ domain: 'Network Marketer', count: 5 }] });

      const result = await tiger_strike_harvest.execute({ action: 'status' }, context);

      expect(result.ok).toBe(true);
      expect((result.data as any).total_facts).toBe(10);
    });
  });

  describe('tiger_strike_draft', () => {
    it('generates drafts for facts', async () => {
      const facts = [{ id: 'fact-1', domain: 'Network Marketer', confidence_score: 95, fact_summary: 'Test', source_url: 'https://reddit.com/r/test', category: 'General', entity_label: 'Prospect' }];

      // FK existence check in storeDraft
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'fact-1' }], rowCount: 1 });
      // INSERT draft
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'draft-1' }], rowCount: 1 });

      // Pass 1: Score, Pass 2: Draft (mocked above)
      const result = await tiger_strike_draft.execute({ action: 'draft', facts }, context);

      if (!result.ok) console.log('DEBUG:', result.error);
      expect(result.ok).toBe(true);
      expect((result.data as any).drafts).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalled(); // storeDraft
    });

    it('lists pending drafts', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'draft-1', status: 'pending_review' }],
      });

      const result = await tiger_strike_draft.execute({ action: 'list' }, context);

      expect(result.ok).toBe(true);
      expect((result.data as any).drafts).toHaveLength(1);
    });
  });

  describe('tiger_strike_engage', () => {
    it('generates intent links for approved drafts', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'draft-1', status: 'approved', platform: 'twitter', source_url: 'https://twitter.com/u/status/123', drafted_reply: 'Hello' }],
      });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // markDraftsEngaged

      const result = await tiger_strike_engage.execute({ action: 'generate', draft_ids: ['draft-1'] }, context);

      expect(result.ok).toBe(true);
      expect((result.data as any).links[0].intent_url).toContain('twitter.com/intent/tweet');
    });

    it('confirms engagement', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const result = await tiger_strike_engage.execute({ action: 'confirm', confirmed_ids: ['draft-1'] }, context);

      expect(result.ok).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });
  });
});
