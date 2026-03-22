const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://botcraft:TigerClaw2026MasterKey!@127.0.0.1:5432/tiger_claw_shared"
  });
  
  try {
      await client.connect();
      
      // Look up bot ID or token
      let token = null;
      let botId = null;

      const res = await client.query("SELECT * FROM bots WHERE name ILIKE '%john%' OR telegram_username ILIKE '%john%'");
      if (res.rowCount > 0) {
          console.log("Found in bots:", res.rows[0]);
          token = res.rows[0].telegram_bot_token;
          botId = res.rows[0].id;
      }
      
      if (!token) {
          const res2 = await client.query("SELECT * FROM bot_pool WHERE bot_username ILIKE '%john%'");
          if (res2.rowCount > 0) {
              console.log("Found in bot_pool:", res2.rows[0]);
              token = res2.rows[0].bot_token;
          }
      }

      if (token) {
        console.log("Fetching Telegram Webhook...");
        const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const data = await response.json();
        console.log("Webhook data:", JSON.stringify(data, null, 2));

        // Let's manually set it to Cloud Run if it's completely wrong!
        // Cloud Run URL is: https://tiger-claw-api-1059104880024.us-central1.run.app 
        if (data && data.result && !data.result.url.includes("tiger-claw-api-10591048")) {
            console.log(`Current webhook URL is WRONG: ${data.result.url}`);
            if (botId) {
                const target = `https://tiger-claw-api-1059104880024.us-central1.run.app/webhooks/telegram/${botId}`;
                console.log(`Setting dynamically to: ${target}`);
                const r2 = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${target}&drop_pending_updates=true`);
                console.log("Set Webhook Result:", await r2.json());
            } else {
                console.log("Cannot set webhook because I don't know the exact Bot ID mapping for the URL.");
            }
        } else {
            console.log("Webhook appears correctly assigned to Cloud Run.");
        }
      } else {
          console.log("No token found for John Hidebrand.");
      }

  } catch (err) {
      console.error(err);
  } finally {
      await client.end();
  }
}
main();
