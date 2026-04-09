import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/brentbryson/Tigerclaw-Anti_Gravity/tiger-claw/api/.env' });

async function verify() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  const sources = await client.query('SELECT COUNT(*) FROM hive_prior_sources');
  console.log('hive_prior_sources count:', sources.rows[0].count);
  
  const signals = await client.query('SELECT COUNT(*) FROM hive_signals');
  console.log('hive_signals count:', signals.rows[0].count);
  
  const events = await client.query('SELECT COUNT(*) FROM hive_events');
  console.log('hive_events count:', events.rows[0].count);
  
  const tenants = await client.query('SELECT COUNT(*) FROM tenants WHERE is_founding_member = true');
  console.log('founding tenants count:', tenants.rows[0].count);

  await client.end();
}

verify().catch(console.error);
