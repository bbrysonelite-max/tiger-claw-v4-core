import { GoogleGenerativeAI } from '@google/generative-ai';
import { getTenant } from './src/services/db.js';
import { resolveGoogleKey, buildSystemPrompt } from './src/services/ai.js';
// We must extract geminiTools from ai.js
import * as fs from 'fs';

async function run() {
    process.env.GOOGLE_API_KEY = "AIzaSyAq3KzzX1aE3wtjy39j6yDQ2e3dWcb-af0";
    process.env.PLATFORM_ONBOARDING_KEY = "AIzaSyAq3KzzX1aE3wtjy39j6yDQ2e3dWcb-af0";
    
    // load db mock
    const tenantId = "59edee05-6494-43b4-9b98-9b91d77608c7";
    
    // We can't import geminiTools easily since it's not exported.
    // Let's just import ai.ts and use processTelegramMessage but mock the bot
    console.log("Starting test...");
}
run();
