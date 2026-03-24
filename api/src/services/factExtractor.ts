/**
 * factExtractor.ts — Phase 3 of the Hybrid Cognitive Memory Architecture
 *
 * After each conversation, extracts stated facts about the operator's business
 * (ICP updates, product mentions, objections, preferences, hot leads) and
 * persists them to tenant_states.fact_anchors. These facts are injected back
 * into buildSystemPrompt() on every future session, so agents progressively
 * learn each operator's context without requiring re-onboarding.
 *
 * Called async/fire-and-forget from queue workers — never blocks message delivery.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTenantState, saveTenantState } from './tenant_data.js';
import { getChatHistory } from './ai.js';

export interface FactAnchorEntry {
    value: string;
    extractedAt: string;
}

export interface FactAnchors {
    lastExtractedAt: string;
    productMentioned: FactAnchorEntry[];
    icpUpdates: FactAnchorEntry[];
    objectionsRaised: FactAnchorEntry[];
    preferencesStated: FactAnchorEntry[];
    hotLeadsMentioned: FactAnchorEntry[];
}

// Each category is capped to prevent unbounded growth
const MAX_ENTRIES_PER_CATEGORY = 10;

function mergeCapped(existing: FactAnchorEntry[], incoming: string | undefined): FactAnchorEntry[] {
    if (!incoming?.trim()) return existing;
    const entry: FactAnchorEntry = { value: incoming.trim(), extractedAt: new Date().toISOString() };
    return [...existing, entry].slice(-MAX_ENTRIES_PER_CATEGORY);
}

function emptyAnchors(): FactAnchors {
    return {
        lastExtractedAt: new Date().toISOString(),
        productMentioned: [],
        icpUpdates: [],
        objectionsRaised: [],
        preferencesStated: [],
        hotLeadsMentioned: [],
    };
}

export async function extractFactAnchors(
    tenantId: string,
    chatId: number,
): Promise<void> {
    try {
        const platformKey = process.env.PLATFORM_ONBOARDING_KEY ?? process.env.GOOGLE_API_KEY;
        if (!platformKey) return;

        // Load last 10 history entries (5 turns) as plain text for extraction
        const history = await getChatHistory(tenantId, chatId);
        const recentTurns = history
            .filter(e => e.role === 'user' || e.role === 'model')
            // Skip the synthetic [CONVERSATION MEMORY] pair if present
            .filter(e => !((e.parts ?? [])[0] as any)?.text?.startsWith?.('[CONVERSATION MEMORY'))
            .slice(-10);

        if (recentTurns.length === 0) return;

        const plainText = recentTurns
            .map(e => {
                const text = (e.parts ?? []).map((p: any) => p.text ?? '').join(' ').trim();
                return text ? `${e.role}: ${text}` : null;
            })
            .filter(Boolean)
            .join('\n');

        if (!plainText) return;

        const genAI = new GoogleGenerativeAI(platformKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent(
            `Extract any stated facts about the operator's business from this conversation. ` +
            `Output ONLY valid JSON with these optional fields (omit fields with no data):\n` +
            `{ "productMentioned": "string", "icpUpdate": "string", "objectionRaised": "string", ` +
            `"preferenceStated": "string", "hotLeadMentioned": "string" }\n\n` +
            `Conversation:\n${plainText}`,
        );

        const raw = result.response.text?.() ?? '';
        // Strip any markdown code fences before parsing
        const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        let extracted: Record<string, string>;
        try {
            extracted = JSON.parse(jsonStr);
        } catch {
            console.log(`[FactExtractor] No structured facts extracted for tenant ${tenantId} (non-JSON response)`);
            return; // Empty or conversational response — nothing actionable
        }

        // Load existing anchors and merge
        const existing = await getTenantState<FactAnchors>(tenantId, 'fact_anchors') ?? emptyAnchors();

        const updated: FactAnchors = {
            lastExtractedAt: new Date().toISOString(),
            productMentioned: mergeCapped(existing.productMentioned, extracted.productMentioned),
            icpUpdates: mergeCapped(existing.icpUpdates, extracted.icpUpdate),
            objectionsRaised: mergeCapped(existing.objectionsRaised, extracted.objectionRaised),
            preferencesStated: mergeCapped(existing.preferencesStated, extracted.preferenceStated),
            hotLeadsMentioned: mergeCapped(existing.hotLeadsMentioned, extracted.hotLeadMentioned),
        };

        await saveTenantState(tenantId, 'fact_anchors', updated);
        console.log(`[FactExtractor] Anchors updated for tenant ${tenantId}`);
    } catch (err: any) {
        console.warn(`[FactExtractor] Extraction failed for tenant ${tenantId} — skipping:`, err.message);
    }
}
