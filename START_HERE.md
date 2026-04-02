# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-04-01 (Session 5 — voice overhaul, morning report, admin dashboard, customer onboarding)
**Author:** Claude Sonnet 4.6

---

## What Is Tiger Claw?

AI sales agent SaaS. Customers buy on Stan Store, walk through a 5-step wizard to configure their bot + AI key + customer profile, hit "Hatch," and get a live AI sales agent. Built on Cloud Run, PostgreSQL, Redis/BullMQ, Gemini/OpenAI.

- **API:** Cloud Run (us-central1), project `hybrid-matrix-472500-k5`
- **Wizard + Admin:** Next.js on Vercel at `wizard.tigerclaw.io`
- **Admin Dashboard:** `wizard.tigerclaw.io/admin` — token via `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **Architecture:** BYOB (customer's Telegram token) + BYOK (customer's AI key)
- **DB:** Cloud SQL proxy port **5433** locally (NOT 5432), user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`

---

## Current State: LAUNCH DAY — PAYING CUSTOMERS BEING ACTIVATED

### Customers Ready to Hatch (pending_setup, wizard link sent)

| Customer | Email | Paid | Channel |
|----------|-------|------|---------|
| Debbie | `justagreatdirector@outlook.com` | $97 Mar 10 | Telegram |
| Jeff Mack | `jeffmackte@gmail.com` | $147 Mar 26 (Pro) | Telegram |
| John (Thailand) | `vijohn@hotmail.com` | $97 Feb+Mar | LINE (th-th) |

All three: send `wizard.tigerclaw.io` — wizard finds their purchase by email.

### Other Stan Store customers owed agents (not yet in DB)
- `chana.loh@gmail.com` — paid $97 twice
- `nancylimsk@gmail.com` — paid $97 Mar 2
- `lily.vergara@gmail.com` — paid $97 twice

---

## Session 5 PRs (2026-04-01)

| PR | What It Fixed |
|----|--------------|
| #122 | value-gap JOIN type cast — `varchar = uuid` crash, check-ins broken for all tenants since launch |
| #123 | `INTERNAL_API_URL` missing from deploy — tiger_keys/hive/onboard/settings fataling on every call |
| #124 | bot_pool removed from `/health` — V4 has no pool, was always `critical: 0` (false alarm) |
| #125 | Relevance gate in data refinery — second Gemini call blocks gaming/fiction noise before save |
| #126 | Tiger voice overhaul — 5 conversation examples replace 40-line rules wall |
| #127 | tiger_scout rate limit reason hidden from Gemini — stopped "23 more hours" responses |
| #128 | Only `output` string sent to Gemini — strips raw tool data that produced woody responses |
| #129 | Morning hunt report — `daily_scout` now pushes proactive Telegram/LINE message at 7 AM UTC |
| #130 | Admin dashboard timeout — N+1 getBotState calls replaced with single query |
| #131 | Admin dashboard UX — localStorage token, 5min refresh, new agents today stat |

---

## The Woody Response Fix (Important Context)

Three layers were causing "I can't do that for 23 more hours" type responses:

1. **System prompt** (PR #126): Replaced 40-line NEVER/banned-phrases rules wall with 5 real conversation examples. Rules made Gemini play it safe. Examples train the voice.
2. **Tool data leak** (PRs #127, #128): `tiger_scout` was returning `reason: "Last scheduled scan was 23 hours ago"` in the data payload. `runToolLoop` was passing the full tool object to Gemini. Gemini read the technical fields and paraphrased them. Fix: only `{ output }` is passed to Gemini now.
3. **SOUL.md** is unchanged and fully loaded in every prompt — the brand vision is intact.

---

## Morning Hunt Report (Now Live)

`daily_scout` was silently running tiger_scout at 7 AM UTC and discarding Gemini's response (`return ''`). Operators never heard back.

Now: Tiger composes a morning message after scouting and sends it via Telegram or LINE. Every operator wakes up to a report from their bot. Language of Hope fires if pipeline is empty — never dead air.

---

## Admin Dashboard

**URL:** `wizard.tigerclaw.io/admin`
**Token:** see above (gcloud command). Stored in localStorage after first login — no re-entry needed on refresh.
**Refresh:** every 5 minutes (was 60s — was causing timeout loop)
**Shows:** active agents, +N new today, messages 24h, platform cost, mine health, full tenant fleet with email/status/leads

---

## Wizard Flow (5 Steps)

1. **StepIdentity** — niche, bot name, operator name, email
2. **StepChannelSetup** — Telegram + LINE (at least one required)
3. **StepAIConnection** — BYOK key + validation
4. **StepCustomerProfile** — ICP data
5. **StepReviewPayment** — "Hatch"

First message after hatch: ICP fast-path sends confident intro, skips calibration interview entirely.

---

## Open Work (Session 6)

| Item | Priority |
|------|----------|
| Activate remaining Stan Store customers (chana, nancy, lily) | HIGH |
| `bot_ai_keys` dead write cleanup | LOW |
| Customer-facing dashboard (reduce Telegram token friction) | MEDIUM |
| Navigation recovery — dashboard link kills wizard state | MEDIUM |

---

## Active Business

| Deal | Contact | Status |
|------|---------|--------|
| White Label | Max Steingart | 30% affiliate via Stan Store. Must sell 10 first. |
| LINE Distribution | John / Bryson International Group | 21,000 LINE distributors in Thailand |
| Pro customer | Jeff Mack | $147 paid, pending_setup |

---

## Rules of Engagement

1. One PR per fix. No chaining.
2. Never push to main directly. Always `feat/` + `gh pr create`.
3. Architecture is LOCKED. No RAG, no containers, no OpenClaw.
4. No new features without a customer asking for it.
5. The mission: paying customers get a live bot that works.
