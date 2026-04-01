import { ToolContext, ToolResult } from "./ToolContext.js";
// Tiger Claw — tiger_postiz Tool
// Multi-channel social media management — v5 Data Refinery extension
//
// What this tool does:
//   1. Lists connected social media channels (X, LinkedIn, Instagram, etc.)
//   2. Schedules or immediately publishes posts across multiple platforms
//   3. Fetches analytics for channels and posts
//
// This tool allows Tiger Claw agents to broadcast high-purity market insights
// from the Data Moat directly to the operator's social profiles, building 
// authority and driving inbound leads.
//
// Stateless: All state lives in the Postiz API. API keys stored encrypted in PostgreSQL.

import { getTenant } from "../services/db.js";
import { decryptToken } from "../services/pool.js";

const DEFAULT_POSTIZ_BASE = "https://api.postiz.com/public/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostizParams {
  action: "list_channels" | "schedule_post" | "get_analytics";
  content?: string;
  channel_ids?: string[];
  schedule_time?: string; // ISO string
  media_urls?: string[];
  channel_id?: string;    // For analytics
}

// ---------------------------------------------------------------------------
// Helper: Postiz API Request
// ---------------------------------------------------------------------------

async function postizRequest(
  endpoint: string,
  method: "GET" | "POST",
  apiKey: string,
  body?: unknown
) {
  const baseUrl = process.env["POSTIZ_API_BASE"] || DEFAULT_POSTIZ_BASE;
  const url = `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.message || data.error || `Postiz API error: ${res.status}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

async function execute(
  params: PostizParams,
  context: ToolContext
): Promise<ToolResult> {
  const { config, logger } = context;
  const tenantId = config.TIGER_CLAW_TENANT_ID;
  const { action } = params;

  try {
    // 1. Resolve Tenant and API Key
    const tenant = await getTenant(tenantId);
    if (!tenant) return { ok: false, error: "Tenant not found." };
    
    const encryptedKey = tenant.postizApiKey;
    if (!encryptedKey) {
      return { 
        ok: false, 
        error: "Postiz API key not configured for this tenant. Operator must add it via the dashboard settings." 
      };
    }
    const apiKey = decryptToken(encryptedKey);

    switch (action) {
      case "list_channels": {
        const integrations = await postizRequest("/integrations", "GET", apiKey);
        
        if (!Array.isArray(integrations) || integrations.length === 0) {
          return { ok: true, output: "No social media channels connected to Postiz yet.", data: { channels: [] } };
        }

        const lines = ["Connected Social Channels:", ""];
        integrations.forEach((int: any) => {
          lines.push(`• [${int.id}] ${int.name} (${int.identifier}) - Platform: ${int.provider}`);
        });

        return {
          ok: true,
          output: lines.join("\n"),
          data: { channels: integrations },
        };
      }

      case "schedule_post": {
        if (!params.content) return { ok: false, error: "Post content is required." };
        if (!params.channel_ids || params.channel_ids.length === 0) {
          return { ok: false, error: "At least one channel_id is required." };
        }

        const payload = {
          content: params.content,
          integrations: params.channel_ids,
          scheduleDate: params.schedule_time || new Date().toISOString(),
          media: params.media_urls?.map(url => ({ url })) || [],
        };

        const result = await postizRequest("/posts", "POST", apiKey, payload);

        return {
          ok: true,
          output: `Successfully ${params.schedule_time ? 'scheduled' : 'published'} post to ${params.channel_ids.length} channel(s). Post ID: ${result.id}`,
          data: result,
        };
      }

      case "get_analytics": {
        if (!params.channel_id) return { ok: false, error: "channel_id is required for analytics." };

        const stats = await postizRequest(`/analytics/platform/${params.channel_id}`, "GET", apiKey);

        const lines = [
          `Analytics for Channel ${params.channel_id}:`,
          `Reach: ${stats.reach || 0}`,
          `Engagement: ${stats.engagement || 0}`,
          `Impressions: ${stats.impressions || 0}`,
        ];

        return {
          ok: true,
          output: lines.join("\n"),
          data: stats,
        };
      }

      default:
        return {
          ok: false,
          error: `Unknown action: "${action}". Valid: list_channels | schedule_post | get_analytics`,
        };
    }
  } catch (err: any) {
    logger.error("tiger_postiz error", { action, err: String(err) });
    return {
      ok: false,
      error: `tiger_postiz error: ${err.message || String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool export
// ---------------------------------------------------------------------------

export const tiger_postiz = {
  name: "tiger_postiz",
  description:
    "Multi-channel social media management via Postiz. Use this to broadcast high-value market insights, " +
    "schedule authority-building content, and track social engagement across platforms (X, LinkedIn, IG, etc.).",

  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list_channels", "schedule_post", "get_analytics"],
        description:
          "list_channels: see connected platforms. schedule_post: publish content. get_analytics: track performance.",
      },
      content: {
        type: "string",
        description: "The text content of the post. Use SOUL.md voice and hope-infused intelligence.",
      },
      channel_ids: {
        type: "array",
        items: { type: "string" },
        description: "IDs of the channels to post to (get these from list_channels).",
      },
      schedule_time: {
        type: "string",
        description: "Optional ISO timestamp for scheduling. If omitted, posts immediately.",
      },
      media_urls: {
        type: "array",
        items: { type: "string" },
        description: "Optional array of image or video URLs to include in the post.",
      },
      channel_id: {
        type: "string",
        description: "Required for get_analytics action.",
      },
    },
    required: ["action"],
  },

  execute,
};

export default tiger_postiz;
