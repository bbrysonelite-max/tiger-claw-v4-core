import crypto from 'node:crypto';
import { getTenant, insertHiveEvent, incrementHiveContribution } from './db.js';

// Verticals that map to tiger_objection bucket types
const VALID_VERTICALS = [
  'network-marketer', 'real-estate', 'health-wellness',
  'saas', 'ecommerce', 'other'
] as const;

const VALID_REGIONS = ['sea', 'latam', 'mena', 'us', 'eu', 'other'] as const;

function hashTenantId(tenantId: string): string {
  return crypto.createHash('sha256').update(tenantId).digest('hex').slice(0, 16);
}

// Hard PII strip — remove anything that looks like contact data
function stripPii(payload: Record<string, unknown>): Record<string, unknown> {
  const str = JSON.stringify(payload);
  // Email pattern
  const noEmail = str.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[email]');
  // Phone pattern (E.164 and common formats)
  const noPhone = noEmail.replace(/(\+?[\d\s\-().]{7,})/g, (m) =>
    m.replace(/\D/g, '').length >= 7 ? '[phone]' : m
  );
  // Names (heuristic: capitalized word pairs)
  const noNames = noPhone.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[name]');
  return JSON.parse(noNames);
}

// V4 Expanded union
export type HiveEventType = 'objection' | 'conversion' | 'score' | 'scout_hit' | 'scout_profile' | 'unicorn_profile' | 'regulatory_violation';

export async function emitHiveEvent(
  tenantId: string,
  eventType: HiveEventType,
  rawPayload: Record<string, unknown>
): Promise<void> {
  try {
    const tenant = await getTenant(tenantId);
    if (!tenant) return;
    if ((tenant as any).flavor === 'admin' || (tenant as any).vertical === 'internal') return;
    if (!(tenant as any).hiveOptIn) return; // Use any for dynamic typing since we didn't inject all types

    const vertical = (tenant as any).vertical ?? 'other';
    const region   = (tenant as any).region   ?? 'other';

    // Must have valid vertical + region to be useful signal
    if (!VALID_VERTICALS.includes(vertical as any)) return;
    if (!VALID_REGIONS.includes(region as any)) return;

    const payload = stripPii(rawPayload);

    await insertHiveEvent({
      tenantHash: hashTenantId(tenantId),
      vertical,
      region,
      eventType,
      payload,
    });

    // Fire-and-forget counter increment
    incrementHiveContribution(tenantId).catch(() => {});
  } catch {
    // Hive emit must never crash the calling tool
  }
}

// V4 Updated attribution label (No source IDs/brand names)
export function hiveAttributionLabel(signal: { userLabel?: string, isUniversalPrior?: boolean, sampleSize?: number }): string {
  if (signal.isUniversalPrior && signal.userLabel) {
    return `📚 ${signal.userLabel}`;
  }
  
  if (!signal.isUniversalPrior && signal.sampleSize && signal.sampleSize > 0) {
    if (signal.userLabel) return `📊 ${signal.userLabel}`;
    return `📊 Based on ${signal.sampleSize.toLocaleString()} conversations in your industry on Tiger Claw`;
  }
  
  return "📊 Community baseline data";
}

export function foundingMemberBadge(rank: number | null): string | null {
  if (!rank) return null;
  return `⭐ Founding Member #${rank}`;
}
