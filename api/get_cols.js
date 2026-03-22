const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://botcraft:TigerClaw2026MasterKey!@127.0.0.1:5432/tiger_claw_shared"
  });
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'");
  console.log("Cols:", res.rows.map(r => r.column_name).join(', '));
  const botCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bots'");
  console.log("BotCols:", botCols.rows.map(r => r.column_name).join(', '));
  await client.end();
}
main().catch(console.error);
