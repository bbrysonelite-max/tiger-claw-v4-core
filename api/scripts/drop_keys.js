const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL env var before running this script."); })()
  });
  await client.connect();
  
  try {
    await client.query('ALTER TABLE bot_ai_keys DROP CONSTRAINT IF EXISTS bot_ai_keys_bot_id_fkey;');
    console.log('Successfully dropped bot_ai_keys foreign key constraint.');
    
    await client.query('ALTER TABLE bot_ai_config DROP CONSTRAINT IF EXISTS bot_ai_config_bot_id_fkey;');
    console.log('Successfully dropped bot_ai_config foreign key constraint.');
  } catch (err) {
    console.error('Error dropping constraints:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
