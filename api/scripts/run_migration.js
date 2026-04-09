import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL;
console.log("Connecting to:", url ? url.replace(/:[^:@]+@/, ':***@') : "undefined");
const pool = new Pool({ connectionString: url });

async function run(file) {
    const sql = fs.readFileSync(file, 'utf8');
    console.log(`Running ${file}...`);
    try {
        await pool.query(sql);
        console.log(`Success: ${file}`);
    } catch (e) {
        console.error(`Error in ${file}:`, e);
    }
}

async function main() {
    await run('./migrations/005_tenant_data.sql');
    await run('./migrations/005_multi_key_and_crm.sql');
    await pool.end();
}

main().catch(console.error);
