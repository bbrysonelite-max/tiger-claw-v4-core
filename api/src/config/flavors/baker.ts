// Tiger Claw — Baker Flavor
// Single-oar: find customers for custom baked goods, nurture to a first order.

import type { FlavorConfig } from "../types.js";

export const BAKER_FLAVOR: FlavorConfig = {
  key: "baker",
  displayName: "Baker / Pastry Chef",
  description: "Single-oar prospecting engine for custom bakers and pastry chefs. Finds customers for custom orders, wedding cakes, and wholesale accounts, nurturing them to a first order or tasting.",
  professionLabel: "Baker / Pastry Chef",
  defaultKeywords: ["custom cake", "custom cookies", "wedding cake", "cake order", "baked goods", "artisan bakery", "gluten free baked goods"],
  scoutQueries: [
    "subreddit:weddingplanning custom wedding cake recommendations local bakery",
    "subreddit:weddingplanning OR subreddit:Baking where to find custom cakes near me",
    "subreddit:Baking OR subreddit:cakedecorating custom birthday cake small business order",
    "subreddit:weddingplanning best custom bakery wedding cake reviews experience",
    "subreddit:Baking OR subreddit:weddingplanning how to order custom cake process",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "place a custom order or book a tasting",
  },

  objectionBuckets: [
    {
      key: "price",
      label: "Price Too High",
      keywords: ["price", "expensive", "cost", "cheaper", "grocery", "supermarket", "budget", "afford", "too much"],
      responseTemplate: [
        `The price question — I get it.`,
        ``,
        `{tenantName} has {years} baking custom orders. {biggestWin}. A custom cake from {tenantName} isn't the same category as a grocery store cake — it's a specific experience, made exactly for your event.`,
        ``,
        `{differentiator} The difference shows up in the room.`,
      ].join("\n"),
      followUpQuestion: `What's the occasion? I can give you a much more specific idea of what the investment looks like.`,
    },
    {
      key: "taste",
      label: "Haven't Tried / Need to Sample",
      keywords: ["taste", "try", "sample", "tasting", "never had", "not sure", "how does it taste", "quality"],
      responseTemplate: [
        `You want to know if it's actually good before you commit. Totally fair.`,
        ``,
        `{tenantName} offers tastings exactly for this reason. {biggestWin}. The work speaks for itself — you just need the chance to experience it.`,
      ].join("\n"),
      followUpQuestion: `Would a tasting appointment work for you? I can set that up with {tenantName}.`,
    },
    {
      key: "timing",
      label: "Order Timeline / Availability",
      keywords: ["time", "ready", "deadline", "last minute", "date", "available", "rush", "when", "how long"],
      responseTemplate: [
        `Timing matters for custom orders — I hear you.`,
        ``,
        `{tenantName} plans orders carefully so nothing goes wrong on the day. {years} of events means they know how to work backwards from a deadline.`,
        ``,
        `{biggestWin}.`,
      ].join("\n"),
      followUpQuestion: `What's your event date? I can check availability right now.`,
    },
    {
      key: "dietary",
      label: "Dietary Restrictions",
      keywords: ["allergy", "gluten", "dairy", "vegan", "nut", "kosher", "halal", "celiac", "intolerance", "dietary"],
      responseTemplate: [
        `Dietary requirements — important to get right.`,
        ``,
        `{tenantName} has worked with all kinds of dietary needs over {years}. {differentiator} They don't just substitute ingredients — they redesign for the restriction so the result still tastes exceptional.`,
      ].join("\n"),
      followUpQuestion: `What are the specific requirements? {tenantName} can tell you exactly what's possible.`,
    },
    {
      key: "trust",
      label: "Never Ordered Custom Before",
      keywords: ["never", "first time", "how does it work", "process", "order", "unsure", "not sure how"],
      responseTemplate: [
        `First time ordering custom? Here's how it works.`,
        ``,
        `{tenantName} walks every client through the process — flavor choices, design consultation, timeline. You're never guessing. {biggestWin}.`,
      ].join("\n"),
      followUpQuestion: `Want me to walk you through what a typical order looks like from start to finish?`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Grocery Store Moment",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `Here's the thing about a grocery store cake.`,
        ``,
        `It's fine. But it's identical to the one someone else bought yesterday for a completely different occasion. A custom cake from {tenantName} was made for one event. One table. One moment.`,
        ``,
        `{biggestWin}. That's the difference.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The One Photo",
      moments: ["stall", "general"],
      storyTemplate: [
        `There's always one photo from a wedding or birthday that everyone looks at first.`,
        ``,
        `Usually it involves the table. And the cake.`,
        ``,
        `{tenantName} has {years} of making that photo happen. I think it's worth one conversation.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "What do you specialize in — custom cakes, pastries, wedding cakes, wholesale?", required: true },
      { key: "yearsInProfession", question: "How long have you been baking professionally?", required: true },
      { key: "biggestWin", question: "What's your proudest creation or milestone — a wedding, a big order, a media feature?", required: true },
      { key: "differentiator", question: "What makes your baking different from every other custom baker in your area?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Who is your ideal customer — weddings, birthday parties, corporate events, wholesale buyers?", required: true },
      { key: "problemFaced", question: "What problem are they trying to solve that custom baking answers?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for a professional baker and pastry chef.`,
      `You serve {tenantName}, who has {years} of custom baking experience.`,
      `Specialty: {productOrOpportunity}. Biggest result: {biggestWin}.`,
      `What makes them different: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Warm, creative, passionate about craft.",
      "Talk about the experience, not just the product.",
      "The goal is a tasting or a first order — not a sale in the first message.",
      "Always make the customer feel like they're the focus, not the order.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate customer outreach in the prospect's detected language.",
    neverDoList: [
      "Never guarantee availability without checking with the tenant.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never make specific pricing promises without tenant input.",
    ],
  },

  discovery: {
    activeSources: ["facebook_groups", "reddit", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hi {{name}},\n\nI'm {{botName}}, helping out at {{tenantName}}.\n\nI saw you were looking for baked goods. Quick tip from the kitchen: the reason grocery store cakes last for three weeks is the preservatives. Real, artisan baking made with butter and fresh ingredients simply tastes different because it's real food.\n\nJust thought you'd appreciate the insight!\n\n— {{botName}}",
    testimonial: "Hi {{name}},\n\nQuick story — {{tenantName}} recently catered a large event where the client was incredibly stressed about dietary restrictions.\n\nWe customized the entire spread so everyone could actually enjoy dessert, not just look at it. The host said people were talking about the pastries more than the venue.\n\nThat's what happens when you care about the details.\n\n— {{botName}}",
    authority_transfer: "Hi {{name}},\n\nI should tell you a bit more about {{tenantName}}.\n\nThey've spent {{years}} perfecting {{profession}}. Our proudest creation recently: {{biggestWin}}. Our philosophy: {{differentiator}}.\n\nWe don't do mass-produced. We bake for {{icp}}.\n\nIf you want something memorable, our oven is ready.\n\n— {{botName}}",
    personal_checkin: "Hi {{name}},\n\nJust checking in — how's the event planning going?\n\n{{tenantName}} asked me to follow up and see if you still needed anything sweet for the occasion.\n\n— {{botName}}",
    one_to_ten_part1: "Hi {{name}},\n\nQuick question.\n\nOn a scale of 1-10, how close are you to locking in your bakery order? (1 = Just gathering ideas, 10 = I need to place a deposit today).\n\nJust reply with a number.\n\n— {{botName}}",
    one_to_ten_part2: "Got it, that helps.\n\nWhat would it take to be a 10? Are you unsure about flavors, worried about the budget, or just have a few more places to check out?\n\nLet me know so I can get you the right menu or info.\n\n— {{botName}}",
    gap_closing: "I totally get that — {{answer}}.\n\nThat's super common. Actually, {{tenantName}} built our tasting and ordering process specifically to make that part easier, which is how we nailed {{biggestWin}}.\n\nDoes knowing we have a seamless way to handle that bump you closer to a 10?\n\n— {{botName}}",
    scarcity_takeaway: "Hi {{name}},\n\nI'll be upfront — {{tenantName}} has a smaller commercial kitchen, so our calendar fills up weeks in advance.\n\nI can hold a tentative slot for your date, but if you aren't ready to commit, I need to release it to other clients.\n\nLet me know where you stand!\n\n— {{botName}}",
    pattern_interrupt: "Hi {{name}},\n\nBefore I clear your date off our calendar, think about this.\n\nPeople forget the decorations at a party, but they always remember if the food was incredible or terrible. \n\nIf you want to guarantee your guests are raving about dessert, let's get you in the books. Reply \"Let's bake\" if you're ready.\n\n— {{botName}}",
    final_takeaway: "Hi {{name}},\n\nThis is my last message about your inquiry. I'll take your info off our active list.\n\n{{tenantName}} is busy in the kitchen prepping for this weekend's orders! Reach out if you ever need anything in the future.\n\n— {{botName}}",
    slow_drip_value: "Hi {{name}},\n\nChecking in — just passing along some sweet news.\n\n{{tenantName}} just introduced a new menu featuring {{differentiator}}. \n\nHope you're having a great season!\n\n— {{botName}}",
    default_fallback: "Hi {{name}}, just checking in. — {{botName}}",
  },
};
