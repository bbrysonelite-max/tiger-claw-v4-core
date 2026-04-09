import "dotenv/config";
import { loadSecrets } from "./src/config/secrets.js";
loadSecrets();

import { getPool } from "./src/services/db.js";

async function run() {
  const pool = getPool();
  try {
    // 1. Read the current migrations table records
    const res = await pool.query('SELECT name FROM migrations ORDER BY name');
    console.log("Current migrations:", res.rows.map(r => r.name));

    // 2. Update the migrations table
    await pool.query("UPDATE migrations SET name = '008_hive_universal_prior.sql' WHERE name = '006_hive_universal_prior.sql'");
    await pool.query("UPDATE migrations SET name = '009_founding_members.sql' WHERE name = '007_founding_members.sql'");
    await pool.query("UPDATE migrations SET name = '010_line_timing_data.sql' WHERE name = '008_line_timing_data.sql'");
    await pool.query("UPDATE migrations SET name = '011_hive_icp.sql' WHERE name = '009_hive_icp.sql'");

    console.log("Successfully renamed migrations in database.");

    // 3. Verify
    const verify = await pool.query('SELECT name FROM migrations ORDER BY name');
    console.log("Updated migrations:", verify.rows.map(r => r.name));
  } catch (err) {
    console.error("Failed:", err);
  } finally {
    process.exit(0);
  }
}

run();
