import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    try {
        const chat = await ai.chats.create({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: "You are a friendly network marketer.",
                temperature: 0.8
            }
        });
        const res = await chat.sendMessage({ message: "hello" });
        console.log("Raw Response parts:", res.candidates?.[0]?.content?.parts);
        console.log("Text:", res.text());
        console.log("Finish Reason:", res.candidates?.[0]?.finishReason);
    } catch(err) {
        console.error("Error:", err);
    }
}
run();
