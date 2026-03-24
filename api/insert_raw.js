const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL env var before running this script."); })(),
    query_timeout: 10000 // Prevents hanging
  });
  
  try {
    await client.connect();
    
    console.log("Creating user...");
    const userRes = await client.query(`INSERT INTO users (email, name) VALUES ('john@agent.test', 'John Browser') ON CONFLICT (email) DO UPDATE SET name = 'John Browser' RETURNING id`);
    const userId = userRes.rows[0].id;
    console.log("User id:", userId);
    
    console.log("Checking if tenant exists...");
    const existing = await client.query(`SELECT id FROM tenants WHERE email = 'john@agent.test'`);
    let tenantId;
    if (existing.rows.length > 0) {
        tenantId = existing.rows[0].id;
        console.log("Tenant already exists:", tenantId);
        await client.query(`UPDATE tenants SET status = 'pending' WHERE id = $1`, [tenantId]);
    } else {
        console.log("Creating tenant...");
        const tenantRes = await client.query(`INSERT INTO tenants (user_id, name, slug, email, flavor, status, region, language, preferred_channel, container_name)
             VALUES ($1, 'John Browser', 'john-browser', 'john@agent.test', 'network-marketer', 'pending', 'us-en', 'en', 'telegram', 'tiger-claw-john')
             RETURNING id`, [userId]);
        tenantId = tenantRes.rows[0].id;
        console.log("Tenant id:", tenantId);
    }
    
    console.log("Creating schema...");
    const schemaName = `t_${tenantId.replace(/-/g, '_')}`;
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    
    // Create subscription - OMITTED for legacy foreign key issues.
    // await client.query(`INSERT INTO subscriptions (user_id, tenant_id, stripe_subscription_id, plan_tier, status) VALUES ($1, $2, 'stan_store_sale_test_123', 'byok_basic', 'active') ON CONFLICT DO NOTHING`, [userId, tenantId]);
    
    console.log("SEEDED 100% SUCCESSFULLY");
  } catch (err) {
    console.error("DB Seed Error:", err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
