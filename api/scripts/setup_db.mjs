import pkg from 'pg';
const { Client } = pkg;

async function setup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log("Connected to database. Patching market_intelligence schema...");

    // 1. Ensure table exists with core fields
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_intelligence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain TEXT NOT NULL,
        category TEXT NOT NULL,
        entity_label TEXT,
        fact_summary TEXT NOT NULL,
        confidence_score INTEGER DEFAULT 0,
        source_url TEXT,
        metadata JSONB DEFAULT '{}',
        verified_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Add v5 expansion fields if they don't exist
    await client.query(`
      ALTER TABLE market_intelligence ADD COLUMN IF NOT EXISTS captured_by TEXT DEFAULT 'unknown';
      ALTER TABLE market_intelligence ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;
      ALTER TABLE market_intelligence ADD COLUMN IF NOT EXISTS entity_id TEXT;
      ALTER TABLE market_intelligence ADD COLUMN IF NOT EXISTS mining_cost NUMERIC(10, 6) DEFAULT 0;
    `);

    // 3. Ensure indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_market_intel_domain ON market_intelligence(domain);
      CREATE INDEX IF NOT EXISTS idx_market_intel_category ON market_intelligence(category);
      CREATE INDEX IF NOT EXISTS idx_market_intel_entity ON market_intelligence(entity_id);
      CREATE INDEX IF NOT EXISTS idx_market_intel_validity ON market_intelligence(valid_until);
    `);

    console.log("✅ Market Intelligence table patched and verified.");
  } catch (err) {
    console.error("❌ Setup failed:", err);
  } finally {
    await client.end();
  }
}

setup();
