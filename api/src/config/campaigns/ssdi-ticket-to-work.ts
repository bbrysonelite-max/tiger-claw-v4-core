// Tiger Claw — SSDI Ticket to Work mine campaign
//
// First MineCampaign. Hunting-only — no bot, no soul, no onboarding.
//
// Contract: $20K/month lead-gen contract via Pat Sullivan (co-founder of ACT!
// CRM, 1987) for one of his clients in the SSDI / Ticket to Work space.
//
// Ideal prospect: a person on SSDI or SSI, age 18-64, who is interested in
// returning to work but does not know about the Social Security
// Administration's free Ticket to Work program. The lead handoff lets Pat's
// client connect them with a TTW employment network and helpline.
//
// Knowledge base for downstream outreach:
//   - Ticket to Work is a FREE SSA program
//   - Beneficiaries can work without immediately losing benefits
//   - Trial Work Period — 9 months earning above the threshold without
//     losing cash benefits
//   - Medicare continues for at least 7 years 9 months after Trial Work Period
//   - Helpline: 1-866-968-7842 (1-866-YOURTICKET)
//   - Website: choosework.ssa.gov

import type { MineCampaign } from "./types.js";

export const SSDI_TICKET_TO_WORK_CAMPAIGN: MineCampaign = {
  key: "ssdi-ticket-to-work",
  displayName: "SSDI — Ticket to Work",
  description:
    "Identifies SSDI/SSI beneficiaries (18–64) who are interested in working but unaware of the Social Security Administration's free Ticket to Work program. Leads are handed off to a contracted employment network for outreach.",

  scoutQueries: [
    "subreddit:disability want to work but afraid of losing benefits",
    "subreddit:SSDI return to work program",
    "subreddit:disabilitybenefits ticket to work",
    "subreddit:ChronicIllness wish I could work part time",
    "subreddit:mentalhealth disability want to work again",
    "subreddit:Anxiety on disability cant work",
    "subreddit:ChronicPain part time work disability",
    "subreddit:careerguidance returning to work after disability",
  ],

  idealProspectProfile: {
    summary:
      "An adult (18–64) currently receiving SSDI or SSI who has expressed interest in returning to work, part-time work, or vocational training, and shows signs of not knowing the Ticket to Work program exists.",

    traits: [
      {
        name: "Active SSDI/SSI Recipient",
        description:
          "Self-identifies as currently receiving Social Security Disability Insurance, SSI, or 'disability benefits' from the federal government.",
        language: [
          "I'm on SSDI",
          "I'm on SSI",
          "I get disability",
          "my disability check",
          "Social Security disability",
          "SSA disability",
        ],
      },
      {
        name: "Working-Age Adult",
        description:
          "Indicates they are between 18 and 64 — the eligible age window for the Ticket to Work program. Older posts (retirement-age) or minors are out of scope.",
        language: [
          "I'm 32",
          "in my 40s",
          "I'm 55",
          "young to be on disability",
          "before retirement age",
        ],
      },
      {
        name: "Active Work Interest",
        description:
          "Explicitly says they want to work, want to try working, miss working, or are exploring part-time / remote / vocational options. Not just complaining — actively seeking re-entry.",
        language: [
          "I want to work",
          "I miss working",
          "want to try working",
          "looking for part time",
          "remote work I could do",
          "vocational rehab",
          "go back to work",
          "ease back into working",
        ],
      },
      {
        name: "Benefit-Loss Fear",
        description:
          "Names the specific fear that working will instantly cancel their benefits — the exact misconception Ticket to Work is designed to address.",
        language: [
          "afraid I'll lose my benefits",
          "scared to work because of SSA",
          "lose my Medicare",
          "lose my check",
          "kicked off disability",
          "can't risk losing it",
        ],
      },
      {
        name: "Unaware of Ticket to Work",
        description:
          "Asks general 'how do people on disability work' questions without naming Ticket to Work, Trial Work Period, or Employment Network — a strong signal they don't know the program exists.",
        language: [
          "is there any program",
          "anyone know how",
          "how does this even work",
          "does SSA let you",
          "I had no idea",
          "wish there was a way",
        ],
      },
    ],

    disqualifiers: [
      {
        name: "Already in Ticket to Work",
        signal:
          "Mentions they are already enrolled in Ticket to Work, working with an Employment Network, or in a Trial Work Period — they're already served, not a lead.",
      },
      {
        name: "Retirement-age",
        signal:
          "Self-identifies as 65+ or as receiving retirement (RIB) instead of SSDI/SSI — outside the program's eligibility window.",
      },
      {
        name: "Minor / under 18",
        signal:
          "Self-identifies as under 18, a teen, or asking about their child — Ticket to Work is for adults.",
      },
      {
        name: "Not US-based",
        signal:
          "Mentions a non-US country (UK PIP, Canada CPP-D, Australia DSP, etc.) — Ticket to Work is a US-only SSA program.",
      },
      {
        name: "Permanent inability to work",
        signal:
          "States explicitly that returning to work is not possible at any level (e.g., terminal illness, full-time bed-bound) — outside the program's mission.",
      },
    ],

    rejectExamples: [
      "Generic article or news piece about SSDI policy with no individual prospect voice",
      "Lawyer / law firm advertising disability benefits services",
      "Government or .gov page summarizing Ticket to Work (we already know about it)",
      "Posts from caretakers asking about a relative — we need the beneficiary's own voice",
      "Job board listings tagged 'disability friendly' with no prospect commentary",
      "Medical-only posts about diagnosis, treatment, or symptoms with no work or benefits angle",
      "General career advice posts where 'disability' is incidental",
      "Posts about VA disability or workers' comp — different programs, different rules",
    ],

    sourceUrlBlocklist: [
      "ssa.gov",
      "choosework.ssa.gov",
      "disabilitysecrets.com",
      "nolo.com",
      "disability-benefits-help.org",
    ],
  },

  leadSchema: [
    { name: "created_at", description: "When the post / signal was captured." },
    { name: "source_url", description: "Permalink back to the original Reddit post." },
    { name: "entity_id", description: "Reddit username (u/handle) of the prospect, when available." },
    { name: "fact_summary", description: "1–2 sentence purified summary of the prospect's stated interest." },
    { name: "verbatim", description: "Exact quoted text from the source post." },
    { name: "relevance_score", description: "0–100 confidence from the IPP relevance gate." },
    { name: "relevance_reason", description: "Why the gate kept this lead (which traits matched)." },
  ],

  deliveryMode: "admin-export",
};
