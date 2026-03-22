const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT slug, name, id FROM tenants LIMIT 1');
  console.log("TENANT_FOUND:", res.rows[0]);
  await client.end();
}

run().catch(console.error);
