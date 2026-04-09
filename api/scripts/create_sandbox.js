const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL env var before running this script."); })()
  });
  
  try {
    await client.connect();
    console.log('Connected to tiger_claw_shared.');

    const id = "11111111-1111-1111-1111-111111111111";
    await client.query(`
      INSERT INTO tenants (id, name, slug, email, status) 
      VALUES ($1, 'BotCraft Sandbox', 'botcraft-sandbox', 'sandbox@botcraft.ai', 'live')
      ON CONFLICT (id) DO UPDATE SET slug = 'botcraft-sandbox';
    `, [id]);
    
    console.log('Sandbox tenant spawned correctly.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
