import { GoogleGenerativeAI } from "@google/generative-ai";

const key = process.env["GOOGLE_API_KEY"] ?? "";
if (!key) { console.error("Set GOOGLE_API_KEY env var before running this script."); process.exit(1); }
const genAI = new GoogleGenerativeAI(key);

async function test() {
  try {
    console.log("Pinging google generative language 2.0 API...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent("Respond with exactly one word: 'YES'");
    console.log("✅ SUCCESS! 2.0-flash is accessible with this key.");
    console.log("Response:", result.response.text());
  } catch (err: any) {
    console.error("❌ FAILED to access 2.0-flash:");
    console.error(err.message);
  }
}
test();
