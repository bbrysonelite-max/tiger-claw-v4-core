// Tiger Claw — Lawyer / Attorney Flavor
// Single-oar: find prospective clients, nurture to a free consultation booking.
// IMPORTANT: All communications must comply with applicable bar association rules
// on attorney advertising and solicitation. Bot schedules consultations only —
// it does not provide legal advice.

import type { FlavorConfig } from "../types.js";

export const LAWYER_FLAVOR: FlavorConfig = {
  key: "lawyer",
  displayName: "Lawyer / Attorney",
  description: "Single-oar prospecting engine for attorneys. Finds prospective clients in the attorney's practice area, nurtures to a free consultation booking. Never provides legal advice — consultation scheduling only.",
  professionLabel: "Lawyer / Attorney",
  defaultKeywords: ["need a lawyer", "legal consultation", "free legal advice", "attorney near me", "legal help", "law firm recommendation"],
  scoutQueries: [
    "subreddit:legaladvice do I need a lawyer for this situation",
    "subreddit:legaladvice OR subreddit:AskLawyers how to find a good attorney recommendation",
    "subreddit:legaladvice free legal consultation worth it attorney near me",
    "subreddit:legaladvice lawyer referral recommendation how to choose practice area",
    "subreddit:legaladvice OR subreddit:AskLawyers how to choose right attorney for my case",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book a free consultation",
  },

  objectionBuckets: [
    {
      key: "cost",
      label: "Legal Fees / Cost",
      keywords: ["cost", "fee", "expensive", "afford", "charge", "hourly", "retainer", "price", "money", "budget"],
      responseTemplate: [
        `Legal fees — let's talk about this directly.`,
        ``,
        `{tenantName} has {years} in {productOrOpportunity}. {biggestWin}. The consultation is free for a reason: they want to understand your situation before either of you commits to anything.`,
        ``,
        `The cost of not having the right legal help is almost always higher than the cost of getting it. But the consultation is the right place to start — no obligation.`,
      ].join("\n"),
      followUpQuestion: `Would a free consultation to understand the scope and potential cost make sense?`,
    },
    {
      key: "case_strength",
      label: "Not Sure If I Have a Case",
      keywords: ["case", "worth", "viable", "chance", "win", "strong", "weak", "not sure", "small", "qualify"],
      responseTemplate: [
        `Not knowing if you have a case is exactly why you need the consultation.`,
        ``,
        `{tenantName} has {years} evaluating {productOrOpportunity} matters. {biggestWin}. They've seen cases that looked weak turn out to be strong — and vice versa. You need an expert evaluation, not a guess.`,
      ].join("\n"),
      followUpQuestion: `Would you be willing to share a brief summary of your situation? {tenantName} can give you a quick read before the consultation even happens.`,
    },
    {
      key: "process_complexity",
      label: "Process Too Complicated / Intimidating",
      keywords: ["complicated", "confusing", "overwhelming", "process", "court", "paperwork", "legal", "hard", "intimidating"],
      responseTemplate: [
        `Legal processes are complex. That's why attorneys exist.`,
        ``,
        `{tenantName} has {years} guiding people through {productOrOpportunity} cases from start to finish. {differentiator} Their job is to make it manageable for you — not to add complexity.`,
      ].join("\n"),
      followUpQuestion: `What part of the process feels most uncertain right now?`,
    },
    {
      key: "timeline",
      label: "How Long Will It Take",
      keywords: ["time", "long", "how long", "months", "years", "quick", "fast", "timeline", "resolve"],
      responseTemplate: [
        `Timeline is one of the first things {tenantName} addresses in a consultation.`,
        ``,
        `It depends entirely on the specifics of your situation. {years} of {productOrOpportunity} practice means they can give you a realistic picture — not a sales pitch.`,
        ``,
        `{biggestWin}.`,
      ].join("\n"),
      followUpQuestion: `Do you have a deadline or urgency driving the timing question?`,
    },
    {
      key: "trust",
      label: "Trust / Don't Know This Attorney",
      keywords: ["trust", "know", "stranger", "credentials", "reviews", "track record", "who are you", "background", "reputation"],
      responseTemplate: [
        `You don't know {tenantName} yet. Smart to be selective.`,
        ``,
        `{tenantName} has {years} in {productOrOpportunity}. {biggestWin}. Their credentials and case history are verifiable — and the free consultation is a low-stakes way to find out if they're the right fit.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `What would make you confident you're talking to the right attorney?`,
    },
    {
      key: "other_lawyer",
      label: "Already Have / Considering Another Attorney",
      keywords: ["already have", "another lawyer", "other attorney", "different firm", "shopping around", "comparing"],
      responseTemplate: [
        `Shopping for the right attorney is smart. This is not a small decision.`,
        ``,
        `{tenantName} has {differentiator} A second opinion or a comparison consultation is exactly the right approach.`,
      ].join("\n"),
      followUpQuestion: `What are the main things you're looking for in the attorney you choose?`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Cost of Waiting",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `{tenantName} sees this pattern regularly.`,
        ``,
        `Someone waits months to get legal advice on a situation that had a clear path. By the time they come in, statutes of limitations have run, evidence has been lost, or the other side has already moved.`,
        ``,
        `The consultation is free. The cost of not having it isn't.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Expert Evaluation",
      moments: ["general"],
      storyTemplate: [
        `Here's what the consultation actually is.`,
        ``,
        `It's not a sales pitch. It's {tenantName} — with {years} in {productOrOpportunity} — looking at your situation and telling you what they see. Honestly.`,
        ``,
        `If there's nothing they can do, they'll tell you that too. That's {biggestWin} — it's built on being straight with people.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "What is your practice area — family law, personal injury, criminal defense, business law, immigration?", required: true },
      { key: "yearsInProfession", question: "How many years have you been practicing law?", required: true },
      { key: "biggestWin", question: "What's a result or recognition you're proud of — a case outcome (without identifying details), a bar recognition, or a milestone?", required: true },
      { key: "differentiator", question: "What makes your approach or firm different from other attorneys in your practice area?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Who is your ideal prospective client — what situation are they in that needs your help?", required: true },
      { key: "problemFaced", question: "What's the specific legal challenge your ideal client is facing?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for a legal professional.`,
      `You serve {tenantName}, who has {years} practicing {productOrOpportunity}.`,
      `Their track record: {biggestWin}. What sets them apart: {differentiator}.`,
      ``,
      `CRITICAL: You do not provide legal advice. You schedule consultations only.`,
      `All outreach must comply with applicable bar association rules on attorney advertising.`,
    ].join("\n"),
    toneDirectives: [
      "Professional. Trustworthy. Confident without being aggressive.",
      "Never pressure — legal decisions are high-stakes and require trust.",
      "Lead with credentials, track record, and the low-stakes consultation offer.",
      "The goal is one conversation, not a signed retainer in the first message.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate client outreach in the prospect's detected language.",
    neverDoList: [
      "Never provide legal advice, case evaluations, or strategy outside of a consultation.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never make guarantees about case outcomes.",
      "Never violate bar association rules on solicitation — when in doubt, do not send.",
    ],
  },

  discovery: {
    activeSources: ["reddit", "facebook_groups", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hi {{name}},\n\nI'm {{botName}}, assisting the office of {{tenantName}}.\n\nI noticed you were asking about legal challenges. One quick insight from seeing cases unfold: Many people wait until a dispute escalates into litigation before seeking counsel. Getting advice an hour earlier often saves tens of thousands in court fees.\n\nJust food for thought! No pitch here.\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\nBrief story — {{tenantName}} just closed a matter for a client who was incredibly stressed about a very similar situation.\n\nThey reviewed the documents, found a leverage point the opposing side missed, and settled it quietly out of court.\n\nHaving the right set of eyes on the problem completely shifts the outcome.\n\n— {{botName}}",
    authority_transfer: "Hi {{name}},\n\nI want to properly introduce you to {{tenantName}}.\n\nThey have been practicing in {{profession}} for {{years}}. Their most notable recent outcome: {{biggestWin}}. What makes their counsel different: {{differentiator}}.\n\nThey don't take every case. They specifically represent {{icp}}.\n\nIf that describes your situation, a quick consultation is worth your time.\n\n— {{botName}}",
    personal_checkin: "Hi {{name}},\n\nJust a quick check-in — how is the situation progressing?\n\nNo agenda. {{tenantName}} just asked me to follow up with a few folks we've connected with recently to make sure things haven't escalated.\n\n— {{botName}}",
    one_to_ten_part1: "Hi {{name}},\n\nQuick question.\n\nOn a scale of 1-10, how urgent is resolving this legal matter right now? (1 = Just exploring options, 10 = I need representation today).\n\nJust reply with a number.\n\n— {{botName}}",
    one_to_ten_part2: "Understood, thank you.\n\nWhat would it take to make that a 10? Are you waiting on documents, gathering funds, or just unsure if you actually have a case?\n\nI want to make sure I get you the right resources.\n\n— {{botName}}",
    gap_closing: "Got it — {{answer}}.\n\nThat is incredibly common. {{tenantName}} actually resolves that specific hesitation frequently. \n\nDoes knowing that we are highly equipped to navigate that bump up your 1-10 urgency at all?\n\n— {{botName}}",
    scarcity_takeaway: "Hi {{name}},\n\nI'll be direct — {{tenantName}} limits their active caseload to ensure every client gets partner-level attention.\n\nIf you need counsel, let me know. If you've handled it or decided to hold off, totally fine. I just don't want to keep reaching out unnecessarily.\n\n— {{botName}}",
    pattern_interrupt: "Hi {{name}},\n\nBefore I close my file on our end, consider this.\n\nIn legal matters, the cost of doing nothing is rarely zero. The statute of limitations might be running, or the opposing party might be building their case while you wait.\n\nIf you want to review the actual facts instead of just worrying about them, say \"Let's review.\"\n\n— {{botName}}",
    final_takeaway: "Hi {{name}},\n\nThis is my final message. I'm removing you from my active follow-ups.\n\n{{tenantName}} is focused on their active clients. Best of luck with your situation!\n\n— {{botName}}",
    slow_drip_value: "Hi {{name}},\n\nChecking in — just wanted to pass along a quick legal update in our field.\n\n{{tenantName}} has been seeing shifts regarding {{differentiator}}. \n\nHope your situation resolved smoothly. We're here if needed in the future.\n\n— {{botName}}",
    default_fallback: "Hi {{name}}, just checking in. — {{botName}}",
  },
};
