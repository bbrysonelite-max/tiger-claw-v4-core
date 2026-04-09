import { Client } from 'pg';
import { decryptToken } from './src/services/pool.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL env var before running this script."); })()
  });
  
  try {
      await client.connect();
      
      const res = await client.query("SELECT * FROM bot_pool WHERE bot_username ILIKE '%johnhidebrand%'");
      if (res.rowCount > 0) {
          console.log("Found in bot_pool:", res.rows[0].telegram_bot_id);
          const encrypted = res.rows[0].bot_token;
          const token = decryptToken(encrypted);
          const tenantId = res.rows[0].tenant_id;
          
          if (!tenantId) {
             console.log("No assigned tenantId for this bot pool entry!");
             return;
          }
          
          const webhookUrl = `https://tiger-claw-api-1059104880024.us-central1.run.app/webhooks/telegram/${tenantId}`;
          console.log(`Setting Webhook to: ${webhookUrl}`);
          
          const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
          const data = await response.json();
          console.log("Telegram Response:", data);
      } else {
          console.log("Bot not found.");
      }
  } catch (err) {
      console.error(err);
  } finally {
      await client.end();
  }
}
main();
