import { getPool, withClient } from "./db.js";

// ---------------------------------------------------------------------------
// Market Intelligence Schema (The v5 Data Moat)
// TIGERCLAW-MASTER-SPEC-v2.md Block 5.1 Extension
// ---------------------------------------------------------------------------

export interface MarketFact {
  id?: string;
  domain: string;
  category: string;
  entity_id?: string;         // Unique ID for Alchemy (e.g., hashed username)
  entity_label: string;
  fact_summary: string;
  confidence_score: number;
  mining_cost?: number;       // Unit cost in USD (e.g., 0.045)
  source_url: string;
  captured_by: string;
  metadata: Record<string, any>;
  verified_at: Date;
  valid_until?: Date;
}

/**
 * Initialize the global market intelligence table.
 */
export async function initMarketIntelSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS market_intelligence (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      domain TEXT NOT NULL,
      category TEXT NOT NULL,
      entity_id TEXT,
      entity_label TEXT,
      fact_summary TEXT NOT NULL,
      confidence_score INTEGER DEFAULT 0,
      mining_cost NUMERIC(10, 6) DEFAULT 0,
      source_url TEXT,
      captured_by TEXT DEFAULT 'unknown',
      metadata JSONB DEFAULT '{}',
      verified_at TIMESTAMPTZ DEFAULT NOW(),
      valid_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_market_intel_domain ON market_intelligence(domain);
    CREATE INDEX IF NOT EXISTS idx_market_intel_category ON market_intelligence(category);
    CREATE INDEX IF NOT EXISTS idx_market_intel_entity ON market_intelligence(entity_id);
    CREATE INDEX IF NOT EXISTS idx_market_intel_validity ON market_intelligence(valid_until);
  `);
  console.log("[market-intel] Schema initialized.");
}

/**
 * Check if a source URL has already been purified.
 * Prevents double-mining costs.
 */
/**
 * Normalize a URL for dedup checks: strip query params, hash, and trailing slash.
 * Prevents tracking parameters and redirect variants from creating duplicate facts.
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url.replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

export async function isAlreadyMined(sourceUrl: string): Promise<boolean> {
  if (!sourceUrl || sourceUrl === "unknown") return false;
  const normalized = normalizeUrl(sourceUrl);
  const result = await getPool().query(
    "SELECT id FROM market_intelligence WHERE source_url = $1 LIMIT 1",
    [normalized]
  );
  return result.rows.length > 0;
}

/**
 * Save a purified fact into the global moat.
 */
export async function saveMarketFact(fact: MarketFact): Promise<string> {
  const result = await getPool().query(
    `INSERT INTO market_intelligence 
       (domain, category, entity_id, entity_label, fact_summary, confidence_score, mining_cost, source_url, captured_by, metadata, verified_at, valid_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
     RETURNING id`,
    [
      fact.domain,
      fact.category,
      fact.entity_id ?? null,
      fact.entity_label,
      fact.fact_summary,
      fact.confidence_score,
      fact.mining_cost ?? 0,
      normalizeUrl(fact.source_url),
      fact.captured_by,
      fact.metadata,
      fact.valid_until ?? null
    ]
  );
  return result.rows[0].id;
}

/**
 * Query the moat for high-value intelligence.
 */
export async function queryMarketIntel(params: {
  domain: string;
  category?: string;
  minConfidence?: number;
  limit?: number;
}): Promise<MarketFact[]> {
  const conditions = ["domain = $1"];
  const values: any[] = [params.domain];
  let idx = 2;

  if (params.category) {
    conditions.push(`category = $${idx++}`);
    values.push(params.category);
  }

  if (params.minConfidence) {
    conditions.push(`confidence_score >= $${idx++}`);
    values.push(params.minConfidence);
  }

  const result = await getPool().query(
    `SELECT * FROM market_intelligence 
     WHERE ${conditions.join(" AND ")}
     ORDER BY confidence_score DESC, verified_at DESC
     LIMIT $${idx}`,
    [...values, params.limit || 50]
  );

  return result.rows.map(row => ({
    id: row.id,
    domain: row.domain,
    category: row.category,
    entity_label: row.entity_label,
    fact_summary: row.fact_summary,
    confidence_score: row.confidence_score,
    source_url: row.source_url,
    captured_by: row.captured_by ?? "unknown",
    metadata: row.metadata,
    verified_at: row.verified_at
  }));
}

// Minimum purity floor for bot injection — facts below this are noise.
const BOT_CONFIDENCE_THRESHOLD = 70;

/**
 * Fetch fresh, high-confidence market facts for a given domain.
 * Used by buildSystemPrompt() to inject live market intelligence into the bot brain.
 *
 * IMPORTANT: domain must be the flavor displayName (e.g. "Real Estate Agent"),
 * NOT the flavor key (e.g. "real-estate"). The miner stores displayName as domain.
 * Pass flavor.displayName from ai.ts, which already has the flavor config loaded.
 *
 * Filters:
 * - domain match (exact — flavor displayName as stored by the miner)
 * - confidence_score >= 70 (high-purity facts only)
 * - created_at within the last 7 days (stale facts are worse than no facts)
 * - valid_until not yet expired (if set)
 * - ordered newest first, then by confidence desc
 */
export async function getMarketIntelligence(
  domain: string,
  limit: number = 5
): Promise<MarketFact[]> {
  if (!domain) return [];

  // Ordering:
  //   1. IPP gate relevance_score DESC (NULL = legacy pre-gate fact, sorts last)
  //   2. created_at DESC (freshness)
  //   3. confidence_score DESC (purity tiebreaker)
  // The IPP gate filters at write-time for flavors with idealProspectProfile,
  // so for those flavors new facts all carry a score and float to the top.
  // Flavors without an IPP gate are unaffected — their facts have NULL score
  // and fall back to the legacy created_at/confidence_score ordering.
  const result = await getPool().query(
    `SELECT id, domain, category, entity_label, fact_summary, confidence_score,
            source_url, captured_by, metadata, verified_at, valid_until
     FROM market_intelligence
     WHERE domain = $1
       AND confidence_score >= $2
       AND created_at >= NOW() - INTERVAL '30 days'
       AND (valid_until IS NULL OR valid_until > NOW())
     ORDER BY (metadata->>'relevance_score')::int DESC NULLS LAST,
              created_at DESC,
              confidence_score DESC
     LIMIT $3`,
    [domain, BOT_CONFIDENCE_THRESHOLD, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    domain: row.domain,
    category: row.category,
    entity_label: row.entity_label,
    fact_summary: row.fact_summary,
    confidence_score: row.confidence_score,
    source_url: row.source_url,
    captured_by: row.captured_by ?? "unknown",
    metadata: row.metadata,
    verified_at: row.verified_at,
    valid_until: row.valid_until,
  }));
}
