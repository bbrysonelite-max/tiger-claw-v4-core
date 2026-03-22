const { GoogleGenerativeAI } = require('@google/generative-ai');

function mapToGoogleSchema(param) {
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

const tiger_onboard = {
  name: "tiger_onboard",
  description: "Run the onboarding interview flow.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string" },
      response: { type: "string" }
    },
    required: ["action"],
  },
};

const toolsMap = [tiger_onboard];
const geminiTools = [{
    functionDeclarations: toolsMap.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: mapToGoogleSchema(tool.parameters),
    })),
}];

async function run() {
    const ai = new GoogleGenerativeAI("AIzaSyAq3KzzX1aE3wtjy39j6yDQ2e3dWcb-af0");
    try {
        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash",
            // The exact prompt we use
            systemInstruction: `ONBOARDING RULE — HIGHEST PRIORITY:\nOn EVERY incoming user message, your FIRST action must be to call tiger_onboard with action="status".\n`,
            tools: geminiTools
        });
        const chat = model.startChat({});
        const res = await chat.sendMessage("hello");
        console.log("Raw Response parts:", JSON.stringify(res.response.candidates[0]?.content?.parts, null, 2));
        try {
            console.log("Text:", res.response.text());
        } catch(e) { console.log("Text error", e.message); }
        console.log("Finish Reason:", res.response.candidates[0]?.finishReason);
        console.log("Function calls:", JSON.stringify(res.response.functionCalls?.(), null, 2));
    } catch(err) {
        console.error("Error:", err);
    }
}
run();
