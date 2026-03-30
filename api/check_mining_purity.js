const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT 
        id, 
        domain, 
        category, 
        entity_label, 
        fact_summary, 
        confidence_score, 
        source_url, 
        captured_by,
        created_at 
      FROM market_intelligence 
      ORDER BY created_at DESC 
      LIMIT 10;
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
