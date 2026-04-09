import "dotenv/config";
import { loadSecrets } from "./src/config/secrets.js";
loadSecrets();

import { getPool } from "./src/services/db.js";

async function verify() {
  const pool = getPool();
  
  const sources = await pool.query('SELECT COUNT(*) FROM hive_prior_sources');
  console.log('hive_prior_sources count:', sources.rows[0].count || sources.rows[0].cx);
  
  const signals = await pool.query('SELECT COUNT(*) FROM hive_signals');
  console.log('hive_signals count:', signals.rows[0].count || signals.rows[0].cx);
  
  const events = await pool.query('SELECT COUNT(*) FROM hive_events');
  console.log('hive_events count:', events.rows[0].count || events.rows[0].cx);
  
  const tenants = await pool.query('SELECT COUNT(*) FROM tenants WHERE is_founding_member = true');
  console.log('founding tenants count:', tenants.rows[0].count || tenants.rows[0].cx);

}

verify().catch(console.error).then(() => process.exit(0));
