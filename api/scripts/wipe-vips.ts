import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config(); // using local api/.env when run from api/ dir

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: DB_URL });
const DRY_RUN = process.env.DRY_RUN !== "false";

async function main() {
  console.log(`\n[wipe-vips-memory] DRY_RUN=${DRY_RUN}\n`);

  // Target: all users who have an email (these are the VIPs who got the apology email)
  const { rows } = await pool.query(`
    SELECT u.id as user_id, u.email, u.name, b.id as bot_id, t.id as tenant_id
    FROM users u
    JOIN bots b ON b.user_id = u.id
    LEFT JOIN tenants t ON t.user_id = u.id
    WHERE u.email IS NOT NULL
  `);

  if (rows.length === 0) {
    console.log("No VIPs found with attached bots.");
    return;
  }

  for (const row of rows) {
    console.log(`Targeting VIP: ${row.name} <${row.email}>`);
    console.log(`  Bot ID: ${row.bot_id}`);
    console.log(`  Tenant ID: ${row.tenant_id || "None"}`);
    
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would truncate bot_states & contacts, and set tenant status to 'onboarding'.\n`);
      continue;
    }

    try {
      await pool.query('BEGIN');
      
      if (row.tenant_id) {
          const schemaName = `t_${row.tenant_id.replace(/-/g, '_')}`;
          
          // Truncate tables to wipe memory but keep schema and tokens
          await pool.query(`TRUNCATE TABLE "${schemaName}".bot_states CASCADE;`);
          await pool.query(`TRUNCATE TABLE "${schemaName}".contacts CASCADE;`);
          await pool.query(`TRUNCATE TABLE "${schemaName}".messages CASCADE;`);
          await pool.query(`TRUNCATE TABLE "${schemaName}".appointments CASCADE;`);
          
          // Reset tenant to force onboarding
          await pool.query(`UPDATE tenants SET status = 'onboarding', onboarding_key_used = 0 WHERE id = $1`, [row.tenant_id]);
      }
      
      await pool.query('COMMIT');
      console.log(`  ✅ Memory Wiped securely. Token retained.\n`);
    } catch (e: any) {
      await pool.query('ROLLBACK');
      console.error(`  ❌ Failed to wipe memory for ${row.email}:`, e.message, "\n");
    }
  }
}

main().finally(() => pool.end());
