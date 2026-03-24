const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL env var before running this script."); })()
  });
  await client.connect();
  const res = await client.query("SELECT bot_token, bot_username FROM bot_pool WHERE bot_username ILIKE '%johnhidebrand%'");
  if (res.rowCount === 0) {
    const res2 = await client.query("SELECT telegram_bot_token FROM bots WHERE telegram_username ILIKE '%johnhidebrand%'");
    if (res2.rowCount > 0) {
        console.log("Found in bots:", res2.rows[0].telegram_bot_token);
        checkTelegram(res2.rows[0].telegram_bot_token);
    } else {
        console.log("Bot not found in DB.");
    }
  } else {
      console.log("Found in bot_pool:", res.rows[0].bot_token);
      checkTelegram(res.rows[0].bot_token);
  }
  await client.end();
}

async function checkTelegram(token) {
    // using dynamic fetch
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = await response.json();
    console.log("Webhook Info:", data);
}

main().catch(console.error);
