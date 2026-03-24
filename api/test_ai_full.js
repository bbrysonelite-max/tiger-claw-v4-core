const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function run() {
    process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? (()=>{throw new Error("Set GOOGLE_API_KEY env var")})();
    
    // Import ai.js to get buildSystemPrompt
    const aiService = require('./dist/services/ai.js');
    
    // Load tools map directly from the transpiled code
    const mockTenant = {
        name: "John Browser",
        flavor: "network-marketer",
        language: "English"
    };
    
    const systemInstruction = aiService.buildSystemPrompt(mockTenant);
    console.log("System prompt length:", systemInstruction.length);

    // Get the tools. Wait, aiService doesn't export geminiTools.
    // Let's just import tools and map them EXACTLY like ai.js does currently in dist!
    const toolsDir = path.join(__dirname, 'dist', 'tools');
    const files = fs.readdirSync(toolsDir).filter(f => f.startsWith('tiger_') && f.endsWith('.js'));
    let toolsMap = [];
    for(const f of files) {
        const tool = require(path.join(toolsDir, f));
        const toolObj = tool[f.replace('.js', '')] || tool.default;
        if(toolObj && toolObj.name) toolsMap.push(toolObj);
    }

    function mapToGoogleSchema(param) {
        if (!param) return param;
        if (Array.isArray(param)) return param.map(mapToGoogleSchema);
        if (typeof param !== 'object') return param;
        const mapped = { ...param };
        if (mapped.type && typeof mapped.type === 'string') mapped.type = mapped.type.toUpperCase();
        if (mapped.properties) {
            for (const [k, v] of Object.entries(mapped.properties)) mapped.properties[k] = mapToGoogleSchema(v);
        }
        if (mapped.items) mapped.items = mapToGoogleSchema(mapped.items);
        return mapped;
    }

    const geminiTools = [{
        functionDeclarations: toolsMap.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters ? mapToGoogleSchema(t.parameters) : { type: "OBJECT", properties: {} },
        }))
    }];

    const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    try {
        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction,
            tools: geminiTools
        });
        const chat = model.startChat({});
        const res = await chat.sendMessage("hello");
        console.log("Finish Reason:", res.response.candidates[0]?.finishReason);
        console.log("Function calls:", JSON.stringify(res.response.functionCalls?.(), null, 2));
    } catch(err) {
        console.error("Error API:", err);
    }
}
run();
