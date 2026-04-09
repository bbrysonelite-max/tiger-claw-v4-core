import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        const { rows } = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'tenant_%'`);
        console.log("Tables created successfully:", rows.map(r => r.table_name).join(', '));
    } catch(e) {
        console.error("Query failed", e);
    } finally {
        pool.end();
    }
}

main();
