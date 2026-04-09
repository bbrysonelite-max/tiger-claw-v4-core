const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL env var before running this script."); })()
  });
  
  try {
    await client.connect();
    console.log('Connected to tiger_claw_shared.');

    // Drop old OpenClaw constraints blocking V4 provisioning
    const queries = [
      'ALTER TABLE bot_ai_keys DROP CONSTRAINT IF EXISTS bot_ai_keys_bot_id_fkey;',
      'ALTER TABLE bot_ai_config DROP CONSTRAINT IF EXISTS bot_ai_config_bot_id_fkey;',
      // Note: If there are other known constraints blocking the pool, we add them here.
    ];

    for (const q of queries) {
      console.log(`Running: ${q}`);
      await client.query(q);
      console.log(`Success.`);
    }

    console.log('Database sanitization complete. Legacy constraints safely purged.');
  } catch (err) {
    console.error('Error during database sanitization:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
