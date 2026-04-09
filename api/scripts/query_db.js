const { Client } = require('pg');
async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL env var before running this script."); })()
  });
  await client.connect();
  const res = await client.query("SELECT status, count(*) FROM bot_pool GROUP BY status;");
  console.log("Token results:", res.rows);
  await client.end();
}
main().catch(console.error);
