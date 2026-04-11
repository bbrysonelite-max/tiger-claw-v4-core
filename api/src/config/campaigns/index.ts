// Tiger Claw — MineCampaign registry
//
// MineCampaigns are hunting-only data pipelines, parallel to flavors. The
// orchestrator iterates this registry the same way it iterates FLAVOR_REGISTRY
// and enqueues a research-agent job per campaign with scoutQueries.length > 0.
//
// To add a campaign:
//   1. Create api/src/config/campaigns/<key>.ts exporting a MineCampaign
//   2. Import + register it here
//   3. Lead export becomes available at GET /admin/campaigns/<key>/leads

import type { MineCampaign } from "./types.js";
import { SSDI_TICKET_TO_WORK_CAMPAIGN } from "./ssdi-ticket-to-work.js";

export const MINE_CAMPAIGN_REGISTRY: Record<string, MineCampaign> = {
  "ssdi-ticket-to-work": SSDI_TICKET_TO_WORK_CAMPAIGN,
};

export type { MineCampaign } from "./types.js";
