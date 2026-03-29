// Tiger Claw — Health & Wellness / Personal Services Flavor
// Single-oar: client/patient — TIGERCLAW-MASTER-SPEC-v2.md Block 2.4

import type { FlavorConfig } from "../types.js";

export const HEALTH_WELLNESS_FLAVOR: FlavorConfig = {
  key: "health-wellness",
  displayName: "Health & Wellness",
  description: "Single-oar prospecting engine for health, wellness, and personal service professionals. Finds prospects, nurtures to a booked appointment or service purchase.",
  professionLabel: "health and wellness",
  defaultKeywords: [
    "feel better",
    "natural",
    "wellness",
    "holistic",
    "energy",
    "healthy lifestyle",
    "self-care",
    "transformation",
    "pain relief",
    "mental health"
  ],
  scoutQueries: [
    "subreddit:HealthyLiving OR subreddit:wellness looking for health coach recommendation hire",
    "subreddit:wellness OR subreddit:ChronicPain how to find a good wellness coach",
    "subreddit:ChronicPain OR subreddit:HealthyLiving tried functional medicine chronic issues results",
    "subreddit:ChronicPain natural remedies chronic pain management what worked",
    "subreddit:HealthyLiving OR subreddit:wellness holistic health coaching worth it experience",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book an appointment or purchase a service",
  },

  objectionBuckets: [
    {
      key: "effectiveness",
      label: "Does It Actually Work",
      keywords: ["work", "effective", "results", "proof", "evidence", "does it", "really", "testimonial"],
      responseTemplate: [
        `You want to know if it works. Good question — the right one.`,
        ``,
        `{tenantName} has {years} seeing real results with real people. {biggestWin}. The evidence isn't in the marketing — it's in the outcomes. I can share specific examples that match your situation.`,
      ].join("\n"),
      followUpQuestion: `Would hearing from someone with a similar situation who's seen results be useful?`,
    },
    {
      key: "side_effects",
      label: "Safety / Side Effects",
      keywords: ["safe", "side effects", "risk", "harm", "reaction", "allergic", "dangerous", "concern", "natural"],
      responseTemplate: [
        `Safety is the right thing to ask about.`,
        ``,
        `{product} has been through rigorous testing. {tenantName} wouldn't work with something they didn't believe in — {biggestWin}. I can share the clinical data and safety information.`,
      ].join("\n"),
      followUpQuestion: `Is there a specific safety concern I can address directly?`,
    },
    {
      key: "cost",
      label: "Cost / Affordability",
      keywords: ["cost", "price", "expensive", "afford", "worth", "money"],
      responseTemplate: [
        `The cost question.`,
        ``,
        `{tenantName} believes in value over price. {differentiator} The relevant comparison isn't just the cost of {product} — it's the cost of NOT addressing the problem it solves.`,
        ``,
        `{biggestWin}`,
      ].join("\n"),
      followUpQuestion: `If the cost weren't a factor, would you want to move forward?`,
    },
    {
      key: "time_commitment",
      label: "Time Commitment",
      keywords: ["time", "busy", "schedule", "commitment", "regular", "routine", "consistent"],
      responseTemplate: [
        `The time commitment is a real consideration.`,
        ``,
        `{tenantName} will be honest about what's actually required. {differentiator} Most people find it's less than they assumed once they start.`,
      ].join("\n"),
      followUpQuestion: `What does your current schedule look like — can we figure out what's realistic?`,
    },
    {
      key: "provider",
      label: "Already Have a Provider",
      keywords: ["already", "doctor", "current", "have a", "working with", "my therapist", "my physician"],
      responseTemplate: [
        `You're already working with someone. That's not a problem.`,
        ``,
        `{tenantName} isn't here to replace anyone. What they offer is {differentiator}. A lot of people find it complements what they're already doing.`,
      ].join("\n"),
      followUpQuestion: `What would need to be different for you to consider an additional option?`,
    },
    {
      key: "skepticism",
      label: "General Skepticism",
      keywords: ["skeptical", "doubt", "hesitant", "not sure", "heard it before", "tried it"],
      responseTemplate: [
        `Skepticism is healthy. {tenantName} prefers it.`,
        ``,
        `{years} in this field and {biggestWin}. The results are real and verifiable. The skepticism usually disappears after one honest conversation.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `What would convince you — specifically?`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Doctor's Recommendation",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `Something worth thinking about.`,
        ``,
        `Most people spend more time researching a restaurant than they do on a health decision. They go with what's familiar, not what's actually best.`,
        ``,
        `{tenantName} has {years} helping people who finally decided to look properly. What they found almost always surprised them.`,
        ``,
        `The question isn't "is this perfect?" It's "is this worth a real look?" Almost always, the answer is yes.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Investment in Self",
      moments: ["stall", "general"],
      storyTemplate: [
        `People will spend hundreds on a weekend trip without thinking twice. But when it comes to their own health, they hesitate.`,
        ``,
        `{tenantName} sees this all the time. The hesitation makes sense — it's new, it's uncertain. But the cost of staying where you are is usually higher than the cost of trying something different.`,
        ``,
        `What would it be worth to feel better? Not perfectly — just meaningfully better.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "What service or product do you offer?", required: true },
      { key: "yearsInProfession", question: "How long have you been in health and wellness?", required: true },
      { key: "biggestWin", question: "What's your best client transformation or result?", required: true, hint: "A before-and-after story, a client who achieved something significant." },
      { key: "differentiator", question: "What makes your approach different from others in your field?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Who is your ideal client? Describe them.", required: true },
      { key: "problemFaced", question: "What's the health or wellness challenge they're dealing with right now?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for a health and wellness professional.`,
      `You serve {tenantName}, who has {years} in the field.`,
      `Their specialty: {productOrOpportunity}.`,
      `Best result: {biggestWin}. What makes them different: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Warm. Empathetic. Results-focused.",
      "Meet people where they are — health conversations require patience and care.",
      "Never fear-monger. Never make medical claims.",
      "The goal is to earn a conversation, not to diagnose.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate prospect outreach in the prospect's detected language.",
    neverDoList: [
      "Never make medical diagnoses or treatment claims.",
      "Never guarantee specific health outcomes.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
    ],
  },

  discovery: {
    activeSources: ["facebook_groups", "reddit", "telegram"],
  },

  // -------------------------------------------------------------------------
  // Nurture Templates (Block 3.6 — Spec decision #32)
  // -------------------------------------------------------------------------
  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, working with {{tenantName}}.\n\nI wanted to share something that might be relevant — no pitch, just information.\n\nMore and more people are realizing that their current approach to health isn't giving them the results they want. The people who take a proactive step — even a small one — tend to see the biggest shifts.\n\n{{tenantName}} has been helping people with exactly this. Thought of you.\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\nQuick one — {{tenantName}} was telling me about a client who started in a similar situation to yours.\n\nSame doubts. Same \"I've tried everything\" feeling. But they gave it a real shot, and the results spoke for themselves.\n\n{{tenantName}} doesn't work with everyone — they're selective about who they take on. That's probably why the outcomes are what they are.\n\nJust thought you'd want to know.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nI realized I should properly introduce {{tenantName}} — not just say they're good, but tell you why.\n\n{{tenantName}} has been in {{profession}} for {{years}}. {{biggestWin}}. What sets them apart: {{differentiator}}.\n\nThey work with a specific type of person: {{icp}}.\n\nIf that sounds like you — even a little — it's worth a conversation.\n\n— {{botName}}",
    personal_checkin: "Hey {{name}},\n\nJust checking in — how are you feeling?\n\nNo agenda. {{tenantName}} asked me to stay in touch with people they've connected with. They genuinely care about how you're doing.\n\nAnything new going on?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nQuick question — be honest.\n\nOn a scale of 1-10, where are you with {{product}}? 1 = not interested. 10 = ready to start today.\n\nJust give me a number. No judgment.\n\n— {{botName}}",
    one_to_ten_part2: "Appreciate the honesty.\n\nWhat would need to happen — or what would you need to see — to move that to a 10?\n\nI'm not trying to convince you. I genuinely want to understand what's in the gap. Whatever it is, I can either address it or tell you honestly that I can't.\n\nWhat's the thing?\n\n— {{botName}}",
    gap_closing: "Got it — {{answer}}.\n\nThat's a real concern and {{tenantName}} hears it often. Here's the honest answer:\n\n{{tenantName}} has been in your shoes. They know what it looks like when something works and when it isn't. Their experience with {{biggestWin}} came from taking that exact concern seriously.\n\nWith that context — where are you now on the 1-10?\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\nI'll be direct — {{tenantName}} can only work with a limited number of people at a time, and several of the people I've been reaching out to are moving forward.\n\nI can't keep everyone in the loop forever.\n\nIf you're even a little curious — now is the time to say so. If not, no hard feelings whatsoever.\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nOne more thing before I step back.\n\nPeople will spend thousands on vacations, gadgets, and restaurants without blinking. But when it comes to investing in their own health — the one thing that affects everything else — they hesitate.\n\nI think you might be doing that with {{product}}. And maybe you have good reasons. But if the hesitation is coming from an incomplete picture, it's worth 10 minutes to complete it.\n\nI'll leave it there. If you want that conversation, just say yes.\n\n— {{botName}}",
    final_takeaway: "Hey {{name}},\n\nI've appreciated being in touch. I'm going to step back now — this will be my last message for a while.\n\n{{tenantName}} is doing great things and helping real people. If the timing changes for you, I'm easy to find.\n\nTake care of yourself.\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}},\n\nBeen a bit — just wanted to check in.\n\n{{tenantName}} has been focused on {{differentiator}}. Things are moving. No pitch — just staying in touch.\n\nIf anything's shifted on your end, I'm here.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in. — {{botName}}"
  },
};
