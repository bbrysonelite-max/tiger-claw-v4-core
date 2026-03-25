// Tiger Claw — ai.ts unit tests
// Covers the critical bugs that caused production failures:
//   1. History role invariant (getChatHistory / saveChatHistory)
//   2. System prompt content (buildSystemPrompt)

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

vi.mock('../../tools/flavorConfig.js', () => ({
  loadFlavorConfig: vi.fn(() => ({
    name: 'Network Marketer',
    professionLabel: 'Independent Distributor',
    defaultKeywords: ['MLM', 'network', 'recruiter', 'business', 'opportunity', 'team', 'grow', 'leader'],
  })),
}));

vi.mock('../self-improvement.js', () => ({
  loadApprovedSkills: vi.fn().mockResolvedValue([]),
  draftSkillFromFailure: vi.fn().mockResolvedValue(null),
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
import { getChatHistory, saveChatHistory, buildSystemPrompt, buildFirstMessageText } from '../ai.js';

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
  };

  it('includes the tenant name', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('Brent Bryson');
  });

  it('includes the LOCKED lead scoring threshold of 80', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('80');
    expect(prompt).toContain('LOCKED');
  });

  it('includes the ONBOARDING section', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('ONBOARDING');
    expect(prompt).toContain('tiger_onboard');
  });

  it('allows organic conversation — does not force tiger_onboard on every message', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('tiger_onboard');
    expect(prompt).toContain('organic conversation');
  });

  it('contains CRITICAL telemetry instruction', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('CRITICAL');
    expect(prompt).toContain('tiger_keys');
  });

  it('includes flavor name from loadFlavorConfig', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('Network Marketer');
  });

  it('includes the tenant language', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('English');
  });

  it('instructs bot to allow free conversation when onboarding is not active', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('organic conversation');
    expect(prompt).toContain('GLOBAL DIRECTIVE');
  });

  // ── Item 1: routing table removed, judgment-based prompt ──────────────────

  it('does NOT contain keyword→tool routing arrows (routing table removed)', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    // The old routing table used " → call " patterns — these must be gone
    expect(prompt).not.toContain('→ call tiger_scout');
    expect(prompt).not.toContain('→ call tiger_briefing');
    expect(prompt).not.toContain('→ call tiger_contact');
    expect(prompt).not.toContain('→ call tiger_search');
  });

  it('contains judgment-based tool instruction (not a keyword dispatcher)', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    expect(prompt).toContain('TOOL JUDGMENT');
    expect(prompt).toContain('instruments of your judgment');
  });

  it('contains proactive onboarding invitation for incomplete setup', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    // Bot must proactively invite operator to calibrate — not wait passively
    expect(prompt).toContain('5 minutes');
    expect(prompt).toContain('calibrate');
  });

  it('warm market phrase is banned in prompt', async () => {
    const prompt = await buildSystemPrompt(mockTenant);
    // Anti-churn: warm market banned
    expect(prompt).toContain('warm market');   // appears in banned list
    expect(prompt).not.toContain('work their warm market'); // never as instruction
  });
});

// ─── buildFirstMessageText (first-message onboarding nudge) ──────────────────

describe('buildFirstMessageText', () => {
  it('injects SYSTEM nudge when onboarding incomplete and first message', () => {
    const result = buildFirstMessageText('hello', false, true);
    expect(result).toContain('[SYSTEM');
    expect(result).toContain('calibrate');
    expect(result).toContain('tiger_onboard');
    expect(result).toContain('hello');
  });

  it('preserves the operator original message inside the nudge', () => {
    const result = buildFirstMessageText('what can you do?', false, true);
    expect(result).toContain('what can you do?');
  });

  it('returns plain text when onboarding is complete', () => {
    const result = buildFirstMessageText('find me leads', true, true);
    expect(result).toBe('find me leads');
    expect(result).not.toContain('[SYSTEM');
  });

  it('returns plain text when not the first message (history exists)', () => {
    const result = buildFirstMessageText('follow up', false, false);
    expect(result).toBe('follow up');
    expect(result).not.toContain('[SYSTEM');
  });

  it('returns plain text when both onboarding complete and not first message', () => {
    const result = buildFirstMessageText('scan for leads', true, false);
    expect(result).toBe('scan for leads');
  });
});
