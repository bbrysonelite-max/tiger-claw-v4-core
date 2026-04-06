// Tiger Claw — Interior Designer Flavor
// Full-service interior design business. Targets homeowners and new residents
// who are ready to transform a space and need professional guidance to do it.

import type { FlavorConfig } from "../types.js";

export const INTERIOR_DESIGNER_FLAVOR: FlavorConfig = {
  key: "interior-designer",
  displayName: "Interior Designer",
  description: "Prospecting engine for interior designers. Targets homeowners, new residents, and renovators actively seeking design help.",
  professionLabel: "interior design",
  defaultKeywords: [
    "interior designer", "redecorate", "home makeover", "redesign my room",
    "living room refresh", "design consultation", "home renovation",
    "new house decor", "interior design help", "how to style my home"
  ],

  intentSignals: [
    { pattern: "\\b(hire\\s*(an?\\s*)?interior\\s*designer|interior\\s*design\\s*(consultation|help|services?)|interior\\s*designer\\s*(near\\s*me|recommendation|referral))\\b", type: "designer_search", strength: 92 },
    { pattern: "\\b(redecorate|redesign|redo|refresh|transform)\\s*(my\\s*)?(home|house|living\\s*room|bedroom|kitchen|dining\\s*room|office|apartment)\\b", type: "redesign_intent", strength: 88 },
    { pattern: "\\b(home\\s*(makeover|renovation|overhaul)|gut\\s*(renovate|remodel)|full\\s*renovation)\\b", type: "renovation_intent", strength: 85 },
    { pattern: "\\b(just\\s*(bought|moved\\s*into|closed\\s*on)|new\\s*(home|house|apartment|place)|first\\s*home)\\b", type: "new_home_intent", strength: 82 },
    { pattern: "\\b(don'?t\\s*know\\s*(where\\s*to\\s*start|how\\s*to\\s*decorate)|overwhelmed\\s*by|no\\s*idea\\s*(how\\s*to|what\\s*to\\s*do\\s*with)\\s*(my\\s*)?(room|space|home))\\b", type: "design_overwhelm", strength: 80 },
    { pattern: "\\b(small\\s*(space|apartment|condo)\\s*(design|decorating|layout|ideas)|studio\\s*apartment\\s*(design|decorating|layout))\\b", type: "small_space_intent", strength: 75 },
    { pattern: "\\b(what\\s*color\\s*(should|to)\\s*(I\\s*)?paint|paint\\s*color\\s*(help|advice|suggestions?|ideas?)|choosing\\s*paint\\s*colors?)\\b", type: "design_question", strength: 68 },
    { pattern: "\\b(furniture\\s*(layout|arrangement|placement)|how\\s*to\\s*arrange\\s*(my\\s*)?(furniture|room)|room\\s*layout\\s*(help|ideas?))\\b", type: "layout_help", strength: 70 },
  ],

  scoutQueries: [
    "subreddit:malelivingspace OR subreddit:femalelivingspace hire interior designer redecorate help",
    "subreddit:HomeDecorating OR subreddit:interiordesign where to start redesign living room help",
    "subreddit:myhome OR subreddit:HomeImprovement just moved in design help new house decor ideas",
    "subreddit:femalelivingspace OR subreddit:malelivingspace don't know how to decorate apartment overwhelmed",
    "subreddit:HomeDecorating OR subreddit:interiordesign small apartment space design layout help",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book a design consultation",
  },

  objectionBuckets: [
    {
      key: "cost",
      label: "Cost / Budget",
      keywords: ["expensive", "budget", "cost", "too much", "afford", "money"],
      responseTemplate: "Totally fair concern. {{tenantName}} works with a range of budgets and offers a free initial consultation so you can see exactly what's possible before committing to anything. Most clients are surprised how far a focused plan goes.",
      followUpQuestion: "Would a no-pressure 20-minute call help you figure out what's realistic for your space?"
    },
    {
      key: "diy",
      label: "Can Do It Myself",
      keywords: ["just do it myself", "diy", "figure it out", "don't need"],
      responseTemplate: "Absolutely — and sometimes that's the right call. {{tenantName}}'s most satisfied clients are actually people who tried DIY first, hit a wall, and came back. The difference is having a plan before buying anything.",
      followUpQuestion: "What's the part you're most stuck on right now — layout, color, furniture selection, or something else?"
    },
    {
      key: "style",
      label: "Don't Know My Style",
      keywords: ["don't know my style", "no idea", "can't decide", "indecisive"],
      responseTemplate: "That's exactly what the first consultation is for. {{tenantName}} has a process for figuring out what you actually respond to — it takes about 15 minutes and saves a lot of expensive guessing.",
      followUpQuestion: "Is there a room in your home that bothers you the most right now?"
    }
  ],

  patternInterrupts: [
    {
      name: "The Blank Room Cost",
      moments: ["stall", "general"],
      storyTemplate: "Here's something {{tenantName}} tells every new client: the most expensive mistake in interior design isn't hiring a designer — it's buying the wrong sofa first and building around it. {{biggestWin}} came from catching that exact mistake before it happened."
    }
  ],

  onboarding: {
    identityQuestions: [
      { key: "designStyle", question: "How would you describe your signature design aesthetic (e.g., Modern, Transitional, Boho, Coastal)?", required: true },
      { key: "serviceArea", question: "Do you offer remote e-design services, local in-person installs, or both?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: "You are a prospecting assistant for a talented interior designer. Your job is to find people who are overwhelmed, excited, or stuck about their space — and open a real conversation. Lead with empathy and inspiration. Make them feel the possibility of what their space could be.",
    toneDirectives: ["Creative", "Warm", "Visionary", "Inspiring"],
    languageDirective: "Speak like someone who genuinely loves transforming spaces. Never sound transactional. Ask questions that help them picture the result.",
    neverDoList: [
      "Never give specific design advice or recommendations before a consultation.",
      "Never quote prices or timelines without a discovery call.",
      "Never dismiss someone's current taste — meet them where they are.",
    ],
  },

  discovery: {
    activeSources: ["reddit", "facebook_groups", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, working with {{tenantName}}.\n\nI saw you're thinking about your space. Quick thought: the biggest mistake most people make is buying furniture before they have a plan. It ends up costing 2x.\n\nNo pitch — just thought it was worth sharing.\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\n{{tenantName}} just finished a living room for a client who'd been staring at the same beige walls for four years. The client said it was the first time the house actually felt like theirs.\n\nThat's what a plan does.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nI realized I haven't properly introduced you to {{tenantName}}. They've been in {{professionLabel}} for {{years}} and their specialty is {{differentiator}}.\n\nIf you want your space to feel intentional — not just 'stuff arranged' — they're the person for it.\n\n— {{botName}}",
    personal_checkin: "Hey {{name}},\n\nJust checking in — how's the space coming along? Still figuring it out?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nOn a scale of 1-10, how happy are you with your space right now? 1 = can't stand it, 10 = love every corner.\n\n— {{botName}}",
    one_to_ten_part2: "Appreciate the honesty! What's the biggest thing holding it back from a 10 — layout, color, furniture, or something else?\n\n— {{botName}}",
    gap_closing: "Got it — {{answer}}. That's actually very fixable. {{tenantName}} specializes in exactly that.\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\nJust heads up — {{tenantName}}'s consultation calendar is filling up for the month. If you want to get a plan together for your space, this week is the window.\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nThink about this: you spend more time in your home than anywhere else. If it doesn't feel right, everything feels slightly off.\n\nIs it worth 20 minutes to figure out exactly what would change that?\n\n— {{botName}}",
    final_takeaway: "I'll step back now. {{tenantName}} is moving forward with their active clients. Best of luck with the space!\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}}, just checking in. {{tenantName}} has been working on some interesting projects in {{differentiator}} — thought of you.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in. — {{botName}}"
  },
};
