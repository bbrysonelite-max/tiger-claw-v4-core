import { GoogleGenerativeAI } from '@google/generative-ai';
import { toolsMap } from './src/tools.js';

function mapToGoogleSchema(param: any): any {
    if (!param) return param;
    if (Array.isArray(param)) return param.map(mapToGoogleSchema);
    if (typeof param !== 'object') return param;
    
    const mapped = { ...param };
    if (mapped.type && typeof mapped.type === 'string') {
        mapped.type = mapped.type.toUpperCase();
    }
    if (mapped.properties) {
        for (const [k, v] of Object.entries(mapped.properties)) {
            mapped.properties[k] = mapToGoogleSchema(v);
        }
    }
    if (mapped.items) {
        mapped.items = mapToGoogleSchema(mapped.items);
    }
    return mapped;
}

async function run() {
    const geminiTools = [{
        functionDeclarations: Object.values(toolsMap).map((tool: any) => ({
            name: tool.name,
            description: tool.description,
            parameters: mapToGoogleSchema(tool.parameters),
        })),
    }];

    const ai = new GoogleGenerativeAI("AIzaSyAq3KzzX1aE3wtjy39j6yDQ2e3dWcb-af0");
    try {
        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `ONBOARDING RULE — HIGHEST PRIORITY:\nOn EVERY incoming user message, your FIRST action must be to call tiger_onboard with action="status".\n`,
            tools: geminiTools as any
        });
        const chat = model.startChat({});
        const res = await chat.sendMessage("hello");
        console.log("Raw Response parts:", res.response.candidates?.[0]?.content?.parts);
        console.log("Finish Reason:", res.response.candidates?.[0]?.finishReason);
        console.log("Function calls:", res.response.functionCalls?.());
    } catch(err) {
        console.error("Error:", err);
    }
}
run();
