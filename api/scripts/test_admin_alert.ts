import "dotenv/config";
import { sendAdminAlert } from "./src/routes/admin";

async function test() {
  console.log("Attempting to send admin alert...");
  await sendAdminAlert("🚨 Local Fire Test — testing admin alert connectivity.");
  console.log("Done.");
}

test().catch(console.error);
