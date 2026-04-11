// Tiger Claw — Plumber / Trades Professional Flavor
// Single-oar: find homeowners and property managers needing service,
// nurture to a booked appointment.

import type { FlavorConfig } from "../types.js";

export const PLUMBER_FLAVOR: FlavorConfig = {
  key: "plumber",
  displayName: "Plumber / Trades Professional",
  description: "Single-oar prospecting engine for plumbers and trades professionals. Finds homeowners and property managers who need service, nurtures to a booked appointment.",
  professionLabel: "Plumber / Trades Professional",
  defaultKeywords: ["plumber recommendation", "plumbing repair", "burst pipe", "water heater replacement", "drain clog", "plumbing estimate"],
  intentSignals: [
    { pattern: "\\b(burst\\s*pipe|pipe\\s*burst|pipe\\s*broke|pipe\\s*leak|water\\s*everywhere)\\b", type: "plumbing_emergency", strength: 95 },
    { pattern: "\\b(water\\s*heater\\s*(broken|not\\s*working|leaking|replace|repair|died))\\b", type: "water_heater", strength: 90 },
    { pattern: "\\b(clogged\\s*(drain|toilet|sink|shower)|drain\\s*(clog|blocked|slow))\\b", type: "drain_issue", strength: 85 },
    { pattern: "\\b(need\\s*(a\\s*)?plumber|looking\\s*for\\s*(a\\s*)?plumber|recommend\\s*(a\\s*)?plumber|find\\s*(a\\s*)?plumber)\\b", type: "plumber_search", strength: 92 },
    { pattern: "\\b(water\\s*(damage|leak|dripping|flooding|puddle|stain))\\b", type: "water_issue", strength: 80 },
    { pattern: "\\b(low\\s*water\\s*pressure|no\\s*hot\\s*water|running\\s*toilet|toilet\\s*won'?t\\s*flush)\\b", type: "plumbing_issue", strength: 82 },
    { pattern: "\\b(sewer\\s*(smell|backup|line)|septic\\s*(issue|problem|full))\\b", type: "sewer_issue", strength: 88 },
    { pattern: "\\b(plumbing\\s*(estimate|quote|cost|repair|emergency)|how\\s*much\\s*(does|to fix)\\s*(a\\s*)?(plumber|plumbing))\\b", type: "quote_seeking", strength: 78 },
    { pattern: "\\b(diy\\s*(plumbing|fix)|should\\s*i\\s*(call|hire)\\s*(a\\s*)?plumber|plumber\\s*vs\\s*diy)\\b", type: "decision_point", strength: 72 },
  ],

  scoutQueries: [
    "subreddit:HomeImprovement OR subreddit:Plumbing licensed plumber recommendation water heater",
    "subreddit:HomeImprovement plumbing emergency drain clog who to call",
    "subreddit:Plumbing OR subreddit:homeowners water heater repair replace cost estimate",
    "subreddit:DIY OR subreddit:HomeImprovement drain clog professional plumber vs diy fix",
    "subreddit:HomeImprovement OR subreddit:Plumbing trustworthy plumber quote licensed insured",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book a service appointment or get a quote",
  },

  objectionBuckets: [
    {
      key: "price",
      label: "Price / Quote Too High",
      keywords: ["price", "quote", "expensive", "cost", "cheap", "cheaper", "competitor", "bid", "estimate", "too much"],
      responseTemplate: [
        `The price question. Let's be direct about it.`,
        ``,
        `{tenantName} has {years} in this trade. {biggestWin}. Their pricing reflects what it actually costs to do the job right — licensed, insured, with the right materials the first time.`,
        ``,
        `{differentiator} The cost of a redo or a callback is always higher than the cost of doing it correctly.`,
      ].join("\n"),
      followUpQuestion: `What's the issue you're dealing with? I can get {tenantName} to give you a more specific idea of what's involved.`,
    },
    {
      key: "timing",
      label: "Scheduling / Availability",
      keywords: ["schedule", "available", "busy", "when", "soon", "emergency", "weekend", "after hours", "time"],
      responseTemplate: [
        `Timing matters — especially when water is involved.`,
        ``,
        `{tenantName} manages their schedule to handle both planned service and urgent situations. {differentiator} They're not going to leave you with a problem that gets worse.`,
      ].join("\n"),
      followUpQuestion: `Is this urgent or something you're planning ahead for? That changes what I can offer you.`,
    },
    {
      key: "trust",
      label: "License / Trust / Never Used Them Before",
      keywords: ["license", "insure", "trust", "verified", "background", "who are you", "legit", "certified", "reliable"],
      responseTemplate: [
        `You want to know who you're letting into your home. Exactly right.`,
        ``,
        `{tenantName} is licensed and insured, has {years} in the trade, and {biggestWin}. Every job comes with a paper trail — permit where required, warranty on labor.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `What would make you comfortable moving forward with a service call?`,
    },
    {
      key: "diy",
      label: "Thinking About DIY",
      keywords: ["diy", "myself", "youtube", "fix it", "do it", "husband", "wife", "friend", "handy"],
      responseTemplate: [
        `Some plumbing issues are absolutely DIY-able. Some aren't.`,
        ``,
        `{tenantName} has seen both — and the calls they get after a DIY attempt gone wrong are some of the most expensive jobs they do. {biggestWin}.`,
        ``,
        `If you want, I can have {tenantName} give you a quick read on whether your situation is one to tackle yourself or not. No charge for the opinion.`,
      ].join("\n"),
      followUpQuestion: `What's the issue? A quick description helps {tenantName} tell you what you're actually dealing with.`,
    },
    {
      key: "existing_quote",
      label: "Got Another Quote",
      keywords: ["another quote", "other plumber", "competitor", "comparing", "second opinion", "cheaper offer"],
      responseTemplate: [
        `Shopping quotes is smart.`,
        ``,
        `{tenantName} will give you their best price for doing the job right — not a low number to win the bid and find surprises on the day. {years} in this trade and {biggestWin}.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `What does the scope of work look like? I can make sure you're comparing the same thing.`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Slow Leak",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `{tenantName} has a saying.`,
        ``,
        `A slow leak doesn't stay slow. It finds the path of least resistance — and that path usually goes through something expensive.`,
        ``,
        `The jobs that cost the most are the ones that sat for a month while someone decided whether to call.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Right Person for the Job",
      moments: ["general"],
      storyTemplate: [
        `Here's what {years} in the trades teaches you.`,
        ``,
        `Every job looks simple until it isn't. The people who do this work every day know what's behind the wall before they open it.`,
        ``,
        `{tenantName} has {biggestWin} — that didn't come from guessing.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "What trades services do you offer — plumbing, HVAC, electrical, general contracting?", required: true },
      { key: "yearsInProfession", question: "How many years have you been in the trade?", required: true },
      { key: "biggestWin", question: "What's a result you're proud of — a complex job, a customer testimonial, a milestone in your business?", required: true },
      { key: "differentiator", question: "What makes you different from every other tradesperson in your area?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Who is your ideal client — homeowners, property managers, commercial clients?", required: true },
      { key: "problemFaced", question: "What's the most common problem they come to you with?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for a licensed trades professional.`,
      `You serve {tenantName}, who has {years} in {productOrOpportunity}.`,
      `Their track record: {biggestWin}. What sets them apart: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Straight-talking. Practical. Trustworthy.",
      "Lead with credentials, licensing, and the specific problem you're solving.",
      "Never promise results before seeing the job.",
      "The goal is a booked appointment — not a sale over chat.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate customer outreach in the prospect's detected language.",
    neverDoList: [
      "Never give a price quote without the tenant reviewing the scope of work.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never guarantee outcomes on jobs the tenant hasn't assessed in person.",
    ],
  },

  discovery: {
    activeSources: ["facebook_groups", "reddit", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, dispatch assistant for {{tenantName}}.\n\nSaw you might be dealing with a house issue. Quick tip from the field: Most \"minor\" leaks hide major wall damage. If you ever have a slow drip, don't just put a bucket under it; shut off the main valve if you can't fix it immediately.\n\nHope that saves you a headache!\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\nQuick one — {{tenantName}} just got back from a job where a homeowner tried to DIY a pipe fix using YouTube. It nearly flooded their kitchen.\n\nWe got out there, replaced the faulty valve in 30 minutes, and secured the warranty.\n\nSometimes paying a pro saves you the cost of a new floor.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nJust wanted to properly introduce {{tenantName}}.\n\nThey've been in {{profession}} for {{years}}. Their proudest recent job: {{biggestWin}}. What makes their crew totally different: {{differentiator}}.\n\nThey don't do sloppy work. They specialize in helping {{icp}}.\n\nIf you need it done right the first time, they're the ones to call.\n\n— {{botName}}",
    personal_checkin: "Hey {{name}},\n\nJust checking in — did you get that issue sorted out?\n\n{{tenantName}} asked me to follow up. We hate leaving people hanging when they have home issues.\n\nEverything dry and working over there?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nQuick question.\n\nOn a scale of 1-10, how urgent is your need for a service call? (1 = Just getting quotes for later, 10 = I have water spraying everywhere).\n\nJust reply with a number.\n\n— {{botName}}",
    one_to_ten_part2: "Got it.\n\nWhat's keeping you from booking a truck right now? Is it budget, unsure of exactly what the problem is, or trying to see if a buddy can fix it first?\n\nJust want to understand where you're at.\n\n— {{botName}}",
    gap_closing: "Makes sense — {{answer}}.\n\nWe hear that a lot. Actually, {{tenantName}} is built specifically to address that, which is how we manage {{biggestWin}}.\n\nDoes knowing we can navigate that obstacle change your urgency to get it fixed?\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\nThe schedule is filling up fast this week and {{tenantName}}'s trucks are almost fully dispatched.\n\nI have a slot I can hold for you, but if you don't need us right now, I need to open it up for emergency calls.\n\nLet me know either way!\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nBefore I pull your ticket out of the queue, remember this.\n\nWater damage is undefeated. A $200 fix today can turn into a $5,000 mold remediation next month if it's ignored.\n\nIf you want peace of mind instead of crossing your fingers, hit reply and say \"Send the truck.\"\n\n— {{botName}}",
    final_takeaway: "Hey {{name}},\n\nThis is my last message regarding your service request. I'm closing the ticket.\n\n{{tenantName}}'s crew is out in the field. If you have an emergency later, keep our number handy.\n\nTake care!\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}},\n\nChecking in! Highlighting a quick home maintenance tip.\n\n{{tenantName}} has been advising everyone about {{differentiator}}. Definitely something to keep an eye on as the seasons change.\n\nStay dry!\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in. — {{botName}}",
  },
};
