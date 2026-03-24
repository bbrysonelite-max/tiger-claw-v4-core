const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL env var before running this script."); })()
  });
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'");
  console.log("Cols:", res.rows.map(r => r.column_name).join(', '));
  const botCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bots'");
  console.log("BotCols:", botCols.rows.map(r => r.column_name).join(', '));
  await client.end();
}
main().catch(console.error);
