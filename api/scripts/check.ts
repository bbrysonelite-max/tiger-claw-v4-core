import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const res = await pool.query(`
    SELECT t.bot_token as tenant_bot_token, b.id as bot_id, t.id as tenant_id, bp.id as pool_id 
    FROM users u 
    JOIN bots b ON b.user_id = u.id 
    LEFT JOIN tenants t ON t.user_id = u.id 
    LEFT JOIN bot_pool bp ON bp.tenant_id = t.id
    WHERE u.email IS NOT NULL LIMIT 1
  `);
  console.log(res.rows[0]);
  pool.end();
}
check();
