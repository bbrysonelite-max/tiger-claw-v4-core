// Tiger Claw — Sales Tiger Flavor
// Two-oar model: find B2B/B2C sales prospects AND recruit high-performing sales talent.
// Tenant is a sales professional or sales leader building a team and a book of business.

import type { FlavorConfig } from "../types.js";

export const SALES_TIGER_FLAVOR: FlavorConfig = {
  key: "sales-tiger",
  displayName: "Sales Tiger",
  description: "Two-oar prospecting engine for high-performance sales professionals. Simultaneously builds a pipeline of qualified buyers and recruits top sales talent — two growth engines running in parallel.",
  professionLabel: "Sales Professional",
  defaultKeywords: ["sales job opportunity", "sales commission", "b2b sales", "remote sales job", "high ticket sales", "sales career growth"],
  intentSignals: [
    // Recruit oar — find high-performing sales talent
    { pattern: "\\b(high\\s*(commission|ticket)\\s*sales|uncapped\\s*commission|sales\\s*career\\s*(path|change|growth))\\b", type: "sales_career_intent", strength: 80, oar: "builder" },
    { pattern: "\\b(break\\s*into\\s*sales|get\\s*into\\s*sales|start\\s*(a\\s*)?sales\\s*career|new\\s*to\\s*sales)\\b", type: "sales_entry_intent", strength: 75, oar: "builder" },
    { pattern: "\\b(remote\\s*sales\\s*(job|career|opportunity)|work\\s*from\\s*home\\s*sales)\\b", type: "remote_sales_intent", strength: 78, oar: "builder" },
    { pattern: "\\b(sales\\s*(quota|target|performance)\\s*(advice|tips|help)|missing\\s*(my\\s*)?quota)\\b", type: "performance_signal", strength: 70, oar: "builder" },
    { pattern: "\\b(commission\\s*only\\s*(worth\\s*it|sales|job)|straight\\s*commission)\\b", type: "commission_consideration", strength: 72, oar: "builder" },
    // Prospect oar — find buyers
    { pattern: "\\b(b2b\\s*(software|solution|tool|platform)|looking\\s*(for|to\\s*buy)\\s*(a\\s*)?(crm|sales\\s*tool))\\b", type: "b2b_buyer_intent", strength: 75, oar: "customer" },
    { pattern: "\\b(switching\\s*(from|crm|vendor)|alternative\\s*to\\s*[a-z]+|replace\\s*(our\\s*)?[a-z]+)\\b", type: "vendor_switch_intent", strength: 80, oar: "customer" },
    { pattern: "\\b(scale\\s*(my\\s*)?sales\\s*(team|process)|grow\\s*(my\\s*)?revenue|improve\\s*close\\s*rate)\\b", type: "revenue_growth_intent", strength: 72, oar: "customer" },
  ],

  scoutQueries: [
    "subreddit:sales high paying sales career path advice no degree income",
    "subreddit:sales best industries for sales professionals break into commission",
    "subreddit:sales commission only sales worth it pros cons base salary",
    "subreddit:b2bsales OR subreddit:sales how to find b2b sales opportunities leads pipeline",
    "subreddit:sales top sales performer career advice income growth quota",
  ],

  conversion: {
    oars: ["builder", "customer"],
    builderConversionGoal: "join the sales team or partnership",
    customerConversionGoal: "book a discovery call or demo",
  },

  objectionBuckets: [
    {
      key: "roi",
      label: "ROI / Budget Justification",
      keywords: ["roi", "return", "budget", "justify", "cost", "expense", "numbers", "proof", "show me", "value"],
      responseTemplate: [
        `The ROI question. Let's look at it clearly.`,
        ``,
        `{tenantName} has {years} in sales. {biggestWin}. They don't ask for budget without showing a clear return — because that's not how trust gets built in sales.`,
        ``,
        `{differentiator} The question isn't "can we afford this?" It's "what's the cost of not closing this gap?"`,
      ].join("\n"),
      followUpQuestion: `What would make the ROI case clear for your situation? Let's build that picture together.`,
    },
    {
      key: "timing",
      label: "Not the Right Time / Q4 / Budget Cycle",
      keywords: ["timing", "now", "quarter", "q4", "budget cycle", "next year", "not now", "wait", "later", "freeze"],
      responseTemplate: [
        `Timing objections are real — and they're also the classic stall.`,
        ``,
        `{tenantName} has heard every version of this over {years}. {biggestWin}. The ones who waited for "the right time" are still waiting. The ones who moved when they had a clear problem got the result.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `If the timing was right tomorrow, what would need to be in place to move? Let's make sure that's ready.`,
    },
    {
      key: "authority",
      label: "Need Approval / Not the Decision Maker",
      keywords: ["approval", "decision", "boss", "committee", "board", "stakeholder", "sign off", "not me", "others involved"],
      responseTemplate: [
        `Multiple stakeholders — part of every real enterprise sale.`,
        ``,
        `{tenantName} has {years} navigating buying committees. {biggestWin}. They don't just sell to the champion — they help the champion sell internally.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `Who else is involved in this decision? {tenantName} can help build the business case for each stakeholder.`,
    },
    {
      key: "competition",
      label: "Looking at Alternatives / Using a Competitor",
      keywords: ["competitor", "alternative", "comparison", "already have", "current vendor", "similar", "other option"],
      responseTemplate: [
        `You're evaluating options. That's smart — this shouldn't be an impulsive decision.`,
        ``,
        `{tenantName} doesn't win on price. {biggestWin}. They win when the prospect has seen the alternatives and understands what the real differentiator is.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `What would a side-by-side comparison need to show for this to be the obvious choice?`,
    },
    {
      key: "trust",
      label: "Don't Know You / New Relationship",
      keywords: ["trust", "know you", "new", "relationship", "track record", "references", "who are you", "proof"],
      responseTemplate: [
        `You don't know {tenantName} yet. That's honest.`,
        ``,
        `{tenantName} has {years} in this space. {biggestWin}. Trust gets built one conversation at a time — which is why the first ask is simple: one real conversation.`,
      ].join("\n"),
      followUpQuestion: `What would you need to see from {tenantName} to feel confident this is worth a real conversation?`,
    },
    {
      key: "join_team",
      label: "Sales Role / Team Join Skepticism",
      keywords: ["sales job", "commission", "base", "quota", "join", "work for", "team", "hire", "opportunity", "earn"],
      responseTemplate: [
        `Looking at the opportunity from both sides — smart.`,
        ``,
        `{tenantName} has built a track record of {biggestWin}. They don't bring people onto their team who aren't set up to win. {differentiator}`,
        ``,
        `The question to ask is: what's the comp structure, what's the realistic ramp, and what support exists for the first 90 days?`,
      ].join("\n"),
      followUpQuestion: `What would the right sales opportunity look like for where you are right now?`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Pipeline Question",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `{tenantName} asks every prospect one question.`,
        ``,
        `If you don't close this, what does that cost you over the next 12 months?`,
        ``,
        `Not the cost of the product. The cost of the problem staying the same.`,
        ``,
        `{biggestWin} came from helping someone answer that question clearly.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Sales Math",
      moments: ["general"],
      storyTemplate: [
        `Here's {tenantName}'s sales math.`,
        ``,
        `Every qualified conversation that doesn't happen is revenue that doesn't exist. Not deferred — gone.`,
        ``,
        `{years} in this and {biggestWin}. The conversation is always worth having.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Top Performer Pattern",
      moments: ["stall", "general"],
      storyTemplate: [
        `After {years} in sales, {tenantName} noticed something.`,
        ``,
        `Top performers don't wait for perfect conditions. They create forward momentum and adjust as they go.`,
        ``,
        `The people who wait for everything to be right before taking the next step — they're still waiting.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "What are you selling — or what space do you recruit sales talent for?", required: true },
      { key: "yearsInProfession", question: "How many years have you been in sales or sales leadership?", required: true },
      { key: "biggestWin", question: "What's your biggest result — a quota record, a team build, a deal that changed your career?", required: true },
      { key: "differentiator", question: "What makes you different from every other sales professional or sales leader in your space?", required: true },
    ],
    icpProspectQuestions: [
      { key: "idealBuilderPerson", question: "Who is your ideal sales hire — experience level, background, traits?", required: true },
      { key: "builderProblemFaced", question: "What is your ideal sales hire looking for that joining your team answers?", required: true },
    ],
    icpProductQuestions: [
      { key: "idealCustomerPerson", question: "Who is your ideal buyer — title, company size, industry?", required: true },
      { key: "customerProblemFaced", question: "What business problem does your ideal buyer have that your solution solves?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for a high-performance sales professional.`,
      `You serve {tenantName}, who has {years} in sales and sales leadership.`,
      `They sell and build teams in: {productOrOpportunity}. Their biggest result: {biggestWin}.`,
      `Their edge: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Sharp. Confident. Direct — the way a top sales professional actually talks.",
      "No fluff. No filler. Every message should earn the next response.",
      "Scarcity and selectivity from the first touch.",
      "The goal is one qualified conversation — not a close in a message.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate prospect and candidate outreach in the prospect's detected language.",
    neverDoList: [
      "Never make revenue guarantees or income promises to sales candidates.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never send more than one follow-up after no response.",
      "Never override the qualification threshold of 80.",
    ],
  },

  discovery: {
    activeSources: ["linkedin", "reddit", "facebook_groups", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hi {{name}},\n\nI'm {{botName}}, reaching out on behalf of {{tenantName}}.\n\nI saw you were discussing sales strategies. Quick observation from watching {{tenantName}} scale companies: Most founders treat sales as a numbers volume game, but it's actually a conversion rate game. If your cold email is at 1%, doubling volume just burns your domain. You have to fix the offer first.\n\nJust a little value to chew on today.\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\nReal quick — {{tenantName}} recently worked with a company stuck at that revenue plateau you mentioned. \n\nThey dialed in the specific system we use, and within 60 days their pipeline multiplied by 3x. Same team, same budget, just a better conversion engine.\n\nThought you'd appreciate knowing it's possible.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nI should give you a better idea of why I mentioned {{tenantName}}.\n\nThey've spent {{years}} in {{profession}}. Their biggest recent win: {{biggestWin}}. What makes their approach lethal: {{differentiator}}.\n\nWe don't sell to everyone. We specifically work with {{icp}}.\n\nIf that's you, a brief strategy session will probably uncover some serious blind spots in your funnel.\n\n— {{botName}}",
    personal_checkin: "Hi {{name}},\n\nJust checking in — how are the revenue metrics tracking this quarter?\n\nNo sales pitch here. {{tenantName}} asked me to keep in touch with operators we respect.\n\nAny big wins or roadblocks?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nQuick pulse check.\n\nOn a scale of 1-10, how urgent is solving your current pipeline/sales bottleneck? (1 = We're fine with status quo, 10 = We bleed money every day it isn't fixed).\n\nJust drop a number.\n\n— {{botName}}",
    one_to_ten_part2: "Appreciate the transparency.\n\nWhat would it take to be a 10? Is it budget approval, timing, or just not believing you have the right solution mapped out?\n\nJust trying to understand the exact friction point.\n\n— {{botName}}",
    gap_closing: "Understood — {{answer}}.\n\nThat's a classic B2B hurdle. {{tenantName}} has seen that a dozen times, and it's heavily addressed in our core framework (which is how we generated {{biggestWin}}).\n\nDoes knowing we have a specific roadmap to bypass that friction change your urgency (1-10)?\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\nI'll be direct — {{tenantName}} is taking on two new B2B clients this month to implement our scaling systems.\n\nI don't want to follow up if it's just not the right time for your operation. \n\nIf you want to map out a sprint, let's talk. If not, I'll step entirely out of your inbox.\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nBefore I pull your request from the active board, let me ask one thing.\n\nIf your biggest competitor installed a system today that booked them 15 more qualified meetings a week, how much market share would you lose by Q4?\n\nInaction isn't a neutral choice; it costs revenue. \n\nIf you're ready to build the engine, say \"Let's scale.\"\n\n— {{botName}}",
    final_takeaway: "Hey {{name}},\n\nThis is my final outreach. I'm removing you from my active pipeline.\n\n{{tenantName}} works with decisive companies, and I totally respect if the timing isn't right for yours.\n\nBest of luck closing out the year!\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}},\n\nChecking in. Thought you might find this relevant.\n\n{{tenantName}} has been refining {{differentiator}} and the results are pretty disruptive.\n\nHope your sales are tracking well. Reach out if you ever want to re-engage.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in. — {{botName}}",
  },
};
