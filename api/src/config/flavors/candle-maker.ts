// Tiger Claw — Candle Maker / Artisan Flavor
// Single-oar: find product customers and wholesale accounts, nurture to a first order.

import type { FlavorConfig } from "../types.js";

export const CANDLE_MAKER_FLAVOR: FlavorConfig = {
  key: "candle-maker",
  displayName: "Candle Maker / Artisan",
  description: "Single-oar prospecting engine for artisan candle makers and small-batch product creators. Finds retail customers and wholesale buyers, nurturing to a first order or sampling session.",
  professionLabel: "Candle Maker / Artisan",
  defaultKeywords: ["soy candles", "handmade candles", "artisan candles", "small batch candles", "custom scented candles", "wholesale candles"],
  scoutQueries: [
    "best handmade candles reddit recommendations",
    "artisan candle brands worth buying",
    "soy candle small business support",
    "where to buy unique scented candles online",
    "small batch home goods indie brands",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "place an order or book a sampling session",
  },

  objectionBuckets: [
    {
      key: "price",
      label: "Price vs. Mass Market",
      keywords: ["price", "expensive", "cheap", "store", "target", "amazon", "cheaper", "cost", "budget"],
      responseTemplate: [
        `The price comparison to mass market — fair question.`,
        ``,
        `{tenantName} has {years} making small-batch, hand-poured products. {biggestWin}. Mass market candles use paraffin and fragrance oils. {tenantName}'s products are {productOrOpportunity} — a completely different category.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `Have you ever burned an artisan candle vs. a store-bought one side by side? The difference isn't subtle.`,
    },
    {
      key: "scent",
      label: "Can't Smell Before Buying",
      keywords: ["smell", "scent", "fragrance", "not sure", "sample", "try", "test", "what does it smell like"],
      responseTemplate: [
        `You can't smell it through a screen — that's real.`,
        ``,
        `{tenantName} offers sample sets and scent descriptions written to actually be useful. {biggestWin}. The best way to know is to try one.`,
      ].join("\n"),
      followUpQuestion: `Would a sample kit help? I can find out what {tenantName} has available.`,
    },
    {
      key: "quality",
      label: "Quality / Burn Time",
      keywords: ["quality", "burn", "long", "last", "good", "worth it", "how long", "wax", "wick", "soot"],
      responseTemplate: [
        `The quality question. Worth asking.`,
        ``,
        `{tenantName} uses {productOrOpportunity} — chosen specifically for clean burn, scent throw, and longevity. {years} of refining the formula means they know exactly what works.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `What specifically are you looking for in a candle? I can match you to exactly what {tenantName} makes.`,
    },
    {
      key: "gift",
      label: "Buying as a Gift / Customization",
      keywords: ["gift", "present", "custom", "label", "personalize", "wedding", "birthday", "favor", "corporate"],
      responseTemplate: [
        `Buying as a gift or for a special occasion — perfect use case.`,
        ``,
        `{tenantName} does custom labels, gift sets, and event favors. {biggestWin}. This is exactly where artisan products shine — the person opening it knows someone put real thought into it.`,
      ].join("\n"),
      followUpQuestion: `What's the occasion? {tenantName} can tell you exactly what's possible for your timeline and quantity.`,
    },
    {
      key: "shipping",
      label: "Shipping / Damage Concerns",
      keywords: ["shipping", "break", "damage", "fragile", "melt", "arrive", "delivery", "ship"],
      responseTemplate: [
        `Shipping artisan products — a real concern.`,
        ``,
        `{tenantName} has {years} of shipping experience. {differentiator} They pack specifically to prevent damage and work with carriers that handle fragile goods.`,
      ].join("\n"),
      followUpQuestion: `Where are you located? I can get specific shipping details from {tenantName}.`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Gift That Gets Remembered",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `Think about the last gift you gave that the other person actually remembered and talked about.`,
        ``,
        `It wasn't something grabbed off a shelf. It was something that felt chosen.`,
        ``,
        `{tenantName}'s {biggestWin} — that's the kind of thing people remember.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Room Test",
      moments: ["general"],
      storyTemplate: [
        `Here's {tenantName}'s test for a candle.`,
        ``,
        `Light it. Leave the room for 10 minutes. Come back in.`,
        ``,
        `The scent that fills the room when you walk back in — that's the actual product. Most mass market candles fail this test. {tenantName}'s don't.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "What do you make — candles, wax melts, diffusers, something else? What's your signature material or scent style?", required: true },
      { key: "yearsInProfession", question: "How long have you been making and selling your products?", required: true },
      { key: "biggestWin", question: "What's your biggest result — a wholesale account, a sell-out market, a customer story?", required: true },
      { key: "differentiator", question: "What makes your products different from every other artisan candle maker?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Who is your ideal customer — retail buyers, gift shoppers, wholesale accounts, event planners?", required: true },
      { key: "problemFaced", question: "What problem are they trying to solve that your products answer?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for an artisan candle maker and product creator.`,
      `You serve {tenantName}, who has {years} of small-batch crafting experience.`,
      `Products: {productOrOpportunity}. Biggest result: {biggestWin}.`,
      `What makes them different: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Warm, sensory, artisan-proud.",
      "Talk about the craft and the experience, not just the product.",
      "The goal is a first order or sampling session — earned through trust.",
      "Never make it feel transactional.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate customer outreach in the prospect's detected language.",
    neverDoList: [
      "Never guarantee specific scents or availability without checking with the tenant.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never promise shipping timelines without tenant confirmation.",
    ],
  },

  discovery: {
    activeSources: ["facebook_groups", "reddit", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hi {{name}},\n\nI'm {{botName}}, representing {{tenantName}}.\n\nI saw you were interested in candles/crafts. A quick piece of insight: most big-box candles use paraffin wax and synthetic fragrances that actually pollute indoor air. Artisan soy or beeswax with essential oils burns cleaner and lasts twice as long.\n\nQuality materials really do make a difference!\n\n— {{botName}}",
    testimonial: "Hi {{name}},\n\nQuick thought — {{tenantName}} recently poured a custom batch for a client creating corporate gifts.\n\nThey wanted something that didn't feel cheap. The feedback they got from their partners was incredible because the scent throw filled the room without giving anyone a headache.\n\nHand-poured makes all the difference.\n\n— {{botName}}",
    authority_transfer: "Hi {{name}},\n\nI want to properly introduce {{tenantName}}.\n\nThey have spent {{years}} mastering {{profession}}. Their proudest recent launch: {{biggestWin}}. What makes our studio different: {{differentiator}}.\n\nWe don't manufacture; we hand-craft for {{icp}}.\n\nIf you appreciate real craftsmanship, you'll love our studio.\n\n— {{botName}}",
    personal_checkin: "Hi {{name}},\n\nJust checking in — did you find the gifts/products you were looking for?\n\n{{tenantName}} asked me to follow up. We love connecting with people who appreciate artisan goods.\n\n— {{botName}}",
    one_to_ten_part1: "Hi {{name}},\n\nQuick question.\n\nOn a scale of 1-10, how ready are you to place an order or coordinate a custom batch? (1 = Just browsing the aesthetic, 10 = I want to buy right now).\n\nJust reply with a number.\n\n— {{botName}}",
    one_to_ten_part2: "Got it, totally fair.\n\nWhat's keeping you from being a 10? Are you looking for a specific scent we don't carry, comparing prices, or just not needing it right this moment?\n\nLet me know so I don't send you irrelevant info.\n\n— {{botName}}",
    gap_closing: "I see — {{answer}}.\n\nActually, a lot of our first-time buyers have that exact thought. {{tenantName}} specifically designed our collections to address that, which led to {{biggestWin}}.\n\nDoes knowing we have a curated solution for that change your readiness (1-10)?\n\n— {{botName}}",
    scarcity_takeaway: "Hi {{name}},\n\nI'll be direct — {{tenantName}} pours in small batches so quality stays high. Our next pool is almost fully allocated.\n\nIf you want in on this batch, let me know. If you're just window shopping, I completely respect that and will let you browse in peace!\n\n— {{botName}}",
    pattern_interrupt: "Hi {{name}},\n\nBefore I stop following up, consider this.\n\nYour environment dictates your mood. A cheap candle smells like a cheap candle. A beautifully crafted scent elevates an entire room.\n\nIf you're ready to actually elevate your space, simply reply \"Let's ship it.\"\n\n— {{botName}}",
    final_takeaway: "Hi {{name}},\n\nThis is my final message. I'm taking you off our active outreach list.\n\n{{tenantName}} is back in the studio pouring! If you ever need artisan goods, our site is always open.\n\n— {{botName}}",
    slow_drip_value: "Hi {{name}},\n\nChecking in — just passing along some studio news.\n\nWe just dropped a new collection focused on {{differentiator}}. \n\nHope your space is smelling amazing!\n\n— {{botName}}",
    default_fallback: "Hi {{name}}, just checking in. — {{botName}}",
  },
};
