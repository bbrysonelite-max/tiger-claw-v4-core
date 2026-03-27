// Tiger Claw — Airbnb Host Flavor
// Single-oar: find guests and co-hosts, nurture to a booking or co-host agreement.

import type { FlavorConfig } from "../types.js";

export const AIRBNB_HOST_FLAVOR: FlavorConfig = {
  key: "airbnb-host",
  displayName: "Airbnb Host",
  description: "Single-oar prospecting engine for short-term rental hosts. Finds guests and co-host partners, nurtures to a booking inquiry or co-host agreement.",
  professionLabel: "short-term rentals",
  defaultKeywords: [
    "want to start an airbnb",
    "buying an airbnb",
    "short term rental investing",
    "str regulations",
    "rent arbitrage",
    "managing airbnbs",
    "airbnb host tips"
  ],
  scoutQueries: [
    "should I start an airbnb reddit",
    "airbnb vs long term rental which is better",
    "how to get more bookings on airbnb",
    "airbnb co-hosting worth it",
    "short term rental investing first property advice",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book a stay or start a co-host conversation",
  },

  objectionBuckets: [
    {
      key: "price",
      label: "Nightly Rate Too High",
      keywords: ["price", "expensive", "cost", "rate", "cheaper", "discount", "afford", "budget"],
      responseTemplate: [
        `The rate question — let's talk about it.`,
        ``,
        `{tenantName} has {years} in short-term rentals. {biggestWin}. Their pricing reflects what the market is actually bearing — not what the listing looks like on paper.`,
        ``,
        `{differentiator} Value isn't just the room. It's the experience, the location, the host.`,
      ].join("\n"),
      followUpQuestion: `What dates are you looking at? I can see if there's flexibility.`,
    },
    {
      key: "competition",
      label: "Too Many Listings",
      keywords: ["competition", "other listings", "alternatives", "similar", "options", "other places"],
      responseTemplate: [
        `There are other listings. That's true.`,
        ``,
        `{tenantName}'s {biggestWin}. They're selective about who they host — because the right guest and the right property create the right experience.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `What specifically are you looking for that you haven't found yet?`,
    },
    {
      key: "availability",
      label: "Availability / Dates",
      keywords: ["available", "dates", "when", "open", "booking", "calendar", "flexible"],
      responseTemplate: [
        `The availability question.`,
        ``,
        `{tenantName} manages their calendar carefully — they don't overbook and they don't rush turnarounds. That's part of why their reviews look the way they do.`,
        ``,
        `{biggestWin}.`,
      ].join("\n"),
      followUpQuestion: `What dates work for you? Let me check.`,
    },
    {
      key: "trust",
      label: "Trust / Never Stayed Airbnb Before",
      keywords: ["trust", "safe", "legit", "real", "airbnb", "first time", "reviews", "verified"],
      responseTemplate: [
        `First time using Airbnb or just first time with this property? Either way, fair concern.`,
        ``,
        `{tenantName} has {years} of hosting experience and a track record of reviews that speaks for itself. {biggestWin}.`,
      ].join("\n"),
      followUpQuestion: `What would make you feel completely comfortable booking?`,
    },
    {
      key: "cohost_skepticism",
      label: "Co-Host / Partnership Skepticism",
      keywords: ["co-host", "partner", "manage", "split", "share", "fee", "percentage", "how does it work"],
      responseTemplate: [
        `The co-host question. Smart to look into this carefully.`,
        ``,
        `{tenantName} has been co-hosting for {years}. {biggestWin}. They're not taking on properties they can't run well — so they're selective about which partnerships they take on.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `Do you have a property you're thinking about listing? I can pass the details to {tenantName}.`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Empty Bedroom",
      moments: ["stall", "general"],
      storyTemplate: [
        `Quick thought.`,
        ``,
        `Every night a property sits empty is a night of income that doesn't come back. {tenantName} learned this when they first started. {biggestWin}.`,
        ``,
        `The question isn't "is this perfect?" It's "is this the right move to stop leaving money on the table?"`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Right Guest",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `Here's something {tenantName} always says.`,
        ``,
        `Not every guest is the right guest. Not every property is the right property. But when it's right — it's a completely different experience than anything a hotel offers.`,
        ``,
        `I think you might be the right fit. But you'd have to take one step to find out.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "Tell me about your property — where is it and what makes it special?", required: true },
      { key: "yearsInProfession", question: "How long have you been hosting?", required: true },
      { key: "biggestWin", question: "What's your best hosting result — a great review, occupancy record, or milestone?", required: true },
      { key: "differentiator", question: "What makes your property and hosting style different from every other listing in your area?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Who is your ideal guest — or co-host partner if that's what you're looking for?", required: true },
      { key: "problemFaced", question: "What's the main thing they're trying to solve that your property or co-host arrangement answers?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for a short-term rental host.`,
      `You serve {tenantName}, who has {years} of Airbnb and short-term rental experience.`,
      `Their property: {productOrOpportunity}. Their biggest result: {biggestWin}.`,
      `What makes them different: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Warm. Genuine. Helpful — not salesy.",
      "You're matching people to a great experience, not selling them something they don't want.",
      "Lead with the property's strengths and the host's track record.",
      "Earn trust first. The booking follows.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate guest outreach in the prospect's detected language.",
    neverDoList: [
      "Never guarantee specific availability without checking with the tenant.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never overpromise on amenities or features.",
    ],
  },

  discovery: {
    activeSources: ["facebook_groups", "reddit", "telegram"],
  },

  // -------------------------------------------------------------------------
  // Nurture Templates (Block 3.6 — Spec decision #32)
  // -------------------------------------------------------------------------
  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, assisting {{tenantName}}.\n\nI noticed you're exploring the Short Term Rental space. Just a quick tip: the days of throwing IKEA furniture in a house and making $5k/mo are over. The top 10% of hosts are making 90% of the profit right now because they treat it like hospitality, not just real estate.\n\nSomething to consider if you're planning to launch.\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\nQuick story — {{tenantName}} helped someone a few months ago who was stuck in analysis paralysis, worried about saturation.\n\nThey finally launched using our specific framework. First month: $6,000 gross. They realized \"saturation\" only affects mediocre listings.\n\nThought that might encourage you if you're still on the fence.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nI should tell you a bit more about {{tenantName}}.\n\nThey have been operating in the STR space for {{years}}. Their biggest recent win: {{biggestWin}}. What sets them apart: {{differentiator}}.\n\nThey only work with people who treat this as a serious business: {{icp}}.\n\nIf that aligns with your goals, a 15-minute call will save you thousands in costly rookie mistakes.\n\n— {{botName}}",
    personal_checkin: "Hi {{name}},\n\nJust checking in — how goes the Airbnb journey?\n\nNo pitch or anything. {{tenantName}} just likes to keep tabs on the operators we connect with.\n\nHit any roadblocks recently?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nQuick 1-10 question for you.\n\nWhere are you at with launching or scaling your STR portfolio? (1 = Just watching YouTube videos about it, 10 = Ready to execute today).\n\nJust reply with a number.\n\n— {{botName}}",
    one_to_ten_part2: "Okay, makes sense.\n\nWhat's keeping you from being a 10? Is it capital, finding the right property, or just knowing the exact next step?\n\nI'm just trying to understand the gap so I can send you the right resources (or tell you if we can't help).\n\n— {{botName}}",
    gap_closing: "Ah, got it — {{answer}}.\n\nThat's literally the #1 bottleneck for most aspiring hosts. {{tenantName}} spent a long time dialing in a system to solve exactly that, which is how they achieved {{biggestWin}}.\n\nDoes knowing there's a proven system for that bump up your 1-10 readiness at all?\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\nI'm going to be completely upfront — {{tenantName}} is busy actually running their portfolio and only mentors/consults a few people at a time.\n\nI don't want to keep buzzing your phone if you're not ready to take action. If you're serious, let me know. If you're just kicking the tires, that's totally fine, but I'll step back.\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nBefore I close your file, think about this.\n\nEvery month you wait to launch your STR is a month of cash flow you never get back. The \"perfect time\" doesn't exist; you just get better at solving the problems.\n\nIf you're ready to stop researching and start doing, let's get you on a call with {{tenantName}}. Just reply \"Let's build.\"\n\n— {{botName}}",
    final_takeaway: "Hey {{name}},\n\nLast message from me. I'll take you off my active outreach list.\n\n{{tenantName}} is focused on their active properties and clients right now. If you ever decide to jump into the arena, we're around.\n\nGood luck!\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}},\n\nChecking in! Just wanted to shoot over a quick STR update.\n\n{{tenantName}} has been seeing a lot of shifts with {{differentiator}}. The market favors pros more than ever.\n\nHope you're doing well. No need to reply unless you need something.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in. — {{botName}}"
  },
};
