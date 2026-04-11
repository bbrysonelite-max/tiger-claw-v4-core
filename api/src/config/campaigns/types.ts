// Tiger Claw — MineCampaign types
//
// A MineCampaign is a hunting-only data pipeline. Unlike a FlavorConfig, it
// has no bot, no soul, no onboarding, no nurture templates. It's a set of
// scoutQueries + an idealProspectProfile + a lead export contract.
//
// Use a MineCampaign when:
//   - You're collecting leads to hand off to an external party (e.g., a
//     contract data feed, a partner intake form)
//   - There's no Tiger Claw bot in the loop
//   - The deliverable is a CSV / webhook / list, not a conversation
//
// Use a FlavorConfig when:
//   - There's a Tiger Claw bot driving the conversation
//   - The operator goes through a wizard / onboarding
//   - You need patternInterrupts, objectionBuckets, nurture templates, etc.

import type { FlavorConfig } from "../types.js";

// Reuse the same IPP shape that flavors use — same gate, same metadata
// stamping. Anything that flows through tiger_refine sees a uniform IPP.
type IdealProspectProfile = NonNullable<FlavorConfig["idealProspectProfile"]>;

export interface MineCampaignLeadField {
  /** Column name in the exported CSV. */
  name: string;
  /** Plain-English description of what this field captures. */
  description: string;
}

export interface MineCampaign {
  /** Stable identifier — used as the campaign_key stamped on every fact. */
  key: string;

  /** Human-readable name shown in admin and exports. */
  displayName: string;

  /** One-paragraph description of who runs this and why. */
  description: string;

  /** Search strings the research agent runs (subreddit:foo bar, etc.). */
  scoutQueries: string[];

  /**
   * Structured Ideal Prospect Profile. Same shape as a flavor's IPP — runs
   * through the same fail-closed relevance gate in tiger_refine.
   */
  idealProspectProfile: IdealProspectProfile;

  /**
   * Documentary schema describing the columns the lead export will contain.
   * The export endpoint pulls from market_intelligence regardless; this is
   * here so the campaign config self-documents what the deliverable looks
   * like and so we can drive a typed CSV header.
   */
  leadSchema: MineCampaignLeadField[];

  /**
   * How leads leave the system. v1 only supports admin-export (CSV download
   * from /admin/campaigns/:key/leads). Webhook delivery comes when volume
   * justifies it.
   */
  deliveryMode: "admin-export";
}
