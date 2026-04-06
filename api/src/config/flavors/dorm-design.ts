// Tiger Claw — Dorm / Small Space Interior Designer Flavor
// Single-oar: connect college students and young renters with a designer who
// transforms cramped dorm rooms and studio apartments into functional, stylish spaces.

import type { FlavorConfig } from "../types.js";

export const DORM_DESIGN_FLAVOR: FlavorConfig = {
  key: "dorm-design",
  displayName: "Dorm & Small Space Designer",
  description: "Single-oar prospecting engine for interior designers specializing in dorms, studio apartments, and small-space transformations. Finds students and young renters, nurtures to a paid design consultation or package purchase.",
  professionLabel: "Interior Designer",
  defaultKeywords: ["dorm room", "small space", "studio apartment", "dorm decor", "room makeover", "small apartment", "college room", "micro living"],
  intentSignals: [
    { pattern: "\\b((my\\s*)?(son|daughter|kid|child|i|me|we'?re?|i'?m)\\s*(is\\s*|am\\s*)?going\\s*to\\s*college)\\b", type: "college_milestone", strength: 90 },
    { pattern: "\\b(freshman\\s*year|starting\\s*college|off\\s*to\\s*college|move\\s*in\\s*day|move.?in\\s*week)\\b", type: "college_milestone", strength: 85 },
    { pattern: "\\b(dorm\\s*(room|decor|layout|essentials|makeover|setup|ideas))\\b", type: "design_intent", strength: 90 },
    { pattern: "\\b(lofting\\s*my\\s*bed|dorm\\s*bedding|dorm\\s*storage|dorm\\s*roommate|matching\\s*dorm)\\b", type: "design_intent", strength: 80 },
    { pattern: "\\b(studio\\s*apartment\\s*(design|decor|ideas|tips)|small\\s*(space|room)\\s*(design|makeover|ideas))\\b", type: "small_space_intent", strength: 78 },
    { pattern: "\\b(interior\\s*design\\s*(help|consultation|ideas|tips)|hire\\s*(an\\s*)?interior\\s*designer)\\b", type: "designer_search", strength: 88 },
    { pattern: "\\b(room\\s*makeover|redecorate|how\\s*to\\s*decorate\\s*(my|a)\\s*(room|dorm|apartment))\\b", type: "design_intent", strength: 75 },
    { pattern: "\\b(college\\s*move.?in|packing\\s*for\\s*college|college\\s*shopping\\s*list)\\b", type: "college_prep", strength: 82 },
  ],

  scoutQueries: [
    "subreddit:college OR subreddit:Dorms dorm room makeover small space ideas",
    "subreddit:femalelivingspace OR subreddit:malelivingspace how to decorate small dorm room",
    "subreddit:college OR subreddit:Dorms studio apartment design tips first apartment",
    "subreddit:Dorms OR subreddit:college dorm room storage solutions organization hacks",
    "subreddit:InteriorDesign OR subreddit:malelivingspace small space design consultation worth it",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book a design consultation or purchase a small-space design package",
  },

  objectionBuckets: [
    {
      key: "price",
      label: "Too Expensive / Student Budget",
      keywords: ["expensive", "cost", "afford", "budget", "broke", "student", "cheap", "price", "money", "paid"],
      responseTemplate: [
        `Student budget — {tenantName} gets it. That's exactly who they built their packages for.`,
        ``,
        `{tenantName} has {years} transforming spaces on tight budgets. {biggestWin}. Most clients spend less on a design session than they would randomly buying things on Amazon that don't work together.`,
        ``,
        `{differentiator} There's a package that fits a dorm room budget — and it pays for itself in things you don't waste money buying twice.`,
      ].join("\n"),
      followUpQuestion: `What's your rough budget for the whole room setup? That helps {tenantName} figure out the best starting point.`,
    },
    {
      key: "diy_capable",
      label: "I Can Figure It Out Myself",
      keywords: ["pinterest", "tiktok", "youtube", "myself", "figure it out", "do it myself", "just buy", "browse ikea"],
      responseTemplate: [
        `Pinterest rabbit hole hits different at 2am when you're surrounded by boxes and nothing looks like the inspo post.`,
        ``,
        `{tenantName} has {years} in small-space design. {biggestWin}. The difference between scrolling and a plan is knowing what to buy, in what order, and what to skip entirely.`,
        ``,
        `{differentiator}`,
      ].join("\n"),
      followUpQuestion: `What's the hardest part of your space — layout, storage, or making it actually feel like *you*?`,
    },
    {
      key: "temporary_space",
      label: "It's Just Temporary / Not Worth It",
      keywords: ["just a year", "temporary", "not permanent", "moving out", "one year", "semester", "not worth"],
      responseTemplate: [
        `Here's the thing about "just a year" — you still live there every single day.`,
        ``,
        `A room that works for your brain means better sleep, better focus, less stress. {tenantName} has {biggestWin} making temporary spaces feel like home. {differentiator}`,
        ``,
        `The setup also moves with you. It's not wasted just because it's not permanent.`,
      ].join("\n"),
      followUpQuestion: `What's bothering you most about the space right now — storage, the layout, or just the vibe?`,
    },
    {
      key: "landlord_restrictions",
      label: "Can't Put Holes in the Wall",
      keywords: ["no holes", "landlord", "damage deposit", "no drilling", "no paint", "restrictions", "rules", "lease"],
      responseTemplate: [
        `No holes, no paint — that's the standard dorm/rental constraint. {tenantName} works in it every day.`,
        ``,
        `Command strips, tension rods, furniture arrangement, and lighting can do more than most people think. {biggestWin}. {differentiator}`,
        ``,
        `The constraint is a design challenge, not a dealbreaker.`,
      ].join("\n"),
      followUpQuestion: `What are the exact rules on your lease or dorm contract? That gives {tenantName} a clear picture of what we're working with.`,
    },
    {
      key: "already_bought_stuff",
      label: "Already Have Furniture / Bought Stuff",
      keywords: ["already bought", "have stuff", "got furniture", "already ordered", "mom gave me", "hand-me-down"],
      responseTemplate: [
        `Good — working with what you already have is actually {tenantName}'s specialty.`,
        ``,
        `The skill isn't buying new things. It's making what you have work together. {biggestWin}. {differentiator}`,
        ``,
        `Send a photo of what you're working with and {tenantName} can give you a real read on what stays, what goes, and what one or two additions would pull it all together.`,
      ].join("\n"),
      followUpQuestion: `Can you take a quick photo of the space as it is right now?`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Decision Fatigue Room",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `{tenantName} calls it "decision fatigue decorating."`,
        ``,
        `You add one thing, then you need something to go with it, then you need something to hide the first thing you bought that doesn't fit anymore.`,
        ``,
        `A plan made once saves you from making 40 small decisions badly. {biggestWin}.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Space Tells You What You Are",
      moments: ["general"],
      storyTemplate: [
        `{tenantName} believes your room talks back to you.`,
        ``,
        `A chaotic room tells your brain: chaos is normal. A space that works for how you actually live tells your brain: you're the kind of person who has it together.`,
        ``,
        `{years} in small-space design. {biggestWin}.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "How do you describe your design work — dorm rooms, studio apartments, micro-living, or all small spaces?", required: true },
      { key: "yearsInProfession", question: "How many years have you been doing interior design or space consulting?", required: true },
      { key: "biggestWin", question: "What's a transformation you're most proud of — a dramatic before/after, a client result, or a space that became someone's favorite place?", required: true },
      { key: "differentiator", question: "What makes your approach different from just following a Pinterest board or hiring a general decorator?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Who is your ideal client — incoming freshmen, transfer students, young professionals in their first apartment?", required: true },
      { key: "problemFaced", question: "What's the #1 pain point they come to you with — too much stuff, no storage, the room just feels depressing?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for an interior designer who specializes in dorms and small spaces.`,
      `You serve {tenantName}, who has {years} in small-space design.`,
      `Their track record: {biggestWin}. What sets them apart: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Relatable, energetic, visually descriptive. Speak like a friend who is also a design expert.",
      "Validate the struggle first — small spaces are genuinely hard — then offer hope and a clear next step.",
      "Avoid decorating jargon. Say 'feels cramped' not 'lacks visual flow'.",
      "The goal is a booked consultation or package — not a design lesson over chat.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate customer outreach in the prospect's detected language.",
    neverDoList: [
      "Never give a full room plan without the tenant reviewing the space details.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never promise a specific aesthetic outcome without seeing the actual space dimensions and light conditions.",
    ],
  },

  discovery: {
    activeSources: ["reddit", "facebook_groups", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, assistant to {{tenantName}}.\n\nQuick tip for small spaces: the single biggest upgrade for any dorm or studio isn't furniture — it's lighting. Replace the harsh overhead with a warm floor lamp and you'll be shocked at the difference.\n\nHope that helps you feel a bit more at home!\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\n{{tenantName}} just finished a dorm makeover for a junior at State who had a room smaller than most walk-in closets.\n\nThe student said it was the first time she could actually study in her room all semester — because it finally stopped feeling chaotic.\n\nSame square footage. Completely different feeling.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nWanted to properly introduce {{tenantName}}.\n\nThey've been designing small spaces for {{years}} and have {{biggestWin}}. Their whole approach: {{differentiator}}.\n\nThey help {{icp}} create spaces that actually work for how you live — not just how they look in photos.\n\nIf your space is stressing you out, they're worth a conversation.\n\n— {{botName}}",
    personal_checkin: "Hey {{name}},\n\nJust checking in — did you get your room situation sorted?\n\n{{tenantName}} asked me to follow up. They hate leaving people in a space that isn't working for them.\n\nHow's it going over there?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nQuick question.\n\nOn a scale of 1-10, how much is your room stressing you out right now? (1 = it's fine, 10 = I can't focus and I hate being in here).\n\nJust reply with a number.\n\n— {{botName}}",
    one_to_ten_part2: "Got it.\n\nWhat's the main blocker — budget, not knowing where to start, or thinking it's not worth the effort for a temporary space?\n\nJust want to understand what's in the way.\n\n— {{botName}}",
    gap_closing: "That makes sense — {{answer}}.\n\nA lot of {{tenantName}}'s clients said the same thing before their session. That's actually exactly why they built their small-space process — specifically to work around {{answer}}.\n\nKnowing that, does a quick consultation feel more worth exploring?\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\n{{tenantName}}'s calendar is filling up fast with move-in season. They only take a limited number of consultations each week.\n\nI have a slot I can hold for you, but if the timing isn't right I need to open it to the next person on the list.\n\nLet me know either way!\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nBefore I close your file, remember this.\n\nEvery semester you spend in a room that doesn't work for you is a semester of worse sleep, worse focus, and more stress. That's measurable. That's real.\n\nIf you want to finally fix that, reply and say \"Let's do this.\"\n\n— {{botName}}",
    final_takeaway: "Hey {{name}},\n\nThis is my last message about your room consultation. Closing your file now.\n\n{{tenantName}} wishes you well. If you ever move into a new space and want it done right from day one, you know where to find us.\n\nTake care!\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}},\n\nOne more quick win for your space: if storage is the problem, go vertical. Tension-rod shelving and over-door organizers can double your usable storage without touching a single wall.\n\n{{tenantName}} swears by it.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in on your space. — {{botName}}",
  },
};
