// Tiger Claw — ai.ts unit tests
// Covers the critical bugs that caused production failures:
//   1. History role invariant (getChatHistory / saveChatHistory)
//   2. System prompt content (buildSystemPrompt)
//   3. Key resolution (resolveGoogleKey)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoist mock factories so vi.mock factories can reference them ─────────────
const mockRedisGet = vi.hoisted(() => vi.fn());
const mockRedisSet = vi.hoisted(() => vi.fn());
const mockFsExistsSync = vi.hoisted(() => vi.fn());
const mockFsReadFileSync = vi.hoisted(() => vi.fn());
const mockFsMkdirSync = vi.hoisted(() => vi.fn());
const mockGetBotState = vi.hoisted(() => vi.fn());
const mockDbQuery = vi.hoisted(() => vi.fn());
const mockDecryptToken = vi.hoisted(() => vi.fn((s: string) => `decrypted:${s}`));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(function () {
    return { get: mockRedisGet, set: mockRedisSet };
  }),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: mockFsExistsSync,
    readFileSync: mockFsReadFileSync,
    mkdirSync: mockFsMkdirSync,
  };
});

vi.mock('../db.js', () => ({
  getTenant: vi.fn(),
  getPool: vi.fn(() => ({ query: mockDbQuery })),
  getBotState: mockGetBotState,
  setBotState: vi.fn(),
}));

vi.mock('../pool.js', () => ({
  decryptToken: mockDecryptToken,
}));

const mockGetTenantState = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock('../tenant_data.js', () => ({
  getTenantState: mockGetTenantState,
  saveTenantState: vi.fn(),
}));

vi.mock('../../tools/flavorConfig.js', () => ({
  loadFlavorConfig: vi.fn(() => ({
    name: 'Network Marketer',
    professionLabel: 'Independent Distributor',
    defaultKeywords: ['MLM', 'network', 'recruiter', 'business', 'opportunity', 'team', 'grow', 'leader'],
  })),
}));

// Mock all 19 tools so the module loads without error
vi.mock('../../tools/tiger_onboard.js', () => ({ tiger_onboard: { name: 'tiger_onboard', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_scout.js', () => ({ tiger_scout: { name: 'tiger_scout', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_contact.js', () => ({ tiger_contact: { name: 'tiger_contact', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_aftercare.js', () => ({ tiger_aftercare: { name: 'tiger_aftercare', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_briefing.js', () => ({ tiger_briefing: { name: 'tiger_briefing', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_convert.js', () => ({ tiger_convert: { name: 'tiger_convert', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_export.js', () => ({ tiger_export: { name: 'tiger_export', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_hive.js', () => ({ tiger_hive: { name: 'tiger_hive', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_import.js', () => ({ tiger_import: { name: 'tiger_import', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_keys.js', () => ({ tiger_keys: { name: 'tiger_keys', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_lead.js', () => ({ tiger_lead: { name: 'tiger_lead', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_move.js', () => ({ tiger_move: { name: 'tiger_move', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_note.js', () => ({ tiger_note: { name: 'tiger_note', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_nurture.js', () => ({ tiger_nurture: { name: 'tiger_nurture', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_objection.js', () => ({ tiger_objection: { name: 'tiger_objection', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_score.js', () => ({ tiger_score: { name: 'tiger_score', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_score_1to10.js', () => ({ tiger_score_1to10: { name: 'tiger_score_1to10', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_search.js', () => ({ tiger_search: { name: 'tiger_search', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('../../tools/tiger_settings.js', () => ({ tiger_settings: { name: 'tiger_settings', description: '', parameters: {}, execute: vi.fn() } }));
vi.mock('node-telegram-bot-api', () => ({ default: vi.fn(() => ({ sendMessage: vi.fn(), sendChatAction: vi.fn() })) }));
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      startChat: vi.fn(() => ({
        sendMessage: vi.fn().mockResolvedValue({ response: { text: () => 'ok', functionCalls: () => [], candidates: [] } }),
        getHistory: vi.fn().mockResolvedValue([]),
      })),
    })),
  })),
  SchemaType: { STRING: 'STRING', NUMBER: 'NUMBER', INTEGER: 'INTEGER', BOOLEAN: 'BOOLEAN', ARRAY: 'ARRAY', OBJECT: 'OBJECT' },
}));

// Import AFTER all mocks are defined
import { getChatHistory, saveChatHistory, buildSystemPrompt, resolveGoogleKey, startFocus, completeFocus, incrementFocusToolCalls } from '../ai.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'test-tenant-uuid-1234';
const CHAT_ID = 9999;
const WORKDIR = '/tmp/test-workdir';

function makeHistory(roles: string[]) {
  return roles.map((role) => ({
    role,
    parts: [{ text: `message from ${role}` }],
  }));
}

// ─── getChatHistory ───────────────────────────────────────────────────────────

describe('getChatHistory', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();
  });

  it('returns [] when Redis has no entry (null)', async () => {
    mockRedisGet.mockResolvedValue(null);
    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result).toEqual([]);
  });

  it('returns history as-is when it starts with user role', async () => {
    const history = makeHistory(['user', 'model', 'user', 'model']);
    mockRedisGet.mockResolvedValue(JSON.stringify(history));
    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result).toHaveLength(4);
    expect(result[0]!.role).toBe('user');
  });

  it('trims leading model entries until first user role', async () => {
    const history = makeHistory(['model', 'user', 'model']);
    mockRedisGet.mockResolvedValue(JSON.stringify(history));
    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result).toHaveLength(2);
    expect(result[0]!.role).toBe('user');
  });

  it('trims leading function entries until first user role (the production bug)', async () => {
    // This is the exact bug: after 20-turn trim, function role could appear at index 0
    // Gemini throws: "First content should be with role 'user', got function"
    const history = makeHistory(['function', 'model', 'user', 'model', 'user']);
    mockRedisGet.mockResolvedValue(JSON.stringify(history));
    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result[0]!.role).toBe('user');
    expect(result).toHaveLength(3);
  });

  it('returns [] when history has no user entry at all', async () => {
    const history = makeHistory(['model', 'function', 'model']);
    mockRedisGet.mockResolvedValue(JSON.stringify(history));
    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result).toEqual([]);
  });

  it('returns [] and does not throw on malformed JSON in Redis', async () => {
    mockRedisGet.mockResolvedValue('THIS IS NOT JSON{{{');
    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result).toEqual([]);
  });

  it('returns [] and does not throw when Redis.get rejects', async () => {
    mockRedisGet.mockRejectedValue(new Error('Redis connection refused'));
    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result).toEqual([]);
  });
});

// ─── saveChatHistory ─────────────────────────────────────────────────────────

describe('saveChatHistory', () => {
  const MAX_TURNS = 20; // MAX_HISTORY_TURNS constant from ai.ts

  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset().mockResolvedValue('OK');
  });

  it('calls Redis set with 7-day TTL', async () => {
    const history = makeHistory(['user', 'model']);
    await saveChatHistory(TENANT_ID, CHAT_ID, history);
    expect(mockRedisSet).toHaveBeenCalledWith(
      `chat_history:${TENANT_ID}:${CHAT_ID}`,
      expect.any(String),
      'EX',
      86400 * 7,
    );
  });

  it('stores the correct key pattern', async () => {
    const history = makeHistory(['user', 'model']);
    await saveChatHistory(TENANT_ID, CHAT_ID, history);
    const [key] = mockRedisSet.mock.calls[0]!;
    expect(key).toBe(`chat_history:${TENANT_ID}:${CHAT_ID}`);
  });

  it('keeps last MAX_TURNS * 2 entries when history is long', async () => {
    // Create 50 entries (25 user + 25 model alternating)
    const roles = Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? 'user' : 'model'));
    const history = makeHistory(roles);
    await saveChatHistory(TENANT_ID, CHAT_ID, history);

    const saved = JSON.parse(mockRedisSet.mock.calls[0]![1] as string);
    expect(saved.length).toBeLessThanOrEqual(MAX_TURNS * 2);
  });

  it('ensures trimmed history starts at a user role boundary (prevents Gemini role error)', async () => {
    // Build a history of 45 entries where the 26th entry from the end is 'model'
    // This simulates what happens after a 20-turn trim cuts mid-exchange.
    const roles = [
      'user', 'model', 'function', 'model', // some tool exchange
      ...Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 'user' : 'model')),
    ];
    const history = makeHistory(roles);
    await saveChatHistory(TENANT_ID, CHAT_ID, history);

    const saved = JSON.parse(mockRedisSet.mock.calls[0]![1] as string);
    expect(saved[0].role).toBe('user');
  });
});

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  const mockTenant = {
    id: TENANT_ID,
    name: 'Brent Bryson',
    flavor: 'network-marketer',
    language: 'English',
    region: 'sea',
  };

  beforeEach(() => {
    mockGetBotState.mockReset().mockResolvedValue(null);
    mockDbQuery.mockReset().mockResolvedValue({ rows: [] });
    mockGetTenantState.mockReset().mockResolvedValue(null);
  });

  it('includes the tenant name', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('Brent Bryson');
  });

  it('includes the LOCKED lead scoring threshold of 80', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('80');
    expect(prompt).toContain('LOCKED');
  });

  it('includes the ONBOARDING RULE section', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('ONBOARDING RULE');
  });

  it('requires tiger_onboard action=status on EVERY message', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('tiger_onboard');
    expect(prompt).toContain('status');
    expect(prompt).toContain('EVERY incoming user message');
  });

  it('contains accurately relay instruction (prevents ICP summary paraphrase bug)', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('accurately');
  });

  it('includes flavor name from loadFlavorConfig', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('Network Marketer');
  });

  it('includes the tenant language', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('English');
  });

  it('blocks switching to normal operation before onboarding is complete', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('Do NOT switch to prospecting');
    expect(prompt).toContain('isComplete=true');
  });

  it('includes INTELLIGENCE BRIEFING with operator profile when onboarding is complete', async () => {
    mockGetBotState.mockResolvedValue({
      phase: 'complete',
      identity: {
        name: 'Jane Doe',
        productOrOpportunity: 'NuSkin wellness line',
        biggestWin: '$10k month',
        differentiator: 'unique reorder rate',
      },
      icpBuilder: { idealPerson: 'Health-conscious moms', problemFaced: 'Fatigue', confirmed: true },
      icpCustomer: {},
      icpSingle: {},
    });
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('INTELLIGENCE BRIEFING');
    expect(prompt).toContain('OPERATOR PROFILE');
    expect(prompt).toContain('Jane Doe');
    expect(prompt).toContain('NuSkin wellness line');
    expect(prompt).toContain('Health-conscious moms');
  });

  it('includes hive pattern bullets when hive_signals exist', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [{ signal_type: 'objection', payload: { observation: 'Trust is the #1 blocker in SEA' }, sample_size: 420 }],
      })
      .mockResolvedValueOnce({ rows: [] }); // lead stats
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('NETWORK INTELLIGENCE');
    expect(prompt).toContain('Trust is the #1 blocker');
    expect(prompt).toContain('n=420');
  });

  it('includes pipeline stats when tenant has leads', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [] }) // hive patterns
      .mockResolvedValueOnce({ rows: [{ total: '47', qualified: '12' }] }); // lead stats
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('PIPELINE');
    expect(prompt).toContain('47');
    expect(prompt).toContain('12');
  });

  it('includes recent fact anchors in the INTELLIGENCE BRIEFING', async () => {
    mockGetTenantState.mockResolvedValue({
      lastExtractedAt: new Date().toISOString(),
      icpUpdates: [{ value: 'Prospect must be actively building a team', extractedAt: new Date().toISOString() }],
      objectionsRaised: [{ value: 'Too expensive for Thailand market', extractedAt: new Date().toISOString() }],
      preferencesStated: [{ value: 'Prefers shorter follow-up messages', extractedAt: new Date().toISOString() }],
      productMentioned: [],
      hotLeadsMentioned: [],
    });
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('Recent ICP signal');
    expect(prompt).toContain('actively building a team');
    expect(prompt).toContain('Last objection raised');
    expect(prompt).toContain('Too expensive');
    expect(prompt).toContain('Stated preference');
    expect(prompt).toContain('shorter follow-up');
  });

  it('omits INTELLIGENCE BRIEFING section entirely when DB is unreachable', async () => {
    mockGetBotState.mockRejectedValue(new Error('DB timeout'));
    mockDbQuery.mockRejectedValue(new Error('DB timeout'));
    const prompt = await buildSystemPrompt(mockTenant);
    // Static prompt still returns — no crash
    expect(prompt).toContain('Brent Bryson');
    expect(prompt).toContain('ONBOARDING RULE');
    expect(prompt).not.toContain('INTELLIGENCE BRIEFING');
  });
});

// ─── getChatHistory — memory blob injection ───────────────────────────────────

describe('getChatHistory — Sawtooth memory injection', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();
  });

  it('prepends synthetic memory pair when chat_memory blob exists', async () => {
    const history = makeHistory(['user', 'model']);
    // First get = chat_history, second get = chat_memory
    mockRedisGet
      .mockResolvedValueOnce(JSON.stringify(history))
      .mockResolvedValueOnce(JSON.stringify({ summary: 'Operator sells NuSkin. ICP: health-conscious moms.', compressedAt: '2024-01-01T00:00:00Z', turnsCompressed: 10 }));

    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result).toHaveLength(4); // 2 memory + 2 real
    expect(result[0]!.role).toBe('user');
    expect((result[0]!.parts[0] as any).text).toContain('[CONVERSATION MEMORY');
    expect((result[1]!.parts[0] as any).text).toContain('NuSkin');
    expect(result[2]!.role).toBe('user');
  });

  it('returns history without memory pair when no chat_memory key exists', async () => {
    const history = makeHistory(['user', 'model']);
    mockRedisGet
      .mockResolvedValueOnce(JSON.stringify(history))
      .mockResolvedValueOnce(null);

    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result).toHaveLength(2);
    expect((result[0]!.parts[0] as any).text).not.toContain('[CONVERSATION MEMORY');
  });

  it('ignores malformed chat_memory blob without crashing', async () => {
    const history = makeHistory(['user', 'model']);
    mockRedisGet
      .mockResolvedValueOnce(JSON.stringify(history))
      .mockResolvedValueOnce('NOT VALID JSON{{');

    const result = await getChatHistory(TENANT_ID, CHAT_ID);
    expect(result).toHaveLength(2);
  });
});

// ─── saveChatHistory — Sawtooth compression trigger ──────────────────────────

describe('saveChatHistory — Sawtooth compression', () => {
  const MAX_TURNS = 20;

  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset().mockResolvedValue('OK');
  });

  it('does NOT trigger compression when history is at or below the threshold', async () => {
    // Exactly at threshold — no compression
    const roles = Array.from({ length: MAX_TURNS * 2 }, (_, i) => (i % 2 === 0 ? 'user' : 'model'));
    await saveChatHistory(TENANT_ID, CHAT_ID, makeHistory(roles));
    // Only the chat_history set call — no extra Redis set for chat_memory yet
    // (compression is async fire-and-forget; Gemini mock not called means no compression attempt)
    expect(mockRedisSet).toHaveBeenCalledTimes(1);
    const [key] = mockRedisSet.mock.calls[0]!;
    expect(key).toBe(`chat_history:${TENANT_ID}:${CHAT_ID}`);
  });

  it('triggers compression when history exceeds threshold', async () => {
    // 50 entries — 10 will be "dropped" (50 - 40 = 10)
    const roles = Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? 'user' : 'model'));
    await saveChatHistory(TENANT_ID, CHAT_ID, makeHistory(roles));
    // The chat_history Redis set still happens synchronously
    expect(mockRedisSet).toHaveBeenCalledWith(
      `chat_history:${TENANT_ID}:${CHAT_ID}`,
      expect.any(String),
      'EX',
      86400 * 7,
    );
    // Trimmed result starts at user boundary and is within limit
    const saved = JSON.parse(mockRedisSet.mock.calls[0]![1] as string);
    expect(saved.length).toBeLessThanOrEqual(MAX_TURNS * 2);
    expect(saved[0].role).toBe('user');
  });
});

// ─── Phase 4: Focus primitives ────────────────────────────────────────────────

describe('focus primitives', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset().mockResolvedValue('OK');
  });

  it('startFocus writes focus_state to Redis with status=active', async () => {
    await startFocus(TENANT_ID, CHAT_ID);
    expect(mockRedisSet).toHaveBeenCalledWith(
      `focus_state:${TENANT_ID}:${CHAT_ID}`,
      expect.stringContaining('"status":"active"'),
      'EX',
      86400,
    );
  });

  it('startFocus does not throw when Redis set fails', async () => {
    mockRedisSet.mockRejectedValue(new Error('Redis timeout'));
    await expect(startFocus(TENANT_ID, CHAT_ID)).resolves.toBeDefined();
  });

  it('incrementFocusToolCalls increments the counter', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify({
      focusId: 'f1', startedAt: new Date().toISOString(), toolCallsSinceStart: 3, status: 'active',
    }));
    await incrementFocusToolCalls(TENANT_ID, CHAT_ID);
    const saved = JSON.parse(mockRedisSet.mock.calls[0]![1] as string);
    expect(saved.toolCallsSinceStart).toBe(4);
  });

  it('incrementFocusToolCalls is a no-op when focus_state does not exist', async () => {
    mockRedisGet.mockResolvedValue(null);
    await expect(incrementFocusToolCalls(TENANT_ID, CHAT_ID)).resolves.toBeUndefined();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('completeFocus does NOT trigger compression below threshold', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify({
      focusId: 'f1', startedAt: new Date().toISOString(), toolCallsSinceStart: 5, status: 'active',
    }));
    const history = makeHistory(Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 'user' : 'model')));
    await completeFocus(TENANT_ID, CHAT_ID, history);
    // Only one Redis set call — for writing status=complete (not compression)
    const saved = JSON.parse(mockRedisSet.mock.calls[0]![1] as string);
    expect(saved.status).toBe('complete');
  });

  it('completeFocus is a no-op when focus_state does not exist', async () => {
    mockRedisGet.mockResolvedValue(null);
    await expect(completeFocus(TENANT_ID, CHAT_ID, [])).resolves.toBeUndefined();
    expect(mockRedisSet).not.toHaveBeenCalled();
  });
});

// ─── resolveGoogleKey ─────────────────────────────────────────────────────────

describe('resolveGoogleKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFsMkdirSync.mockReturnValue(undefined);
    // Default: no DB BYOK config found
    mockDbQuery.mockResolvedValue({ rows: [] });
    // Default env
    process.env['PLATFORM_ONBOARDING_KEY'] = 'platform-layer1-key';
    process.env['PLATFORM_EMERGENCY_KEY'] = 'platform-layer4-key';
    process.env['GOOGLE_API_KEY'] = 'google-fallback-key';
  });

  afterEach(() => {
    delete process.env['PLATFORM_ONBOARDING_KEY'];
    delete process.env['PLATFORM_EMERGENCY_KEY'];
    delete process.env['GOOGLE_API_KEY'];
  });

  it('returns PLATFORM_ONBOARDING_KEY for layer 1', async () => {
    mockGetBotState.mockResolvedValue({ activeLayer: 1 });

    const key = await resolveGoogleKey(TENANT_ID);
    expect(key).toBe('platform-layer1-key');
  });

  it('returns PLATFORM_EMERGENCY_KEY for layer 4 (emergency fallback)', async () => {
    mockGetBotState.mockResolvedValue({ activeLayer: 4 });

    const key = await resolveGoogleKey(TENANT_ID);
    expect(key).toBe('platform-layer4-key');
  });

  it('decrypts and returns layer2Key for layer 2', async () => {
    mockGetBotState.mockResolvedValue({
      activeLayer: 2,
      layer2Key: 'enc:some-encrypted-key',
    });

    const key = await resolveGoogleKey(TENANT_ID);
    expect(mockDecryptToken).toHaveBeenCalledWith('enc:some-encrypted-key');
    expect(key).toBe('decrypted:enc:some-encrypted-key');
  });

  it('returns undefined and does not throw when layer2Key is missing (logs ALERT)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetBotState.mockResolvedValue({ activeLayer: 2 }); // no layer2Key

    const key = await resolveGoogleKey(TENANT_ID);
    expect(key).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('layer2Key'),
    );
    consoleSpy.mockRestore();
  });

  it('returns undefined when tenantPaused=true in key_state', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetBotState.mockResolvedValue({ activeLayer: 1, tenantPaused: true });

    const key = await resolveGoogleKey(TENANT_ID);
    expect(key).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('paused'));
    consoleSpy.mockRestore();
  });

  it('falls back to PLATFORM_ONBOARDING_KEY when no key_state.json exists', async () => {
    mockGetBotState.mockResolvedValue(null); // no key_state.json

    const key = await resolveGoogleKey(TENANT_ID);
    expect(key).toBe('platform-layer1-key');
  });

  it('falls back to GOOGLE_API_KEY when PLATFORM_ONBOARDING_KEY not set', async () => {
    delete process.env['PLATFORM_ONBOARDING_KEY'];
    mockGetBotState.mockResolvedValue(null);

    const key = await resolveGoogleKey(TENANT_ID);
    expect(key).toBe('google-fallback-key');
  });

  it('does not throw and logs alert when key_state.json has invalid JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetBotState.mockRejectedValue(new Error('SyntaxError: Unexpected token'));

    const key = await resolveGoogleKey(TENANT_ID);
    // Falls through to env var after failed parse
    expect(key).toBe('platform-layer1-key');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[AI] [ALERT]'), expect.any(String));
    consoleSpy.mockRestore();
  });
});
