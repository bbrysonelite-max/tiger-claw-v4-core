const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://botcraft:TigerClaw2026MasterKey!@127.0.0.1:5432/tiger_claw_shared"
  });
  
  try {
    await client.connect();
    
    console.log("=== PHASE 3: YOUR 3 AGENTS (TENANTS) ===");
    const tenantRes = await client.query("SELECT id, name, flavor FROM tenants ORDER BY created_at DESC LIMIT 5;");
    console.table(tenantRes.rows);
    
    console.log("\n=== PHASE 3: AI BRAIN CONNECTIONS (KEYS) ===");
    const keyRes = await client.query("SELECT * FROM bot_ai_keys ORDER BY created_at DESC LIMIT 5;");
    if (keyRes.rows.length === 0) {
      console.log("NO AI KEYS DETECTED. This is why they have 'no brain'.");
    } else {
      console.table(keyRes.rows);
    }
  } catch (err) {
    console.error("Database connection failed:", err.message);
  } finally {
    await client.end();
  }
}

main();
