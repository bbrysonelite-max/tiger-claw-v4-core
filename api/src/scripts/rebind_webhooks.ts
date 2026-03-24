import 'dotenv/config';
import { Pool } from 'pg';
import crypto from 'crypto';

function decryptToken(encryptedHex: string): string {
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) throw new Error("ENCRYPTION_KEY required");
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
    const encryptedBytes = Buffer.from(encryptedHex, 'hex');
    const iv = encryptedBytes.subarray(0, 12);
    const authTag = encryptedBytes.subarray(encryptedBytes.length - 16);
    const ciphertext = encryptedBytes.subarray(12, encryptedBytes.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
}

async function main() {
    console.log("Starting Webhook Rebind...");
    const connStr = process.env.DATABASE_URL;
    if (!connStr) throw new Error("DATABASE_URL required");
    const pool = new Pool({ connectionString: connStr });
    
    const { rows } = await pool.query("SELECT bot_username, bot_token, tenant_id FROM bot_pool WHERE status = 'live' AND tenant_id IS NOT NULL");
    console.log(`Discovered ${rows.length} active canaries in bot_pool`);
    
    for (const bot of rows) {
        try {
            const token = bot.bot_token.length > 50 ? decryptToken(bot.bot_token) : bot.bot_token;
            const webhookUrl = `https://api.tigerclaw.io/webhooks/telegram/${bot.tenant_id}`;
            const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
            const data = await res.json();
            console.log(`[${bot.bot_username}] Re-registered to ${webhookUrl}: ${data.description}`);
        } catch (e: any) {
            console.error(`[${bot.bot_username}] Failed:`, e.message);
        }
    }
    
    await pool.end();
}
main().catch(console.error);
