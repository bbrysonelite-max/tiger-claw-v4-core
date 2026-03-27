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
export async function isAlreadyMined(sourceUrl: string): Promise<boolean> {
  if (!sourceUrl || sourceUrl === "unknown") return false;
  const result = await getPool().query(
    "SELECT id FROM market_intelligence WHERE source_url = $1 LIMIT 1",
    [sourceUrl]
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
      fact.source_url,
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
    metadata: row.metadata,
    verified_at: row.verified_at
  }));
}
