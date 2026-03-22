const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
    const ai = new GoogleGenerativeAI("AIzaSyAq3KzzX1aE3wtjy39j6yDQ2e3dWcb-af0");
    try {
        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash",
            // Passing an array instead of a string directly
            systemInstruction: ["You are a friendly network marketer.", "Help me with my problem."]
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
