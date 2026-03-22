import { ToolContext, ToolResult } from "./ToolContext.js";
// Tiger Claw — tiger_knowledge Tool
// Bridges the V4 Stateless Architecture to the user's Mini-RAG (Retrieval-Augmented Generation) API.
// Allows the bot to instantly search unstructured PDFs, YouTube transcripts, and manuals.

export const tiger_knowledge = {
  name: "tiger_knowledge",
  description: "Use this tool to search internal company documents, PDFs, manuals, and compensation plans for factual answers. ALWAYS use this tool if the prospect asks a hyper-specific question about the product, pricing, or rules that you do not instantly know.",
  parameters: {
    type: "OBJECT",
    properties: {
      query: {
        type: "STRING",
        description: "The specific search query to look up in the documents.",
      },
      k: {
        type: "NUMBER",
        description: "The number of text chunks to retrieve. (Default: 5, Max: 10)",
      },
    },
    required: ["query"],
  },

  async execute(args: { query: string; k?: number }, context: any) {
    context.logger.info("tiger_knowledge: querying Mini-RAG API", { query: args.query });

    const ragUrl = process.env.MINI_RAG_API_URL;
    if (!ragUrl) {
      return {
        ok: false,
        error: "Server configuration missing MINI_RAG_API_URL environment variable.",
      };
    }

    try {
      const endpoint = `${ragUrl.replace(/\/$/, '')}/api/v1/ask`;
      const k = args.k ?? 5;
      
      const formBody = new URLSearchParams();
      formBody.append("query", args.query);
      formBody.append("k", Math.min(Math.max(1, k), 10).toString());
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Send an API key if Mini-RAG requires it in production
          ...(process.env.MINI_RAG_API_KEY && { "Authorization": `Bearer ${process.env.MINI_RAG_API_KEY}` })
        },
        body: formBody.toString(),
      });

      if (!response.ok) {
        let errText = await response.text();
        context.logger.error("tiger_knowledge: API rejected request", { status: response.status, body: errText });
        return { ok: false, error: `RAG API Error ${response.status}: ${errText}` };
      }

      const data = await response.json();
      
      return {
        ok: true,
        answer: data.answer,
        citations: data.citations ?? [],
        confidenceScore: data.score?.total ?? null
      };
      
    } catch (err: any) {
      context.logger.error("tiger_knowledge: fatal network error", err);
      return { ok: false, error: err.message ?? String(err) };
    }
  },
};
