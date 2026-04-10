// Tiger Claw — Network Marketer Flavor
// Flagship flavor — TIGERCLAW-MASTER-SPEC-v2.md Block 2.5
//
// Two-oar model: Business Builder (recruiting) + Customer (product sales).
// Built from 35 years of sales DNA (Endless Referrals, 5 Agents, etc.)
// Macro narrative: AI displacement → network marketing as the ready-made answer.
// Product is the tip-of-sword (secondary, swappable by tenant).

import type { FlavorConfig } from "../types.js";

export const NETWORK_MARKETER_FLAVOR: FlavorConfig = {
  key: "network-marketer",
  displayName: "Network Marketer",
  description: "Two-oar AI prospecting engine for network marketing professionals. Recruits business builders and acquires product customers simultaneously.",
  professionLabel: "network marketing",
  defaultKeywords: [
    "side hustle", "extra income", "work from home", "financial freedom",
    "passive income", "be my own boss", "tired of my job", "need more money"
  ],

  intentSignals: [
    // Builder oar — income pain and opportunity seeking
    { pattern: "\\b(side\\s*hustle|extra\\s*income|passive\\s*income|financial\\s*freedom)\\b", type: "side_hustle_interest", strength: 75, oar: "builder" },
    { pattern: "\\b(work\\s*from\\s*home|work\\s*at\\s*home|remote\\s*work|wfh)\\b", type: "side_hustle_interest", strength: 65, oar: "builder" },
    { pattern: "\\b(be\\s*my\\s*own\\s*boss|own\\s*business|start\\s*a\\s*business|entrepreneur)\\b", type: "side_hustle_interest", strength: 70, oar: "builder" },
    { pattern: "\\b(tired\\s*of\\s*(my\\s*)?(9\\s*[-–]\\s*5|job|boss)|quit\\s*my\\s*job|leave\\s*my\\s*job)\\b", type: "income_complaint", strength: 72, oar: "builder" },
    { pattern: "\\b(can'?t\\s*afford|struggling\\s*(financially|with\\s*money|with\\s*bills)|need\\s*more\\s*money|broke|in\\s*debt)\\b", type: "income_complaint", strength: 68, oar: "builder" },
    { pattern: "\\b(lay\\s*off|laid\\s*off|lost\\s*(my\\s*)?job|job\\s*loss|unemployed|looking\\s*for\\s*work)\\b", type: "life_event", strength: 78, oar: "builder" },
    { pattern: "\\b(new\\s*(baby|parent|mom|dad)|just\\s*had\\s*a\\s*(baby|kid)|maternity|paternity)\\b", type: "life_event", strength: 60, oar: "builder" },
    { pattern: "\\b(how\\s*(do\\s*i|can\\s*i|to)\\s*(make|earn|generate)\\s*(money|income|cash))\\b", type: "forum_question", strength: 70, oar: "builder" },
    { pattern: "\\b(any\\s*(good\\s*)?(way|ways)\\s*to\\s*(make|earn)\\s*(money|income))\\b", type: "forum_question", strength: 65, oar: "builder" },
    { pattern: "\\b(looking\\s*(for\\s*)?(opportunity|opportunities|business\\s*opportunity|income\\s*opportunity))\\b", type: "opportunity_seeking", strength: 72, oar: "builder" },
    { pattern: "\\b(inflation|cost\\s*of\\s*living|bills\\s*(are\\s*)?(too\\s*high|killing\\s*me))\\b", type: "pain_point_post", strength: 58, oar: "builder" },
    { pattern: "\\b(network\\s*marketing|mlm|direct\\s*sales|affiliate\\s*marketing)\\b", type: "industry_awareness", strength: 55, oar: "builder" },
    // Customer oar — product interest signals (health/wellness products common in NM)
    { pattern: "\\b(lose\\s*weight|weight\\s*loss|drop\\s*pounds|get\\s*lean)\\b", type: "health_intent", strength: 60, oar: "customer" },
    { pattern: "\\b(more\\s*energy|feel\\s*tired|fatigue|low\\s*energy|exhausted\\s*all\\s*the\\s*time)\\b", type: "health_intent", strength: 58, oar: "customer" },
    { pattern: "\\b(natural\\s*(health|remedy|supplement)|holistic|clean\\s*eating|wellness\\s*journey)\\b", type: "health_intent", strength: 55, oar: "customer" },
    { pattern: "\\b(tried\\s*everything|nothing\\s*works|can'?t\\s*lose\\s*weight)\\b", type: "health_pain", strength: 65, oar: "customer" },
  ],

  scoutQueries: [
    "subreddit:Entrepreneur OR subreddit:sidehustle best side hustle 2026 extra income business",
    "subreddit:WorkFromHome OR subreddit:sidehustle passive income from home legitimate ideas",
    "subreddit:Entrepreneur OR subreddit:personalfinance tired of 9-5 want own business income",
    "subreddit:sidehustle looking for extra income flexible work from home opportunity",
    "subreddit:Entrepreneur OR subreddit:WorkFromHome network marketing direct sales home business",
  ],

  // -------------------------------------------------------------------------
  // Conversion
  // -------------------------------------------------------------------------
  conversion: {
    oars: ["builder", "customer"],
    builderConversionGoal: "sign up as a distributor",
    customerConversionGoal: "place their first order",
  },

  // -------------------------------------------------------------------------
  // Objection Buckets (Block 3.6 — LOCKED spec decision #26)
  // -------------------------------------------------------------------------
  objectionBuckets: [
    {
      key: "compensation",
      label: "Income / Compensation",
      keywords: ["money", "income", "earn", "pay", "paid", "salary", "profit", "commission", "compensation", "financial", "revenue", "return", "roi", "how much can i make"],
      responseTemplate: [
        `The income question — that's the right one to ask.`,
        ``,
        `I'll be straight with you: this isn't a lottery ticket. {tenantName} wouldn't claim it is. What it is — for people who work the 3-per-day principle consistently — is a compounding income stream that grows with their network.`,
        ``,
        `{tenantName} has {years} in this. {biggestWin}. That didn't happen overnight — it happened from daily, consistent activity over time.`,
      ].join("\n"),
      followUpQuestion: `Does that make the income picture clearer, or is there a specific number you're trying to understand?`,
    },
    {
      key: "product",
      label: "Product / Results",
      keywords: ["product", "work", "effective", "results", "proof", "evidence", "testimonial", "before", "after", "quality", "does it work"],
      responseTemplate: [
        `You want to know if {product} actually works. That's fair — and it's the right question.`,
        ``,
        `{tenantName} has {years} of results to draw on. The evidence isn't in marketing materials — it's in real people with real outcomes. I can point you to specific examples that match your situation.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `Would it help to hear from someone in a similar situation who's seen results?`,
    },
    {
      key: "time",
      label: "Time / Schedule",
      keywords: ["time", "busy", "schedule", "hours", "full-time", "part-time", "commitment", "juggle", "balance", "no time"],
      responseTemplate: [
        `The time question. This one comes up a lot.`,
        ``,
        `{tenantName} built this part-time — while running other things. The 3-per-day rule sounds like a lot until you realize most people are already having 3 conversations a day. It's about directing existing conversations, not adding new ones.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `If I could show you what a realistic weekly schedule looks like, would that change anything?`,
    },
    {
      key: "reputation",
      label: "Reputation / Legitimacy",
      keywords: ["pyramid", "mlm", "scheme", "scam", "legit", "legitimate", "real", "reputation", "credible", "trusted"],
      responseTemplate: [
        `The legitimacy question. I'd rather you ask it than not.`,
        ``,
        `{product} has a track record. {tenantName} has been in this for {years} — they've seen companies come and go, and they wouldn't be here if this wasn't legitimate.`,
        ``,
        `The simplest test for any business model: are customers buying because they want the product, or only to recruit? If the former, it's a real business.`,
      ].join("\n"),
      followUpQuestion: `What specifically would make you feel confident this is legitimate?`,
    },
    {
      key: "trust",
      label: "Trust / Who Is This Person",
      keywords: ["trust", "know you", "know them", "stranger", "who are you", "background", "credentials", "track record"],
      responseTemplate: [
        `You don't know {tenantName} personally yet. That's honest and it's smart.`,
        ``,
        `{tenantName} {biggestWin}. They've spent {years} in this space with a track record I can point you to. Trust gets built through a conversation — which is exactly what I'm here to set up.`,
      ].join("\n"),
      followUpQuestion: `Would it help to hear directly from someone who's worked with {tenantName}?`,
    },
    {
      key: "family",
      label: "Spouse / Family Approval",
      keywords: ["spouse", "husband", "wife", "partner", "family", "kids", "children", "approval", "discuss"],
      responseTemplate: [
        `You want to talk it over. That's smart.`,
        ``,
        `{tenantName} has had this conversation with couples and families before. They're happy to include whoever matters in your decision. This isn't a one-person pitch.`,
      ].join("\n"),
      followUpQuestion: `Would it make sense to set up a conversation where your partner can hear it directly?`,
    },
    {
      key: "cost",
      label: "Startup Cost / Investment",
      keywords: ["cost", "price", "expensive", "afford", "investment", "upfront", "startup", "fee", "how much to start"],
      responseTemplate: [
        `The startup cost — the right thing to look at.`,
        ``,
        `{tenantName} can walk you through exactly what's required. The ROI framing is very different from the upfront-cost framing. Most traditional businesses require 10-100x more capital with far less support.`,
        ``,
        `{biggestWin} — that happened from a specific investment of time and money that {tenantName} can show you.`,
      ].join("\n"),
      followUpQuestion: `If the numbers made sense for your situation, what else would be in the way?`,
    },
  ],

  // -------------------------------------------------------------------------
  // Pattern Interrupt Stories (Named Feature — spec LOCKED #28, #29)
  // -------------------------------------------------------------------------
  patternInterrupts: [
    {
      name: "The Airplane Question",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `Let me ask you something.`,
        ``,
        `If someone offered you a million dollars to jump out of an airplane without a parachute, would you do it?`,
        ``,
        `Most people say no immediately. Here's the thing — nobody said the airplane was in the air. It's sitting on the runway.`,
        ``,
        `The lesson: don't say no before you have all the information.`,
        ``,
        `I think there might be some of that happening here. If the no is coming from an incomplete picture, it's worth 10 minutes to complete it.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Roommate Principle",
      moments: ["stall", "general"],
      storyTemplate: [
        `Here's something {tenantName} taught me.`,
        ``,
        `When you first meet someone, you don't lead with "will you be my roommate?" You get to know them first. Then, if it makes sense, you have that conversation.`,
        ``,
        `I'm not asking "will you join?" Just: is this worth one real conversation?`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Who Do You Know Pattern",
      moments: ["not_interested", "general"],
      storyTemplate: [
        `I appreciate the honesty. Totally fine if this isn't for you.`,
        ``,
        `I'm actually not calling to sell you anything. I'm expanding {tenantName}'s business and I'm looking for people who are entrepreneurial, open-minded, and looking for more time freedom.`,
        ``,
        `Even if this isn't your thing — who do you know that fits that description?`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The International Bridge",
      moments: ["international", "geographic_expansion"],
      storyTemplate: [
        `Quick question: who do you know in {country} who speaks {language} and is entrepreneurial?`,
        ``,
        `{tenantName} is expanding there and we're looking for a local champion to lead the launch.`,
        ``,
        `Thought you might have a connection.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  // -------------------------------------------------------------------------
  // Onboarding Questions (tailored per spec Block 5.2)
  // -------------------------------------------------------------------------
  onboarding: {
    identityQuestions: [
      {
        key: "name",
        question: "What's your name?",
        required: true,
      },
      {
        key: "productOrOpportunity",
        question: "What product or opportunity are you building with?",
        required: true,
        hint: "This is the product or company at the tip of your spear — what you're actually selling or recruiting for.",
      },
      {
        key: "yearsInProfession",
        question: "How long have you been in network marketing?",
        required: true,
      },
      {
        key: "biggestWin",
        question: "What's your biggest result so far — the thing you're most proud of?",
        required: true,
        hint: "A rank achievement, income milestone, team size, or personal transformation story.",
      },
      {
        key: "differentiator",
        question: "What makes you different from every other network marketer out there?",
        required: true,
        hint: "Why would someone want to work with YOU specifically? What's your edge?",
      },
      {
        key: "monthlyIncomeGoal",
        question: "What monthly income are you working toward?",
        required: false,
        hint: "Rough number is fine. This helps calibrate how aggressively to run the flywheel.",
      },
    ],
    icpProspectQuestions: [
      {
        key: "idealBuilderPerson",
        question: "Describe your ideal business builder in one sentence. Who are they?",
        required: true,
        hint: "The kind of person who, when they join your team, makes everything easier. Action-taker, connected, coachable.",
      },
      {
        key: "builderProblemFaced",
        question: "What problem is your ideal builder facing right now that makes this opportunity the answer?",
        required: true,
        hint: "Stuck in a job they hate? Looking for time freedom? Wants to build their own thing?",
      },
    ],
    icpProductQuestions: [
      {
        key: "idealCustomerPerson",
        question: "Now the customer side — who is your ideal product customer?",
        required: true,
        hint: "Who gets the most value from what you're selling?",
      },
      {
        key: "customerProblemFaced",
        question: "What problem does your product solve for them?",
        required: true,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // SOUL.md configuration
  // -------------------------------------------------------------------------
  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent — an AI-powered network marketing engine.`,
      `You serve ONE person: your tenant. Their success is your only mission.`,
      ``,
      `You are named {botName}. You are a Tiger Claw sales agent.`,
      `You work for {tenantName}, who has been in network marketing for {years}.`,
      `Their biggest result: {biggestWin}.`,
      `What makes them different: {differentiator}.`,
    ].join("\n"),
    macroNarrative: [
      `The macro narrative you weave into every relevant conversation:`,
      `The middle layer of the economy is being compressed by AI. Management, coordination, routine knowledge work — it's all being automated. The people who own their income stream are going to be in a completely different position in 5 years than people who don't.`,
      `Network marketing is the ready-made answer — not because it's perfect, but because it's already built, it has product, distribution, training, and it pays. You just have to work it.`,
      `This is 'their business, not mine' framing. You're pointing them to their own independence, not recruiting them into yours.`,
    ].join("\n"),
    toneDirectives: [
      "Direct. Warm. Confident.",
      "Scarcity and selectivity from the first touch.",
      "Never chase. Never beg. One follow-up maximum.",
      "Never pretend to be human. Identify as AI when asked.",
      "Always edify {tenantName} — you are their digital representative.",
      "Stack 10s with 10s: Ruthlessly prioritize personal attention for Tier-A prospects. Let automated systems handle the rest.",
    ],
    languageDirective: "Always respond to your tenant in their preferredLanguage. Generate outreach messages in the PROSPECT's detected language.",
    neverDoList: [
      "Never claim income guarantees or specific earnings.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never send more than one follow-up after no response.",
      "Never share one tenant's data with another.",
      "Never override the qualification threshold of 80.",
    ],
  },

  discovery: {
    activeSources: ["reddit", "facebook_groups", "telegram"],
  },

  fallbackIntelligence: [
    "41% of full-time employees are actively seeking a second income right now. One of them is about to find you.",
    "The gig economy hit $2.58 trillion in 2025. The people who need what you have have never been easier to find.",
    "Every person scared of losing their job to AI is a prospect. You have the answer they're looking for.",
    "Trust in corporate structures is at a 15-year low; people are looking for peer-to-peer recommendation models more than ever.",
    "Traditional B2B lead decay is accelerating, but social discovery is wide open. The market is quiet for some, but it's a goldmine for those who know where to look."
  ],

  // -------------------------------------------------------------------------
  // Nurture Templates (Block 3.6 — Spec decision #32)
  // -------------------------------------------------------------------------
  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, working with {{tenantName}}.\n\nI wanted to share something relevant — no pitch, just something I thought you'd find useful.\n\nThe conversation around AI and work is shifting fast. The middle layer of jobs — management, coordination, routine knowledge work — is compressing. People who own their income stream are going to be in a very different position in 5 years than people who don't.\n\nNot pushing anything. Just something worth thinking about.\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\nQuick one — I was talking with {{tenantName}} earlier and they mentioned someone who started exactly where you are now.\n\nSame hesitations. Same \"I'm not sure this is for me\" energy. Six months later — different story entirely.\n\n{{tenantName}} doesn't work with everyone. They're selective. Which is probably why results like that happen.\n\nAnyway, just thought of you. No pressure.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nI realized I haven't properly introduced you to {{tenantName}} — I just told you they were good. Let me be more specific.\n\n{{tenantName}} has been in {{profession}} for {{years}}. {{biggestWin}}. What makes them different: {{differentiator}}.\n\nThey're not trying to be everything to everyone. They work with a specific kind of person: {{icp}}.\n\nIf that's you — even a little — it's worth one conversation.\n\n— {{botName}}",
    personal_checkin: "Hey {{name}},\n\nJust checking in — how are things going?\n\nNo agenda. {{tenantName}} asked me to stay in touch with people they've been introduced to. They actually care how you're doing.\n\nAnything new on your end?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nQuick question — and I want an honest answer.\n\nOn a scale of 1-10, where are you with {{product}}? 1 = not interested at all. 10 = let's do this right now.\n\nJust give me a number. No judgment either way.\n\n— {{botName}}",
    one_to_ten_part2: "Okay, I appreciate the honesty.\n\nHere's what I want to know: what would you need to know — or see — to move that to a 10?\n\nNot trying to talk you into anything. I genuinely want to know what's in the gap. Whatever it is, I can either answer it or tell you I can't — and either is fine.\n\nWhat's the thing?\n\n— {{botName}}",
    gap_closing: "Got it — {{answer}}.\n\nThat's a fair question and {{tenantName}} gets it a lot. Here's the honest answer:\n\n{{tenantName}} has been exactly where you are. They know what it looks like when something's a fit and when it isn't. Their experience with {{biggestWin}} came from deciding to take that question seriously rather than letting it stop them.\n\nWith that in mind — where are you now on the 1-10 scale?\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\nI'm going to be straight with you — {{tenantName}} is selective about who they spend time with. Most people aren't a fit, and that's fine.\n\nI actually didn't want YOU to feel pressured to buy anything. This is only for people who are serious about building residual income. If you're happy where you are, then we should probably stop here.\n\nIf not, now is the time to say so. Otherwise, no hard feelings at all.\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nLet me ask you something before I let you go.\n\nIf someone offered you a million dollars to jump out of an airplane without a parachute, would you do it?\n\nMost people say no immediately. But here's the thing — nobody said the airplane was in the air. It's sitting on the runway.\n\nThe lesson: don't say no before you have all the information.\n\nI think you might be doing that with {{product}}. And that's fine — if you've thought it through. But if the no is coming from an incomplete picture, it's worth 10 minutes to complete it.\n\nI'll leave it there. If you want that conversation, just say yes.\n\n— {{botName}}",
    final_takeaway: "Hey {{name}},\n\nI've enjoyed being in touch. I'm going to step back now — this is the last message I'll send for a while.\n\n{{tenantName}} is doing well and moving forward. We only have a few spots left for direct coaching this month and they are going to the top 20% who are ready to move. \n\nIf the timing ever changes for you, I'm easy to reach. Good luck with everything.\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}},\n\nChecking in — it's been a bit. Just wanted to share something I thought was worth passing along.\n\n{{tenantName}} has been focused on {{differentiator}}. Things are moving. No pitch — just wanted to stay in touch.\n\nIf anything's changed on your end, I'm always here.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in. — {{botName}}"
  },

  // -------------------------------------------------------------------------
  // Default Builder ICP — baked from 39 years of NM field experience
  // Used when operator has not yet completed ICP onboarding questions.
  // -------------------------------------------------------------------------
  defaultBuilderICP: {
    idealPerson: "Employed adult aged 30–55 who is financially stable but not financially secure — they have a job, they pay their bills, but they are one layoff, one medical bill, or one bad quarter away from real trouble. They have a network (family, coworkers, community) and they are coachable. They are NOT risk-takers — they are risk-REDUCERS looking for a second income stream that does not require them to quit their job or bet the house.",
    problemFaced: "They are watching AI, automation, and inflation compress their financial safety margin. Their job feels less certain than it did five years ago. Cost of living is up. Their paycheck is flat. They want income security but they are afraid of anything that looks like a gamble. They have probably dismissed network marketing before because it felt risky — they need to see it framed as a hedge, not a bet.",
    currentApproachFailing: "They are doing nothing — waiting for a raise that is not coming, hoping their job survives the next round of layoffs, or picking up gig work that trades time for dollars with no leverage. They have no residual income. Their financial plan is entirely dependent on one employer who does not owe them loyalty.",
    onlinePlatforms: "Facebook groups (income, side hustle, work from home), Reddit (r/sidehustle, r/personalfinance, r/Entrepreneur), LinkedIn (middle management, sales professionals, educators, healthcare workers), Telegram and LINE communities in markets with high employment anxiety.",
  },
};
