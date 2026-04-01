// Tiger Claw — Real Estate Agent Flavor
// Single-oar: buyer/seller — TIGERCLAW-MASTER-SPEC-v2.md Block 2.4

import type { FlavorConfig } from "../types.js";

export const REAL_ESTATE_FLAVOR: FlavorConfig = {
  key: "real-estate",
  displayName: "Real Estate Agent",
  description: "Single-oar prospecting engine for real estate agents. Finds buyers and sellers, nurtures to a showing or listing agreement, then connects them with the agent.",
  professionLabel: "real estate",
  defaultKeywords: [
    "want to buy a house",
    "first time home buyer",
    "mortgage rates",
    "looking for an apartment",
    "moving to",
    "relocating to",
    "looking for a realtor",
    "need to sell my house"
  ],

  scoutQueries: [
    "subreddit:FirstTimeHomeBuyer relocating to new city buying a home realtor advice",
    "subreddit:FirstTimeHomeBuyer tips first time home buyer mistakes avoid",
    "subreddit:RealEstate OR subreddit:FirstTimeHomeSeller how to sell my house fast agent",
    "subreddit:RealEstate OR subreddit:FirstTimeHomeBuyer need realtor recommendation buyer agent",
    "subreddit:Mortgages OR subreddit:FirstTimeHomeBuyer mortgage affordability rates 2026 budget",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book a showing or sign a listing agreement",
  },

  objectionBuckets: [
    {
      key: "price",
      label: "Price / Valuation",
      keywords: ["price", "value", "worth", "overpriced", "too high", "low", "valuation", "appraisal"],
      responseTemplate: [
        `The price question. Let's look at it carefully.`,
        ``,
        `{tenantName} has {years} working this market. {biggestWin}. They price based on what the market is actually doing — not what sellers hope it will do.`,
        ``,
        `An overpriced listing sits. A correctly priced listing sells. That difference affects you more than any commission does.`,
      ].join("\n"),
      followUpQuestion: `Would it help to look at what comparable properties have actually sold for recently?`,
    },
    {
      key: "market",
      label: "Market Conditions / Timing",
      keywords: ["market", "timing", "wait", "bubble", "crash", "rates", "interest", "economy"],
      responseTemplate: [
        `The market timing question. It's real.`,
        ``,
        `{tenantName} has been through multiple market cycles over {years} in this business. {differentiator} The people who wait for a "perfect" market often miss the window that was right in front of them.`,
        ``,
        `There are always buyers. There are always sellers. The question is whether the conditions favor your specific situation.`,
      ].join("\n"),
      followUpQuestion: `What would "good timing" look like for you specifically?`,
    },
    {
      key: "agent_fees",
      label: "Agent Fees / Commission",
      keywords: ["commission", "fee", "agent", "realtor", "percentage", "cost"],
      responseTemplate: [
        `The commission question.`,
        ``,
        `Here's how {tenantName} thinks about it: a good agent doesn't cost you money — they make you money. {biggestWin}. The gap between a well-negotiated deal and a poorly-negotiated one is far larger than any commission.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `Would it help to look at the net difference in what you'd actually walk away with?`,
    },
    {
      key: "timing",
      label: "Not Ready Yet",
      keywords: ["ready", "not yet", "wait", "later", "next year", "not now"],
      responseTemplate: [
        `You're not ready yet — I hear that.`,
        ``,
        `{tenantName} isn't going to push. {years} in this business and they've learned that the right transaction happens when the timing is right for the client.`,
      ].join("\n"),
      followUpQuestion: `What would need to change for the timing to work?`,
    },
    {
      key: "condition",
      label: "Property Condition",
      keywords: ["condition", "repair", "fix", "renovate", "update", "old", "worn", "damage", "as-is"],
      responseTemplate: [
        `The condition concern.`,
        ``,
        `{tenantName} has sold properties in every condition. {biggestWin}. There are always buyers — the question is how to position the property correctly.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `Would a quick walkthrough to identify the highest-impact improvements be useful?`,
    },
    {
      key: "financing",
      label: "Buyer Financing",
      keywords: ["financing", "mortgage", "loan", "qualify", "credit", "bank", "lender"],
      responseTemplate: [
        `Financing concerns on the buyer's side.`,
        ``,
        `{tenantName} has strong relationships with lenders who move fast. {years} of transactions means they know who to call.`,
      ].join("\n"),
      followUpQuestion: `Would an introduction to a lender {tenantName} works with help clarify your options?`,
    },
    {
      key: "location",
      label: "Location Concerns",
      keywords: ["location", "area", "neighborhood", "street", "city", "school", "commute"],
      responseTemplate: [
        `The location question.`,
        ``,
        `{tenantName} knows this market — {years} in it. {differentiator} Every location has buyers and sellers. The question is positioning.`,
      ].join("\n"),
      followUpQuestion: `What specifically about the location is the concern?`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Empty House",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `Quick story.`,
        ``,
        `A seller once told {tenantName} they didn't need an agent — they'd sell it themselves. {tenantName} said fine, no problem.`,
        ``,
        `The house sat for six months. By the time they called back, the market had shifted and they accepted 12% less than the original offer.`,
        ``,
        `That difference was real money — not a commission. Real money left on the table.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Market Window",
      moments: ["stall", "general"],
      storyTemplate: [
        `Here's what {tenantName} sees from {years} in the market.`,
        ``,
        `Every person who waited for the "perfect" time either ended up buying/selling at a worse point or never did it at all. The window is now. It's always now for someone.`,
        ``,
        `The question isn't "is the market perfect?" It's "is this the right move for YOU right now?"`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "What market do you specialize in? (City, neighborhoods, property types)", required: true },
      { key: "yearsInProfession", question: "How many years have you been in real estate?", required: true },
      { key: "biggestWin", question: "What's your biggest transaction or proudest result?", required: true, hint: "A record sale, a difficult deal you closed, a client story." },
      { key: "differentiator", question: "What makes you different from other agents in your market?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Describe your ideal client — buyer or seller?", required: true },
      { key: "problemFaced", question: "What's the main challenge your ideal client is facing right now?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for a real estate professional.`,
      `You serve {tenantName}, who has {years} in the {productOrOpportunity} market.`,
      `Their biggest result: {biggestWin}. What makes them different: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Professional. Warm. Market-knowledgeable.",
      "Confident but never pushy.",
      "Always reference specific market data when available.",
      "The goal is to earn one conversation, not to close a deal in a message.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate prospect outreach in the prospect's detected language.",
    neverDoList: [
      "Never make specific price guarantees.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never make representations about specific properties without tenant review.",
    ],
  },

  discovery: {
    activeSources: ["facebook_groups", "reddit", "telegram"],
  },

  fallbackIntelligence: [
    "Mortgage rate volatility has created a unique window for relocation-driven listings. The people who need to move are looking for an expert to lead them.",
    "Micro-migration patterns are shifting interest to secondary cities. The next great neighborhood is being discovered right now.",
    "Inventory is tight, which means correctly priced homes are still moving at record speeds. The market isn't slow; it's just selective.",
    "Institutional buyers are stepping back, opening a massive door for first-time individual buyers. This is their moment to get in.",
    "Social media discovery is now the primary way properties are found by the under-40 demographic. You're already where the buyers are."
  ],

  // -------------------------------------------------------------------------
  // Nurture Templates (Block 3.6 — Spec decision #32)
  // -------------------------------------------------------------------------
  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, the assistant for {{tenantName}}.\n\nI saw you might be exploring the real estate market. Just wanted to drop a quick tip: the market shifts faster than Zillow updates. People who have an agent with off-market access are getting deals 3-5 days before they hit the public boards.\n\nNot pitching you — just something to keep in mind if you're seriously looking.\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\nQuick thought — {{tenantName}} just closed a deal for a client who was in your exact shoes 3 months ago.\n\nSame \"the rates are too high\" hesitations. They ended up finding a property where the seller did a huge rate buydown, saving them hundreds a month.\n\nIt happens when you have someone who knows where to look.\n\nAnyway, thought of you. No pressure.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nI wanted to properly introduce you to {{tenantName}}.\n\n{{tenantName}} has been hyper-focused on this local market for {{years}}. Their biggest recent win: {{biggestWin}}. What makes them different: {{differentiator}}.\n\nThey don't just set up MLS alerts; they actively hunt for exactly what you want: {{icp}}.\n\nIf you're still looking, it's definitely worth 10 minutes on the phone with them.\n\n— {{botName}}",
    personal_checkin: "Hi {{name}},\n\nJust checking in — how's the house hunt (or sale prep) going?\n\nNo agenda. {{tenantName}} likes me to keep tabs on people we've connected with, just to see if the market's been treating them well.\n\nAny updates on your side?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nQuick question, and I'd love an honest answer.\n\nOn a scale of 1-10, how urgent is your need to move forward with {{product}}? (1 = Just browsing for fun, 10 = I need to move/sell ASAP).\n\nJust give me a number, no judgment.\n\n— {{botName}}",
    one_to_ten_part2: "Okay, thanks for being upfront.\n\nSo what's holding you back from a 10 right now? Is it rates, inventory, timing, or something else?\n\nI'm not trying to convince you of anything, just want to know what the primary hurdle is so we know what to keep an eye out for.\n\n— {{botName}}",
    gap_closing: "Got it — {{answer}}.\n\nThat makes total sense and {{tenantName}} hears that daily. Here's a thought:\n\nWaiting on the sidelines often means competing against 10x more buyers when the market finally shifts. {{tenantName}} is actually navigating that exact concern with clients right now by focusing on creative financing.\n\nDid that change your 1-10 urgency at all, or are you still pretty set on waiting?\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\nI'll be straight with you — {{tenantName}} only takes on a handful of active clients at a time so they can give them VIP service.\n\nWe have a couple of spots opening up this week. I don't want to keep following up if you're not ready, so let me know either way.\n\nIf you are serious about making a move, tell me now. If not, no hard feelings.\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nBefore I take you off my active list, consider this.\n\nIf I told you I could get you a house for 1990 prices, you'd buy it instantly, right?\n\nWe don't know what prices will be in 5 years, but waiting guarantees you'll find out the hard way. Refinancing later is easy; buying later when prices rise is hard.\n\nIf you want to sit down with {{tenantName}} and review the actual numbers instead of the headlines, just say \"Let's review.\"\n\n— {{botName}}",
    final_takeaway: "Hey {{name}},\n\nIt's been great chatting, but I'll step back now. This is my last message regarding your search.\n\n{{tenantName}} is staying busy with active clients. If your timing changes and you need an expert, we're easy to find.\n\nBest of luck!\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}},\n\nChecking in — it's been a while. Just a quick market update.\n\n{{tenantName}} has been seeing a shift in {{differentiator}}. Seems like the market is moving slightly. \n\nNo pitch, just wanted to keep you informed. Let me know if you need anything.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in. — {{botName}}"
  },
};
