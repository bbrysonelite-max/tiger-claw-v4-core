const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://botcraft:TigerClaw2026MasterKey!@127.0.0.1:5432/tiger_claw_shared"
  });
  
  try {
      await client.connect();
      console.log("Connected. Purging burned keys for tenant 59edee05-6494-43b4-9b98-9b91d77608c7...");
      
      const r1 = await client.query(`DELETE FROM bot_ai_config WHERE tenant_id = '59edee05-6494-43b4-9b98-9b91d77608c7'`);
      console.log(`Deleted ${r1.rowCount} legacy configs.`);
      
      const r2 = await client.query(`DELETE FROM bot_ai_keys WHERE tenant_id = '59edee05-6494-43b4-9b98-9b91d77608c7'`);
      console.log(`Deleted ${r2.rowCount} legacy multi-keys.`);

  } catch (err) {
      console.error("DB Error:", err.message);
  } finally {
      await client.end();
  }
}
main();
