// Tiger Claw — Mortgage Broker Flavor
// Dual-oar: find pre-approved buyers ready to purchase AND homeowners
// looking to refinance. Nurture to a discovery call and application.

import type { FlavorConfig } from "../types.js";

export const MORTGAGE_BROKER_FLAVOR: FlavorConfig = {
  key: "mortgage-broker",
  displayName: "Mortgage Broker",
  description: "Dual-oar prospecting engine for mortgage brokers. Finds first-time homebuyers ready to get pre-approved AND homeowners looking to refinance, nurtures to a discovery call and loan application.",
  professionLabel: "Mortgage Broker",
  defaultKeywords: ["first time home buyer", "mortgage pre-approval", "home loan", "refinance", "buying a house", "mortgage rates", "FHA loan", "down payment assistance"],
  scoutQueries: [
    "first time home buyer questions reddit",
    "how to get pre-approved for a mortgage",
    "should I refinance my mortgage now",
    "how much house can I afford",
    "FHA loan requirements first time buyer",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book a mortgage discovery call or start a pre-approval application",
  },

  objectionBuckets: [
    {
      key: "credit_score",
      label: "Worried About Credit / Score Too Low",
      keywords: ["credit", "score", "bad credit", "low score", "debt", "collections", "fico", "credit history", "late payments"],
      responseTemplate: [
        `Credit concerns are the most common thing {tenantName} hears — and the most solvable.`,
        ``,
        `{tenantName} has {years} in mortgage lending. {biggestWin}. There are loan programs specifically for borrowers who are rebuilding, including FHA options with minimums as low as 580. In some cases even lower with the right compensating factors.`,
        ``,
        `{differentiator} A 15-minute call to look at the full picture is the only way to know what's actually possible.`,
      ].join("\n"),
      followUpQuestion: `Do you know your current score, even roughly? That gives {tenantName} a starting point.`,
    },
    {
      key: "rates_too_high",
      label: "Rates Are Too High Right Now",
      keywords: ["rates", "interest rate", "high rates", "wait for rates", "rate drop", "7 percent", "8 percent", "expensive"],
      responseTemplate: [
        `Everyone's watching rates. Here's what {tenantName} tells their clients.`,
        ``,
        `You marry the house, you date the rate. Refinancing when rates drop is a transaction. Missing the house you want because you waited is a loss you can't undo.`,
        ``,
        `{tenantName} has {years} in lending. {biggestWin}. They can run real numbers on what a rate shift actually does to your payment — and whether waiting makes sense for your specific situation.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `What's the purchase price range you're thinking about? That makes the rate math concrete.`,
    },
    {
      key: "not_ready",
      label: "Not Ready Yet / Saving Up",
      keywords: ["saving", "not ready", "need more time", "saving up", "down payment", "few more months", "not yet"],
      responseTemplate: [
        `Saving up is the right move. Getting a plan now is smarter than waiting until the money is there.`,
        ``,
        `{tenantName} works with buyers who are 3, 6, and 12 months out. {biggestWin}. Knowing your target number, your likely rate, and what programs you qualify for means the day you hit your savings goal, you move — you don't start from scratch.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `How far out are you estimating? Even a rough timeline helps {tenantName} know what to set you up for.`,
    },
    {
      key: "already_have_bank",
      label: "Going With Their Own Bank",
      keywords: ["my bank", "chase", "wells fargo", "bank of america", "credit union", "already have", "loyal", "existing relationship"],
      responseTemplate: [
        `Your bank knows your checking account. That's not the same as knowing mortgage programs.`,
        ``,
        `{tenantName} is a broker — not a bank employee. That means they access wholesale rates from multiple lenders and find the best match for your situation, not just whatever product their branch needs to move this quarter.`,
        ``,
        `{tenantName} has {years} in lending. {biggestWin}. {differentiator}`,
        ``,
        `The worst outcome is getting one quote and thinking it's the market.`,
      ].join("\n"),
      followUpQuestion: `Have you gotten a quote from your bank yet? Knowing the number gives {tenantName} something to beat.`,
    },
    {
      key: "overwhelmed",
      label: "Process Seems Complicated / Overwhelming",
      keywords: ["complicated", "confusing", "overwhelming", "don't understand", "paperwork", "stressful", "first time", "don't know where to start"],
      responseTemplate: [
        `First-time buyer overwhelm is real. The process has a lot of moving parts.`,
        ``,
        `{tenantName}'s job is to make it not complicated — for you. {biggestWin}. They walk every client through exactly what to expect, what to gather, and what happens in what order.`,
        ``,
        `{differentiator} A 15-minute call turns "overwhelming" into a checklist.`,
      ].join("\n"),
      followUpQuestion: `What's the part that feels most confusing right now — the pre-approval, the down payment, the timing?`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Waiting Cost",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `{tenantName} ran the numbers on a client who waited 18 months to buy because "the market isn't right."`,
        ``,
        `In that 18 months, the home they wanted went from $380k to $415k. Their rate dropped slightly — but the higher purchase price canceled most of the benefit.`,
        ``,
        `They still bought. They just paid more.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Pre-Approval Is Free Information",
      moments: ["general"],
      storyTemplate: [
        `Getting pre-approved doesn't commit you to anything.`,
        ``,
        `It tells you what you actually qualify for, what your real payment looks like, and whether your plan is close to reality or needs adjusting.`,
        ``,
        `{tenantName} gives you that picture in one conversation. {years} in lending. {biggestWin}.`,
        ``,
        `Information is free. Ignorance is expensive.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "What types of loans do you specialize in — purchase, refinance, FHA/VA, jumbo, or a mix?", required: true },
      { key: "yearsInProfession", question: "How many years have you been in mortgage lending?", required: true },
      { key: "biggestWin", question: "What's a result you're proud of — a challenging approval, a client you got across the finish line, a notable deal?", required: true },
      { key: "differentiator", question: "What makes you different from a buyer just walking into their bank? Why should someone work with you specifically?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Who is your primary client — first-time homebuyers, move-up buyers, investors, refinance candidates?", required: true },
      { key: "problemFaced", question: "What's the biggest obstacle your ideal client is facing when they first come to you?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for a licensed mortgage broker.`,
      `You serve {tenantName}, who has {years} in mortgage lending.`,
      `Their track record: {biggestWin}. What sets them apart: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Confident, trustworthy, financially literate but accessible. Never condescending.",
      "Make the intimidating simple. Numbers, rates, and programs should feel navigable, not overwhelming.",
      "Empathize with the emotional weight of homebuying — this is the biggest financial decision most people make.",
      "The goal is a discovery call or pre-approval start — not a mortgage education session over chat.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate customer outreach in the prospect's detected language.",
    neverDoList: [
      "Never quote a specific rate or APR — rates change daily and quotes require a full application.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never make promises about approval outcomes before a full application is reviewed.",
    ],
  },

  discovery: {
    activeSources: ["facebook_groups", "reddit", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, assistant to {{tenantName}}.\n\nQuick tip: your debt-to-income ratio matters more than most people think when qualifying for a mortgage. If you're planning to buy in the next 12 months, paying down a car payment or credit card now can unlock a significantly better loan amount.\n\nHope that gives you something useful to think about!\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\n{{tenantName}} just closed a deal for a first-time buyer who thought she couldn't qualify because of student loans.\n\nWith the right program and a quick credit optimization plan, she was in her home in 60 days.\n\nThe assumption that you can't qualify is usually wrong. The only way to know is to run the numbers.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nWanted to formally introduce {{tenantName}}.\n\nThey've been in mortgage lending for {{years}} and have {{biggestWin}}. Their approach: {{differentiator}}.\n\nThey work primarily with {{icp}} and specialize in making the process clear, fast, and in your favor.\n\nIf you're thinking about buying or refinancing, a 15-minute call with them is worth your time.\n\n— {{botName}}",
    personal_checkin: "Hey {{name}},\n\nJust following up — how's the homebuying journey going?\n\n{{tenantName}} asked me to check in. They hate leaving people in a state of \"I should probably figure this out soon.\"\n\nWhere are you in the process?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nQuick question.\n\nOn a scale of 1-10, how serious are you about buying or refinancing in the next 6 months? (1 = just exploring, 10 = I'm ready to move now).\n\nJust reply with a number.\n\n— {{botName}}",
    one_to_ten_part2: "Got it.\n\nWhat's the main thing holding you back — credit, down payment, understanding the process, or just waiting on the right time?\n\nJust want to understand what we're working with.\n\n— {{botName}}",
    gap_closing: "That makes sense — {{answer}}.\n\nThat's actually one of the most common things {{tenantName}} helps people navigate. That's specifically why they developed their process — to move people past {{answer}} and into a clear path forward.\n\nKnowing that, does it feel worth a 15-minute call to see what's actually possible?\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\n{{tenantName}}'s calendar is booking up with clients who are ready to move this quarter. They only take a limited number of new pre-approval clients at a time to give everyone proper attention.\n\nI have a discovery call slot I can hold for you, but if the timing isn't right I'll open it to the next person.\n\nLet me know either way!\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nBefore I close your file, one thing worth considering.\n\nEvery month you wait on a home purchase is another month of rent paid toward someone else's equity. That math compounds.\n\nIf you want to see what your actual purchase power looks like right now — no obligation — reply with \"Run my numbers.\"\n\n— {{botName}}",
    final_takeaway: "Hey {{name}},\n\nThis is my last follow-up on your mortgage inquiry. Closing your file now.\n\n{{tenantName}} wishes you the best. When you're ready to move — whether it's in 3 months or 3 years — they're here.\n\nTake care!\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}},\n\nOne more useful piece: getting pre-approved before you start shopping with a realtor gives you real negotiating power. Sellers take pre-approved buyers more seriously — and in competitive markets, it can be the difference between getting the house and losing it.\n\n{{tenantName}} can get that done for you in a few days.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in on your homebuying plans. — {{botName}}",
  },
};
