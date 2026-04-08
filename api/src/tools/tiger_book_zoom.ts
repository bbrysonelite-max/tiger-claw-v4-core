import { ToolContext, ToolResult } from "./ToolContext.js";
// Tiger Claw — tiger_book_zoom Tool
//
// Generates a Cal.com booking link for a qualified prospect and delivers it
// in the conversation. Does NOT auto-book — returns the link for the agent
// to share with the prospect so they can self-schedule.
//
// Prerequisites:
//   1. Operator has a Cal.com account with an event type configured.
//   2. Operator's Cal.com booking URL stored in settings.json under
//      the key `calcomBookingUrl` (e.g. "https://cal.com/brent/zoom-call").
//      Set via: tiger_settings set calcomBookingUrl=<url>
//
// The tool appends Cal.com pre-fill parameters (name) to the base URL so
// the prospect arrives at a form that's already partially filled in.

import { getTenantState } from "../services/tenant_data.js";
import { sendAdminAlert } from "../services/admin_shared.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookZoomArgs {
  prospect_name: string;
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const tiger_book_zoom = {
  name: "tiger_book_zoom",
  description:
    "Generate a Cal.com booking link for a qualified prospect. Call this when a prospect is ready to schedule a Zoom call with the operator. Returns a direct booking URL to share in the conversation. Requires calcomBookingUrl to be set in tenant settings.",
  parameters: {
    type: "OBJECT",
    properties: {
      prospect_name: {
        type: "STRING",
        description: "The prospect's name or display name, used to pre-fill the Cal.com booking form.",
      },
    },
    required: ["prospect_name"],
  },

  async execute(args: BookZoomArgs, context: ToolContext): Promise<ToolResult> {
    const { logger } = context;
    logger.info("tiger_book_zoom: generating booking link", { prospect: args.prospect_name });

    // 1. Load tenant settings
    const settings = (await getTenantState(context.sessionKey, "settings.json")) as Record<string, unknown> | null;
    const calcomBookingUrl = settings?.calcomBookingUrl as string | undefined;

    if (!calcomBookingUrl) {
      logger.warn("tiger_book_zoom: calcomBookingUrl not set in settings.json");
      return {
        ok: false,
        error:
          "No Cal.com booking URL configured. The operator must set calcomBookingUrl in their settings before a booking link can be generated.",
      };
    }

    // 2. Construct pre-filled booking URL
    // Cal.com supports ?name= pre-fill on all event type pages.
    const encodedName = encodeURIComponent(args.prospect_name.trim());
    const separator = calcomBookingUrl.includes("?") ? "&" : "?";
    const bookingLink = `${calcomBookingUrl}${separator}name=${encodedName}`;

    // 3. Notify admin that a booking link was sent
    const tenantId = context.config.TIGER_CLAW_TENANT_ID;
    sendAdminAlert(
      `📅 Booking link sent\nTenant: ${tenantId}\nProspect: ${args.prospect_name}\nLink: ${bookingLink}`
    ).catch(() => {});

    logger.info("tiger_book_zoom: booking link generated", { bookingLink });

    return {
      ok: true,
      output: bookingLink,
      data: { bookingLink, prospectName: args.prospect_name },
    };
  },
};
