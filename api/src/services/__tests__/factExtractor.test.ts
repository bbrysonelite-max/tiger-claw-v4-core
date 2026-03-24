import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
const mockGetTenantState = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const mockSaveTenantState = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetChatHistory = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock('../tenant_data.js', () => ({
    getTenantState: mockGetTenantState,
    saveTenantState: mockSaveTenantState,
}));

vi.mock('../ai.js', () => ({
    getChatHistory: mockGetChatHistory,
}));

vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn(function() {
        return {
            getGenerativeModel: vi.fn(() => ({
                generateContent: mockGenerateContent,
            })),
        };
    }),
}));

import { extractFactAnchors } from '../factExtractor.js';

const TENANT_ID = 'fact-test-tenant';
const CHAT_ID = 42;

function makeHistory(pairs: Array<{ role: string; text: string }>) {
    return pairs.map(({ role, text }) => ({
        role,
        parts: [{ text }],
    }));
}

describe('extractFactAnchors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env['PLATFORM_ONBOARDING_KEY'] = 'platform-key';
    });

    it('merges extracted facts into existing tenant_states', async () => {
        mockGetChatHistory.mockResolvedValue(makeHistory([
            { role: 'user', text: 'I sell NuSkin ageLOC products' },
            { role: 'model', text: 'Got it, NuSkin ageLOC is great for Thailand.' },
        ]));
        mockGenerateContent.mockResolvedValue({
            response: { text: () => '{"productMentioned":"NuSkin ageLOC"}' },
        });
        mockGetTenantState.mockResolvedValue(null); // no existing anchors

        await extractFactAnchors(TENANT_ID, CHAT_ID);

        expect(mockSaveTenantState).toHaveBeenCalledWith(
            TENANT_ID,
            'fact_anchors',
            expect.objectContaining({
                productMentioned: expect.arrayContaining([
                    expect.objectContaining({ value: 'NuSkin ageLOC' }),
                ]),
            }),
        );
    });

    it('merges into existing anchors without overwriting unrelated keys', async () => {
        mockGetChatHistory.mockResolvedValue(makeHistory([
            { role: 'user', text: 'My prospect prefers WhatsApp over Telegram' },
            { role: 'model', text: 'Noted, will use WhatsApp for outreach.' },
        ]));
        mockGenerateContent.mockResolvedValue({
            response: { text: () => '{"preferenceStated":"WhatsApp over Telegram"}' },
        });
        mockGetTenantState.mockResolvedValue({
            lastExtractedAt: '2024-01-01T00:00:00Z',
            productMentioned: [{ value: 'NuSkin ageLOC', extractedAt: '2024-01-01T00:00:00Z' }],
            icpUpdates: [],
            objectionsRaised: [],
            preferencesStated: [],
            hotLeadsMentioned: [],
        });

        await extractFactAnchors(TENANT_ID, CHAT_ID);

        const saved = mockSaveTenantState.mock.calls[0]![2] as any;
        // Existing productMentioned preserved
        expect(saved.productMentioned).toHaveLength(1);
        expect(saved.productMentioned[0].value).toBe('NuSkin ageLOC');
        // New preference added
        expect(saved.preferencesStated).toHaveLength(1);
        expect(saved.preferencesStated[0].value).toBe('WhatsApp over Telegram');
    });

    it('does not call saveTenantState when Gemini returns non-JSON', async () => {
        mockGetChatHistory.mockResolvedValue(makeHistory([
            { role: 'user', text: 'Just checking in' },
            { role: 'model', text: 'Sure, how can I help?' },
        ]));
        mockGenerateContent.mockResolvedValue({
            response: { text: () => 'No specific facts found in this conversation.' },
        });

        await extractFactAnchors(TENANT_ID, CHAT_ID);

        expect(mockSaveTenantState).not.toHaveBeenCalled();
    });

    it('does not throw and skips silently when getChatHistory returns empty', async () => {
        mockGetChatHistory.mockResolvedValue([]);

        await expect(extractFactAnchors(TENANT_ID, CHAT_ID)).resolves.toBeUndefined();
        expect(mockGenerateContent).not.toHaveBeenCalled();
        expect(mockSaveTenantState).not.toHaveBeenCalled();
    });

    it('does not throw when Gemini call rejects', async () => {
        mockGetChatHistory.mockResolvedValue(makeHistory([
            { role: 'user', text: 'hello' },
            { role: 'model', text: 'hi' },
        ]));
        mockGenerateContent.mockRejectedValue(new Error('API quota exceeded'));

        await expect(extractFactAnchors(TENANT_ID, CHAT_ID)).resolves.toBeUndefined();
        expect(mockSaveTenantState).not.toHaveBeenCalled();
    });

    it('skips the synthetic [CONVERSATION MEMORY] pair when extracting', async () => {
        mockGetChatHistory.mockResolvedValue([
            { role: 'user', parts: [{ text: '[CONVERSATION MEMORY — prior session context]' }] },
            { role: 'model', parts: [{ text: 'Some old summary here.' }] },
            { role: 'user', parts: [{ text: 'I want to target gym owners' }] },
            { role: 'model', parts: [{ text: 'Great ICP signal.' }] },
        ]);
        mockGenerateContent.mockResolvedValue({
            response: { text: () => '{"icpUpdate":"gym owners"}' },
        });

        await extractFactAnchors(TENANT_ID, CHAT_ID);

        // Should have been called — memory pair filtered, real turns processed
        expect(mockGenerateContent).toHaveBeenCalled();
        const callArg: string = mockGenerateContent.mock.calls[0]![0];
        expect(callArg).not.toContain('[CONVERSATION MEMORY');
        expect(callArg).toContain('gym owners');
    });
});
