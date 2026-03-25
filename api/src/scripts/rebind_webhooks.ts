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
    console.log("Starting Webhook Rebind — wiring TELEGRAM_WEBHOOK_SECRET to all active tenant webhooks...");
    const connStr = process.env.DATABASE_URL;
    if (!connStr) throw new Error("DATABASE_URL required");
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.warn("⚠️  TELEGRAM_WEBHOOK_SECRET not set — webhooks will be registered WITHOUT a secret token.");
    }

    const pool = new Pool({ connectionString: connStr });
    
    const { rows } = await pool.query(`
        SELECT bp.bot_username, bp.bot_token, bp.tenant_id
        FROM bot_pool bp
        WHERE bp.status = 'assigned' AND bp.tenant_id IS NOT NULL
    `);
    console.log(`Found ${rows.length} assigned bots to re-register.`);
    
    const BASE_URL = (process.env.TIGER_CLAW_API_URL ?? 'https://api.tigerclaw.io').replace(/\/$/, '');
    let ok = 0, failed = 0;

    for (const bot of rows) {
        try {
            const token = bot.bot_token.length > 50 ? decryptToken(bot.bot_token) : bot.bot_token;
            const webhookUrl = `${BASE_URL}/webhooks/telegram/${bot.tenant_id}`;

            const body: Record<string, string> = { url: webhookUrl };
            if (webhookSecret) body.secret_token = webhookSecret;

            const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json() as { ok: boolean; description?: string };
            if (data.ok) {
                console.log(`  ✅ @${bot.bot_username} → ${webhookUrl}`);
                ok++;
            } else {
                console.error(`  ❌ @${bot.bot_username}: ${data.description}`);
                failed++;
            }
        } catch (e: any) {
            console.error(`  ❌ @${bot.bot_username} threw: ${e.message}`);
            failed++;
        }
    }
    
    await pool.end();
    console.log(`\nRebind complete: ${ok} succeeded, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

main().catch(console.error);
