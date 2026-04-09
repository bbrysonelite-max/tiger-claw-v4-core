const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function run() {
    // I am manually setting this to the good key for the local test so it doesn't hit 400 Expired
    const key = process.env.GOOGLE_API_KEY ?? (()=>{throw new Error("Set GOOGLE_API_KEY env var")})().trim();
    const ai = new GoogleGenerativeAI(key);
    
    try {
        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash",
            // systemInstruction: "You are a friendly network marketer.",
            systemInstruction: ["You are Tiger Claw.", "This is a test array of strings."].join('\n')
        });
        const chat = model.startChat({});
        const res = await chat.sendMessage("hello");
        console.log("Raw Response parts:", res.response.candidates[0]?.content?.parts);
        console.log("Text:", res.response.text());
        console.log("Finish Reason:", res.response.candidates[0]?.finishReason);
    } catch(err) {
        console.error("Error:", err);
    }
}
run();
