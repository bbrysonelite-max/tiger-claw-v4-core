const { Client } = require('pg');
async function main() {
  const client = new Client({
    connectionString: "postgres://botcraft:TigerClaw2026MasterKey!@127.0.0.1:5432/tiger_claw_shared"
  });
  await client.connect();
  const res = await client.query("SELECT status, count(*) FROM bot_pool GROUP BY status;");
  console.log("Token results:", res.rows);
  await client.end();
}
main().catch(console.error);
