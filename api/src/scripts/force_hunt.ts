import 'dotenv/config';
import IORedis from 'ioredis';
import { getPool } from '../services/db.js';
import { routineQueue } from '../services/queue.js';

async function main() {
    const pool = getPool();
    const { rows: tenants } = await pool.query("SELECT id, name FROM tenants WHERE status = 'active'");
    console.log(`Found ${tenants.length} active tenants.`);
    
    for (const t of tenants) {
        console.log(`Queuing immediate Scout Hunt for ${t.name} (${t.id})...`);
        await routineQueue.add('daily_scout', {
            tenantId: t.id,
            routineType: 'daily_scout',
        }, { removeOnComplete: true, removeOnFail: true });
    }
    
    console.log("All scans queued! They are executing in the background right now via BullMQ.");
    
    // Slight delay to ensure BullMQ gets the queue data fully written before exit
    setTimeout(() => {
        process.exit(0);
    }, 1000);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
