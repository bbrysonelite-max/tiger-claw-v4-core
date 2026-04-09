const { Pool } = require('pg');
require('dotenv').config();

async function check() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        console.log('--- TENANTS ---');
        const t = await pool.query("SELECT id, slug, email, status, bot_token FROM tenants ORDER BY created_at DESC LIMIT 5");
        console.table(t.rows.map(r => ({ ...r, bot_token: r.bot_token ? '***' + r.bot_token.slice(-5) : 'NULL'})));

        console.log('\n--- BOTS POOL ---');
        const b = await pool.query("SELECT id, bot_username, status, tenant_id FROM bots ORDER BY created_at DESC LIMIT 5");
        console.table(b.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
