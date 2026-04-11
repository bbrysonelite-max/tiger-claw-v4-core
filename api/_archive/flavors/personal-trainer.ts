// Tiger Claw — Personal Trainer Flavor
// Single-oar: find people who are serious about changing their body and life,
// nurture to a paid training consultation or program enrollment.

import type { FlavorConfig } from "../types.js";

export const PERSONAL_TRAINER_FLAVOR: FlavorConfig = {
  key: "personal-trainer",
  displayName: "Personal Trainer",
  description: "Single-oar prospecting engine for personal trainers and fitness coaches. Finds people who are ready to commit to a transformation, nurtures to a paid discovery call or training program enrollment.",
  professionLabel: "Personal Trainer",
  defaultKeywords: ["personal trainer", "weight loss coach", "fitness transformation", "gym coach", "online training", "workout plan", "fat loss", "strength training"],
  intentSignals: [
    { pattern: "\\b(looking\\s*for\\s*(a\\s*)?(personal\\s*trainer|fitness\\s*coach)|recommend\\s*(a\\s*)?(personal\\s*trainer|gym\\s*coach))\\b", type: "trainer_search", strength: 92 },
    { pattern: "\\b(online\\s*(personal\\s*trainer|fitness\\s*coach|training\\s*program)\\s*(worth\\s*it|results|review))\\b", type: "online_training_intent", strength: 85 },
    { pattern: "\\b(can'?t\\s*lose\\s*weight|tried\\s*everything\\s*(to\\s*lose|and\\s*can'?t)|weight\\s*loss\\s*(plateau|stuck))\\b", type: "weight_loss_frustration", strength: 82 },
    { pattern: "\\b(transformation|body\\s*transformation|get\\s*(in\\s*shape|fit|toned|lean)\\s*(for|before|by))\\b", type: "transformation_intent", strength: 78 },
    { pattern: "\\b(accountability\\s*(partner|coach)|need\\s*accountability|hold\\s*me\\s*accountable)\\b", type: "accountability_seeking", strength: 80 },
    { pattern: "\\b(fitness\\s*goals|workout\\s*plan\\s*(help|advice|tips)|how\\s*to\\s*(start|begin)\\s*(working\\s*out|at\\s*the\\s*gym))\\b", type: "fitness_guidance_seeking", strength: 72 },
    { pattern: "\\b(post.?partum\\s*(fitness|workout)|lose\\s*(baby|pregnancy)\\s*weight|get\\s*back\\s*in\\s*shape\\s*after)\\b", type: "life_event_fitness", strength: 80 },
    { pattern: "\\b(strength\\s*training\\s*(for\\s*beginners|program|tips)|how\\s*to\\s*(build\\s*muscle|get\\s*stronger))\\b", type: "strength_intent", strength: 68 },
  ],

  scoutQueries: [
    "subreddit:fitness OR subreddit:xxfitness how do I find a good personal trainer hire",
    "subreddit:loseit OR subreddit:fitness online personal trainer worth it results experience",
    "subreddit:fitness OR subreddit:loseit personal trainer helped me lose weight transformation",
    "subreddit:fitness personal trainer vs gym membership alone which is better",
    "subreddit:xxfitness OR subreddit:bodyweightfitness fitness accountability coach hiring worth it",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book a fitness discovery call or enroll in a training program",
  },

  objectionBuckets: [
    {
      key: "price",
      label: "Too Expensive / Can't Afford a Trainer",
      keywords: ["expensive", "cost", "afford", "price", "budget", "money", "too much", "gym membership", "cheap"],
      responseTemplate: [
        `Fair question. Let's look at what the alternative actually costs.`,
        ``,
        `The average person who doesn't have a plan spends years in the gym, gets inconsistent results, and eventually quits — paying for a membership they use less and less. {biggestWin}.`,
        ``,
        `{tenantName} has {years} in training. {differentiator} What they charge is for a plan that actually works — not for another month of guessing.`,
      ].join("\n"),
      followUpQuestion: `What's your current approach to training? That helps {tenantName} understand what you've already tried.`,
    },
    {
      key: "can_do_it_alone",
      label: "I Can Figure It Out Myself / YouTube / App",
      keywords: ["youtube", "app", "myself", "figure it out", "research", "do it myself", "google it", "online program", "myfitnesspal"],
      responseTemplate: [
        `There's more free fitness information online than anyone could use in a lifetime. That's not the problem.`,
        ``,
        `The problem is that knowing what to do and doing it — consistently, correctly, for your specific body — are different skills.`,
        ``,
        `{tenantName} has {years} training clients. {biggestWin}. {differentiator} Apps don't see your form. Apps don't know you skipped Wednesday because your back was off. A trainer does.`,
      ].join("\n"),
      followUpQuestion: `What's your biggest frustration with your training so far — consistency, progress, or knowing what to focus on?`,
    },
    {
      key: "no_time",
      label: "Too Busy / No Time",
      keywords: ["busy", "no time", "work", "kids", "schedule", "crazy schedule", "can't commit", "too much going on"],
      responseTemplate: [
        `Busy is real. That's also why a plan beats figuring it out on the fly.`,
        ``,
        `{tenantName} works with people who have exactly that problem — full schedules, limited windows, and a goal that keeps getting pushed back. {biggestWin}. {differentiator}`,
        ``,
        `Three focused sessions a week beats seven random ones. The question isn't whether you have time to train — it's whether you have time to do it wrong again.`,
      ].join("\n"),
      followUpQuestion: `What does your week actually look like? {tenantName} is good at finding the windows that exist even in a packed schedule.`,
    },
    {
      key: "not_ready",
      label: "Not in Shape Enough / Embarrassed to Start",
      keywords: ["not fit enough", "embarrassed", "out of shape", "overweight", "too far gone", "start when", "feel ready", "scared", "shame"],
      responseTemplate: [
        `Waiting until you feel "ready" to start training is like waiting until your house is clean to hire a cleaner.`,
        ``,
        `{tenantName} works with people at the very beginning — not just people who are already fit. {biggestWin}. That judgment you're afraid of? It doesn't exist in a real training relationship.`,
        ``,
        `{differentiator} Wherever you're starting from, that's the starting point. That's it.`,
      ].join("\n"),
      followUpQuestion: `What's one specific thing you want to be able to do or feel in your body that you don't right now?`,
    },
    {
      key: "tried_before",
      label: "Tried a Trainer Before / Didn't Work",
      keywords: ["tried before", "had a trainer", "didn't work", "wasted money", "didn't stick", "last trainer", "other trainer", "failed"],
      responseTemplate: [
        `Trainers are not interchangeable. A bad fit or a bad method doesn't mean training doesn't work — it means that one didn't.`,
        ``,
        `{tenantName} has {years} and {biggestWin}. What they do differently: {differentiator}`,
        ``,
        `What happened with the last trainer? That question matters — the answer usually tells {tenantName} exactly what to do differently.`,
      ].join("\n"),
      followUpQuestion: `What specifically didn't work — the program, the relationship, the accountability, or the results?`,
    },
  ],

  patternInterrupts: [
    {
      name: "The Compound Effect",
      moments: ["stall", "pre_takeaway", "general"],
      storyTemplate: [
        `{tenantName} has a client who started two years ago unable to do a single push-up.`,
        ``,
        `Today she coaches a morning bootcamp class.`,
        ``,
        `That gap — zero push-ups to coaching a class — closed in 24 months of consistent work. Not genetics. Not a miracle. Just showing up with a plan.`,
        ``,
        `Two years from now exists regardless. The question is what you do with it.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
    {
      name: "The Real Cost of Inconsistency",
      moments: ["general"],
      storyTemplate: [
        `Here's a number {tenantName} shares with new clients.`,
        ``,
        `The average person who trains inconsistently — 3 good months, 2 off months, restart, repeat — spends 5-7 years getting what 18 months of consistent work would have given them.`,
        ``,
        `The issue is never the program. It's almost always the accountability structure around it.`,
        ``,
        `That's what {tenantName} provides. {years} of knowing exactly how to build that structure around someone's real life.`,
        ``,
        `— {botName}`,
      ].join("\n"),
    },
  ],

  onboarding: {
    identityQuestions: [
      { key: "name", question: "What's your name?", required: true },
      { key: "productOrOpportunity", question: "How do you describe your training specialty — strength, weight loss, athletic performance, online coaching, in-person, or a combination?", required: true },
      { key: "yearsInProfession", question: "How many years have you been training clients?", required: true },
      { key: "biggestWin", question: "What's a client transformation you're most proud of — a dramatic physical change, a health reversal, a performance breakthrough?", required: true },
      { key: "differentiator", question: "What makes your coaching approach different from a generic gym program or an app?", required: true },
    ],
    icpSingleQuestions: [
      { key: "idealPerson", question: "Who is your ideal client — busy professionals, women over 40, athletes, beginners, people recovering from injury?", required: true },
      { key: "problemFaced", question: "What's the primary struggle your ideal client has when they first come to you?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: [
      `You are a Tiger Claw agent built for a personal trainer and fitness coach.`,
      `You serve {tenantName}, who has {years} in personal training.`,
      `Their track record: {biggestWin}. What sets them apart: {differentiator}.`,
    ].join("\n"),
    toneDirectives: [
      "Direct, energetic, empathetic. Speak to both the physical goal and the emotional need underneath it.",
      "Never shame body image or use fear-based health messaging. Lead with possibility and pride.",
      "Validate the struggle — life gets in the way — then bring the conversation back to the goal.",
      "The goal is a discovery call or program enrollment — not a free training session over chat.",
    ],
    languageDirective: "Respond to your tenant in their preferredLanguage. Generate customer outreach in the prospect's detected language.",
    neverDoList: [
      "Never give specific dietary advice — that's a registered dietitian's scope of practice.",
      "Never pretend to be a human when directly asked.",
      "Never contact someone who has explicitly opted out.",
      "Never promise specific weight loss or body composition outcomes — results depend on individual adherence and biology.",
    ],
  },

  discovery: {
    activeSources: ["facebook_groups", "reddit", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, assistant to {{tenantName}}.\n\nQuick insight from the field: the single most underrated part of any fitness program isn't the workout — it's sleep. Most people trying to change their body are fighting their own recovery. Even adding 30 minutes of sleep per night can dramatically improve results.\n\nHope that's useful!\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\n{{tenantName}} just had a client check in after 90 days.\n\nShe started unable to do a pull-up. She just did 8.\n\nHer words: \"I didn't know I could do this. I thought I was just built this way.\"\n\nShe wasn't. She just needed the right structure and someone in her corner.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nWanted to properly introduce {{tenantName}}.\n\nThey've been coaching for {{years}} and have {{biggestWin}}. Their whole philosophy: {{differentiator}}.\n\nThey work with {{icp}} who are ready to stop guessing and start building real, lasting results.\n\nIf that sounds like where you're at, they're worth a conversation.\n\n— {{botName}}",
    personal_checkin: "Hey {{name}},\n\nJust checking in — how's the training going?\n\n{{tenantName}} asked me to follow up. They care about whether the people they talk to are actually making progress — even if it's not with them.\n\nWhat's been happening with your fitness lately?\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nOne quick question.\n\nOn a scale of 1-10, how committed are you to making a real change in your fitness in the next 90 days? (1 = thinking about it, 10 = I'm ready to start this week).\n\nJust reply with a number.\n\n— {{botName}}",
    one_to_ten_part2: "Got it.\n\nWhat's the main thing in the way — time, cost, not knowing where to start, or not feeling ready yet?\n\nJust want to understand what we're actually dealing with.\n\n— {{botName}}",
    gap_closing: "That makes sense — {{answer}}.\n\nHonestly, that's the most common thing {{tenantName}} hears. It's the reason they built their program the way they did — specifically to help people past {{answer}}.\n\nKnowing that, does a 15-minute discovery call feel like a worthwhile next step?\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\n{{tenantName}} only takes a limited number of new clients each month to make sure everyone gets real attention — not a generic program with your name on it.\n\nI have a discovery call slot available this week. If the timing isn't right for you, I'll give it to the next person on the list.\n\nJust let me know either way.\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nBefore I close your file, worth sitting with this.\n\nA year from now you'll have been doing something with your body for 365 days — either building toward the thing you want, or not.\n\nThe clock runs the same either way. The difference is what you do with it.\n\nIf you're ready to build, reply with \"I'm in.\"\n\n— {{botName}}",
    final_takeaway: "Hey {{name}},\n\nThis is my last follow-up. Closing your file now.\n\n{{tenantName}} genuinely wishes you well. Whenever you're ready to make a move — whether that's in a month or a year — the door is open.\n\nTake care of yourself!\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}},\n\nOne more quick win: if you're not tracking your workouts at all, just start writing down what you did and how it felt. That single habit — written accountability — is one of the biggest predictors of long-term consistency, according to research.\n\n{{tenantName}} makes their clients do it from day one.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in on your fitness goals. — {{botName}}",
  },
};
