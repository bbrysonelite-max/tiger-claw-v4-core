import { getPool } from "./api/src/services/db.js";

async function audit() {
  const pool = getPool();
  try {
    const result = await pool.query(`
      SELECT domain, category, fact_summary, confidence_score, verified_at, metadata->>'rawText' as raw_text
      FROM market_intelligence 
      ORDER BY verified_at DESC 
      LIMIT 50;
    `);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err: any) {
    console.error(err.message);
  } finally {
    process.exit(0);
  }
}

audit();
