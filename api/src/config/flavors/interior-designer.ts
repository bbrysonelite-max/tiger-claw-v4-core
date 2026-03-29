// Tiger Claw — Interior Designer Flavor
// Specialized in college dorm design and high-intent parent/student prospecting.

import type { FlavorConfig } from "../types.js";

export const INTERIOR_DESIGNER_FLAVOR: FlavorConfig = {
  key: "interior-designer",
  displayName: "Interior Designer",
  description: "Specialized prospecting engine for interior designers. Targets parents and students preparing for college dorm life.",
  professionLabel: "interior design",
  defaultKeywords: [
    "going to college", "dorm decor", "dorm room ideas", 
    "freshman year", "dorm layout", "move in day",
    "dorm essentials", "lofting my bed", "college roommate"
  ],

  scoutQueries: [
    "subreddit:college OR subreddit:Dorms dorm room interior design tips setup move in",
    "subreddit:college OR subreddit:femalelivingspace freshman dorm room decor ideas",
    "subreddit:Dorms OR subreddit:CollegeLife dorm move in day furniture layout design",
    "subreddit:malelivingspace OR subreddit:femalelivingspace matching dorm roommate decor aesthetic",
    "subreddit:college OR subreddit:Dorms loft bed dorm layout maximize small space",
  ],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "book a design consultation or purchase a decor package",
  },

  objectionBuckets: [
    {
      key: "cost",
      label: "Cost / Budget",
      keywords: ["expensive", "budget", "cost", "too much", "money"],
      responseTemplate: "I totally get it — college is already a massive investment. {tenantName} focuses on 'high-impact, low-cost' transformations. They’ve spent {years} figuring out how to make a standard 12x12 room feel like a home without breaking the bank.",
      followUpQuestion: "If we could show you a layout that fits your specific budget, would you be open to a quick 5-minute chat?"
    },
    {
      key: "temporary",
      label: "Temporary Living",
      keywords: ["temporary", "only a year", "not permanent", "waste"],
      responseTemplate: "It's true, it is only for a year. But {tenantName} believes that your environment directly impacts your mental health and study habits. {biggestWin} came from helping students feel settled so they can actually focus on their classes.",
      followUpQuestion: "Does your student usually study better in a space that feels organized, or are they a 'coffee shop' studier?"
    }
  ],

  patternInterrupts: [
    {
      name: "The 87% Rule",
      moments: ["stall", "general"],
      storyTemplate: "Did you know that 87% of college freshmen report feeling 'overwhelmed' within the first 3 weeks? {tenantName} found that students with a personalized, 'anchored' space report 30% less homesickness. We're not just moving furniture; we're building a launchpad for their next four years."
    }
  ],

  onboarding: {
    identityQuestions: [
      { key: "designStyle", question: "What is your primary design aesthetic (e.g., Boho, Minimalist, Preppy)?", required: true },
      { key: "serviceArea", question: "Do you offer remote e-design, or only local in-person installs?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: "You are an assistant for a high-end Interior Designer. You are empathetic to the stress of 'Move-in Day' and the transition to college.",
    toneDirectives: ["Creative", "Organized", "Warm", "Visionary"],
    languageDirective: "Always sound like a professional who knows how to maximize small spaces.",
    neverDoList: [
      "Never suggest permanent modifications that would violate dorm rules.",
      "Never dismiss a parent's anxiety about the transition.",
    ],
  },

  discovery: {
    activeSources: ["reddit", "facebook_groups", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "Hey {{name}},\n\nI'm {{botName}}, working with {{tenantName}}.\n\nI saw you're prepping for the fall move-in. Just wanted to share a quick 'Space Hack' we use: lofting the bed isn't always the best move if you want a cozy lounge area.\n\nNo pitch, just thought you'd find it useful.\n\n— {{botName}}",
    testimonial: "Hey {{name}},\n\nQuick one — {{tenantName}} just finished a dorm for a freshman at UT Austin who was stressed about the tiny floor plan. One week later, the roommate asked for the same setup.\n\nEnvironment really is everything.\n\n— {{botName}}",
    authority_transfer: "Hey {{name}},\n\nI realized I haven't properly introduced you to {{tenantName}}. They've been in {{professionLabel}} for {{years}} and their specialty is {{differentiator}}.\n\nIf you want to avoid the 'Target Aisle 4' look that every other dorm has, they are the best in the business.\n\n— {{botName}}",
    personal_checkin: "Hey {{name}},\n\nJust checking in — how's the college prep going? I know it's a lot to juggle.\n\n— {{botName}}",
    one_to_ten_part1: "Hey {{name}},\n\nOn a scale of 1-10, how 'ready' do you feel for the dorm move-in? 1 = complete chaos, 10 = boxes are already packed.\n\n— {{botName}}",
    one_to_ten_part2: "Appreciate the honesty! What's the biggest thing keeping you from a 10? Layout, decor, or just the logistics?\n\n— {{botName}}",
    gap_closing: "Got it — {{answer}}. That's a fair concern. {{tenantName}} actually specializes in exactly that.\n\n— {{botName}}",
    scarcity_takeaway: "Hey {{name}},\n\nJust being straight with you — {{tenantName}}'s August calendar is almost full. If you want help with the dorm layout, we should probably talk this week.\n\n— {{botName}}",
    pattern_interrupt: "Hey {{name}},\n\nThink about this: your student will spend 1,000+ hours in that room this year. It's their bedroom, office, and living room combined.\n\nIs it worth 10 minutes to make sure it's actually a space they want to be in?\n\n— {{botName}}",
    final_takeaway: "I'll step back now. {{tenantName}} is moving forward with their active clients. Best of luck with the move!\n\n— {{botName}}",
    slow_drip_value: "Hey {{name}}, just checking in. {{tenantName}} has been seeing a shift in {{differentiator}}.\n\n— {{botName}}",
    default_fallback: "Hey {{name}}, just checking in. — {{botName}}"
  },
};
