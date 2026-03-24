import { getPool, createBYOKUser, createBYOKBot } from "../src/services/db.js";
import * as dotenv from "dotenv";

dotenv.config();

const TOKEN = "8664992580:AAGeeRFSJrwHu09OOOx0uHSx183VZHcKEks";
const USERNAME = "tc_yfb199md_bot";

async function main() {
  const pool = getPool();
  try {
    console.log(`Injecting Test Agent @${USERNAME}...`);

    // 1. Create a dummy test user
    const userId = await createBYOKUser("test_walkthrough@tigerclaw.io", "Walkthrough Test");
    console.log(`✅ User created: ${userId}`);

    // 2. Create the bot/tenant record explicitly
    const botId = await createBYOKBot(userId, "Test Agent", "network-marketer", "live", "test_walkthrough@tigerclaw.io");
    console.log(`✅ Architecture generated! Tenant ID: ${botId}`);

    // 3. Force the token into the active tenant & ensure the webhook triggers properly
    await pool.query(
      "UPDATE tenants SET bot_token = $1, status = 'active' WHERE id = $2",
      [TOKEN, botId]
    );
    console.log(`✅ Token hardcoded to tenant!`);

    // 4. Ensure Webhook is connected to production Cloud Run
    console.log(`=====================================`);
    console.log(`READY FOR HATCHING.`);
    console.log(`1. Open Telegram`);
    console.log(`2. Search for: @${USERNAME}`);
    console.log(`3. Say: "Hello"`);
    console.log(`=====================================`);

  } catch (err: any) {
    console.error("❌ Injection failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
