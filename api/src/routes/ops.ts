import { Router, type Request, type Response } from "express";
import { getPool } from "../services/db.js";
import { telegramQueue, provisionQueue, routineQueue } from "../services/queue.js";

const router = Router();

const ADMIN_BOT_TOKEN = process.env["ADMIN_TELEGRAM_BOT_TOKEN"];
const ADMIN_CHAT_ID = process.env["ADMIN_TELEGRAM_CHAT_ID"];

// Native HTTP wrapper for sending messages back to Telegram without needing the full SDK listener
async function sendTelegramMessage(chatId: string, text: string) {
    if (!ADMIN_BOT_TOKEN) return;
    try {
        await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: "HTML"
            })
        });
    } catch (e) {
        console.error("[ops-webhook] Failed to send Telegram response:", e);
    }
}

router.post("/", async (req: Request, res: Response) => {
    // Acknowledge immediately to prevent Telegram retries
    res.status(200).send("OK");
    
    if (!ADMIN_BOT_TOKEN || !ADMIN_CHAT_ID) {
        console.warn("[ops-webhook] Admin Telegram credentials not configured. Ignored.");
        return;
    }

    try {
        const update = req.body;
        
        // We only care about text messages
        if (!update?.message?.text) return;
        
        const chatId = update.message.chat.id.toString();
        const text: string = update.message.text.trim();

        // 🚨 Strict Authorization: Only the authorized ADMIN_CHAT_ID can use this bot
        if (chatId !== ADMIN_CHAT_ID) {
            console.warn(`[ops-webhook] Unauthorized access attempt from chat ID: ${chatId}`);
            return;
        }

        if (text === "/status") {
            const pool = getPool();
            
            // 1. Database Metrics
            const { rows: activeTenants } = await pool.query("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'");
            const { rows: waitlistedTenants } = await pool.query("SELECT COUNT(*) as count FROM tenants WHERE status = 'pending'");
            const { rows: activeBots } = await pool.query("SELECT COUNT(*) as count FROM bot_pool WHERE status = 'available'");
            
            // 2. Queue Metrics (BullMQ)
            const telegramQueueCount = await telegramQueue.getJobCounts('wait', 'active', 'failed', 'delayed');
            const provisionQueueCount = await provisionQueue.getJobCounts('wait', 'active', 'failed', 'delayed');
            const routineQueueCount = await routineQueue.getJobCounts('wait', 'active', 'failed', 'delayed');

            // 3. Format Response
            const message = `
🐯 <b>TIGER CLAW INFRASTRUCTURE STATUS</b> 🐯

<b>📊 Active Database state:</b>
• Active Tenants: <b>${activeTenants[0].count}</b>
• Pending Tenants: <b>${waitlistedTenants[0].count}</b>
• Available Bot Tokens: <b>${activeBots[0].count}</b>

<b>⚙️ Background Workers (BullMQ):</b>
• Telegram Inference: ${telegramQueueCount.wait} wait | ${telegramQueueCount.active} act | ${telegramQueueCount.failed} fail
• Provisioning Queue: ${provisionQueueCount.wait} wait | ${provisionQueueCount.active} act | ${provisionQueueCount.failed} fail
• Nurture / Scout: ${routineQueueCount.wait} wait | ${routineQueueCount.active} act | ${routineQueueCount.failed} fail

✅ <i>V4 Serverless Platform Operating Normally</i>`;

            await sendTelegramMessage(chatId, message);
        } else if (text === "/start") {
            await sendTelegramMessage(chatId, "🐯 <b>Tiger Claw Scout Ops</b> is online. Send /status to query the cloud infrastructure.");
        }
    } catch (err) {
        console.error("[ops-webhook] Fatal error processing Scout command:", err);
        await sendTelegramMessage(ADMIN_CHAT_ID, "❌ <b>Ops Error:</b> Engine fault during /status query.");
    }
});

export default router;
