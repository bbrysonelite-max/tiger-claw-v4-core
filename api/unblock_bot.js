const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://botcraft:TigerClaw2026Secure@127.0.0.1:5432/tiger_claw_shared'
});

async function main() {
  try {
    const targetId = '8803b9f4-2d9e-43fa-a657-b01e5db97b58';
    console.log(`Updating subscription status for tenant ${targetId}...`);
    const res = await pool.query(`
      UPDATE subscriptions SET status = 'pending_setup'
      WHERE tenant_id = $1;
    `, [targetId]);
    
    if (res.rowCount === 0) {
      console.log("No existing subscription found. Inserting new record...");
      const tenantRes = await pool.query("SELECT user_id FROM tenants WHERE id = $1", [targetId]);
      if (tenantRes.rows.length > 0) {
        const userId = tenantRes.rows[0].user_id;
        await pool.query(`
          INSERT INTO subscriptions (user_id, tenant_id, status, plan_tier, stripe_subscription_id)
          VALUES ($1, $2, 'pending_setup', 'byok_basic', $3)
        `, [userId, targetId, `manual_unblock_${Date.now()}`]);
        console.log("Inserted new subscription record.");
      } else {
        console.error("Tenant record not found.");
      }
    } else {
      console.log("Updated existing subscription record.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
