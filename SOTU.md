# Tiger Claw — State of the Union

**Last updated:** 2026-04-06 (Session 15 COMPLETE)
**This is the single source of truth. Read nothing else until you finish this file.**

---

## Standing Orders

**No lying. No assuming. No guessing.**
- Do not claim anything works unless you have tested it live.
- Do not mark a session complete if known broken items remain.
- The operator is running a real business. False confidence causes real damage.
- No AI agent pushes directly to `main`. All changes via `feat/` or `fix/` branch + PR.
- "I merged it" means nothing until confirmed. After every PR, verify with `gh pr view <number>` that state is `MERGED`. After every deploy, verify health endpoint returns 200. Do not tell the operator something is done until you have proof it is done.

---

## Ground Truth as of 2026-04-06

**This system has never run in production. Not once.**

No agent has ever had a real conversation with a real prospect. No operator has ever completed onboarding end-to-end via a real payment and watched their bot scout and contact someone. Every assessment of what "works" is based on code review and unit tests — not live observation. Do not assume otherwise.

The test suite passes. The infrastructure is healthy. The Paddle webhook is live. But the full loop — pay → provision → hatch → scout → contact → reply — has never closed on a real person.

**That is the first milestone. Everything else is secondary.**

---

## Current Platform State

**Last deployed revision:** `tiger-claw-api-00372-mg2` (deployed 2026-04-06, Session 15)
**Health (last verified 2026-04-06):** postgres OK, redis OK, workers OK
**Tests:** 458/458 passing
**Wizard:** `wizard.tigerclaw.io` — Vercel, auto-deploy confirmed working

---

## What Was Done This Session (Session 15 — 2026-04-06)

**PRs #235, #236, #237 merged:**

1. **Verbatim fix — PR #235**
   - `tiger_refine.ts`: field renamed `rawText` → `verbatim`. Prompt now requires exact word-for-word quotes from source text. Added CRITICAL RULE: if no exact quote exists, do not save the fact. Filter enforces minimum 15 chars.
   - Tests updated: `verbatim` field validated, new test rejects facts with empty/missing verbatim.
   - Mine confirmed producing 209 posts with Oxylabs (vs 14 from Serper fallback).

2. **Paddle webhook integration — PR #236**
   - `POST /webhooks/paddle` endpoint: HMAC-SHA256 signature verification, Redis idempotency (24h TTL), fail closed on Redis unavailability (503).
   - Provisions BYOK user + bot + subscription on `transaction.completed`.
   - 8 tests in isolated file (`paddle-webhook.test.ts`) — avoids `vi.resetModules()` contamination.
   - GCP secrets created: `paddle-webhook-secret`, `paddle-api-key`.
   - Paddle dashboard configured: webhook URL `https://api.tigerclaw.io/webhooks/paddle`, event `transaction.completed`.
   - Deploy script updated with both Paddle secrets.
   - **What's still missing:** A Paddle product + price. No checkout URL exists yet. Create before testing end-to-end.

3. **Wizard flavor fix — PR #237**
   - Removed 5 cut flavors from wizard signup: personal-trainer, dorm-design, baker, candle-maker, gig-economy.
   - Wizard now shows the canonical 9 flavors matching the API registry.

4. **Deployed:** Cloud Run revision `00372-mg2`. Health verified. `fix-all-webhooks` run (2 tenants fixed).

5. **Discovered — Admin alert markdown bug:** Underscores in error messages (e.g. `pending_setup`, `botId=`) break Telegram's Markdown v1 parser. Admin alerts containing error text fail to deliver. Fix needed before launch.

---

## What Was Done This Session (Session 14 — 2026-04-06)

**PR #233 merged:**

1. **Admin agent visibility**
   - New endpoint: `GET /admin/agent-health` — returns per-tenant scout state + activeContext for all tenants in parallel. Per-tenant errors silenced to null, never block.
   - Admin fleet table: 3 new columns — Onboard (green check or phase label), Scout (leads qualified + age of last burst scan), Focus (currentFocus + activeLead from activeContext).
   - Both fetches fire-and-forget after main dashboard load.

2. **Flavor simplification: 13 -> 9**
   - Cut: `gig-economy` (duplicate of network-marketer signals), `personal-trainer` (duplicate of health-wellness), `baker` (no viable prospecting use case via messenger), `candle-maker` (same).
   - Replaced `dorm-design` with `interior-designer`: rewritten as a full-service interior design business agent. Homeowner/renovation intent signals, real scout queries (r/malelivingspace, r/HomeDecorating, r/interiordesign), professional objection handling.
   - Remaining 9 customer-facing flavors: network-marketer, real-estate, health-wellness, airbnb-host, lawyer, plumber, sales-tiger, interior-designer, mortgage-broker.
   - Files for cut flavors remain on disk (dormant). Registry and VALID_FLAVOR_KEYS updated.

3. **Test fix (pre-existing)**
   - `tiger_scout.httpsGet` uses global `fetch` (Node 18+), not Node's `https` module. Phase 1 autonomous loop test was mocking the wrong layer. Replaced `vi.mock('https')` with `vi.stubGlobal('fetch')`. Phase 1 now reliably discovers mock prospects.

**Tool audit conducted (no changes made):**
- 25 tools in toolsMap audited in full.
- `tiger_aftercare` is load-bearing — tiger_convert hands off to it. Do not remove.
- `tiger_objection` is load-bearing — tiger_nurture imports its functions at compile time. Do not remove.
- `tiger_email` (Resend) is needed — email capability is required for autonomous operation.
- `tiger_drive_list` is the only confirmed safe cut. Not yet made.
- No tool changes made this session. Simplification paused pending first live conversation.

---

## Session 13 — What Was Done (2026-04-05)

- PR #220: MODULE_ASSESSMENT + SOTU updated. C1/C2/H1/H3/M1/M3 marked resolved.
- PR #221 (fix/C3): Hatch email personalized — agent name + flavor, Tiger's voice, null-safe botUsername.
- PR #222 (fix/M2): makeSerperFetcher() factory in market_miner. getSerperKey() round-robin in tiger_scout — all 3 Serper keys used.
- Website PR #1: Refund policy added to tigerclaw.io for Paddle compliance.
- Deployed: revision 00353-947.

---

## Open Issues

| # | Issue | Priority |
|---|---|---|
| DAY ZERO | System has never run in production. First priority: prove full loop — Paddle purchase → provision → hatch → scout → contact → reply. | IMMEDIATE |
| PADDLE PRODUCT | Webhook live but no Paddle product/price created. No checkout URL. Create before testing end-to-end payment flow. | IMMEDIATE |
| ADMIN ALERT BUG | Underscores in error messages break Telegram Markdown parser. Admin alerts with error text silently fail. Fix before launch. | HIGH |
| C4 | Payment gate still open for direct wizard access (no Paddle purchase required). Fix after Paddle loop proven. | NEXT SESSION |
| TOOL AUDIT | tiger_drive_list confirmed safe to remove from toolsMap. Not yet done. | LOW |

**Past customers owed bots (3 people paid, never received service):**
`chana.loh@gmail.com`, `nancylimsk@gmail.com`, `lily.vergara@gmail.com` — offer complimentary re-activation when platform is proven live.

---

## Cold Start Checklist (Do This First, Every Session)

1. Read this file top to bottom
2. Run `curl https://api.tigerclaw.io/health` — confirm postgres, redis, workers all OK
3. Read `MODULE_ASSESSMENT.md`
4. Check current deployed revision vs latest merged commits
5. Do not touch anything until you know what is broken and what is not

**Admin token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
**DB (local):** port `5433`, user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`

---

## What This Product Is

Stateless agent hatchery. Operator brings their own Telegram bot token (BYOB) and Gemini API key (BYOK). One-page signup. Agent hatches knowing its ICP. Agent prospects while operator sleeps. Hive gets smarter with every run.

**The value proposition: Your bot hunts while you sleep.**

**Active channel:** Telegram only. LINE is future.

---

## Current Onboarding Path

**Paddle is the active payment path as of Session 15.**

```
Operator pays via Paddle checkout (checkout URL not yet created — build tomorrow)
  → Paddle fires POST /webhooks/paddle (transaction.completed)
  → Webhook provisions: createBYOKUser + createBYOKBot + createBYOKSubscription(pending_setup)
  → Operator navigates to wizard.tigerclaw.io
  → Wizard starts at "What kind of agent do you want?" (no email step — Paddle already provisioned)
  → POST /wizard/hatch → BullMQ job → bot registered, webhook set, ICP loaded
```

**Payment gate is still open** for direct wizard access (no Paddle purchase required). This is C4. Fix after Paddle loop is proven.

Payment processor status:
- **Paddle:** ✅ LIVE. Webhook at `https://api.tigerclaw.io/webhooks/paddle`. Secrets in GCP. Product/price not yet created — do this tomorrow.
- **Stan Store:** Active front door for existing customers. Not the primary new-customer path.
- **Stripe:** Placeholder. Not used.
- **Lemon Squeezy:** Rejected. Dead end.

---

## Architecture (Locked)

| Layer | Technology | Notes |
|---|---|---|
| Compute | Google Cloud Run | Node.js/Express, port 4000, `tiger-claw-api` |
| Database | Cloud SQL PostgreSQL | `tiger_claw_shared`, proxy port **5433** locally (NOT 5432) |
| Cache / Queues | Cloud Redis + BullMQ | 8 queues. `ENABLE_WORKERS=true` required in deploy. |
| AI | Gemini 2.0 Flash | LOCKED. Do not switch to 2.5-flash (GCP function-calling bug). |
| Signup + Dashboard | Next.js, `web-onboarding/` | `wizard.tigerclaw.io` — Vercel. Auto-deploy working. |
| Website | Static HTML | `tigerclaw.io` — separate repo |
| Payments | Stan Store (active) | Paddle pending. LS rejected. Stripe fallback. |
| Scout search | Serper | `SERPER_KEY_1/2/3` — round-robin rotation active |
| Reddit | Blocked | 403 from Cloud Run egress. Oxylabs fix pending. |
| Email | Resend | Domain verified. `RESEND_API_KEY` in deploy. Needed for autonomous operation. |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Multi-region | `us-central1` (primary) + `asia-southeast1` | Global LB at `api.tigerclaw.io` |

---

## Live Service Status

Last verified 2026-04-06:

| Service | Status | Notes |
|---------|--------|-------|
| Cloud Run | OK | Revision 00372-mg2 |
| Postgres | OK | Healthy |
| Redis | OK | Healthy |
| Workers | OK | ENABLE_WORKERS=true confirmed |
| Serper keys (x3) | OK | Round-robin active |
| Oxylabs | OK | Username/password in GCP. Mine produced 209 posts on last run. |
| Platform Gemini key | OK | Active |
| Admin Telegram bot | PARTIAL | Alerts fire but fail when message contains underscores (Markdown bug) |
| Resend | OK | Test email confirmed delivered |
| TELEGRAM_WEBHOOK_SECRET | OK | secretWired: true confirmed |
| Vercel (wizard.tigerclaw.io) | OK | Auto-deploy confirmed working |
| Paddle webhook | OK | Live at /webhooks/paddle. Secrets in GCP. Product/price not yet created. |
| Reddit (scout) | BLOCKED | 403 from Cloud Run. Oxylabs + Serper fallback active. |
| LINE | NOT ACTIVE | Future only |

---

## Flavor Registry (9 customer-facing)

| Key | Flavor | Notes |
|---|---|---|
| network-marketer | Network Marketer | Dual-oar (builder + customer) |
| real-estate | Real Estate Agent | |
| health-wellness | Health & Wellness | |
| airbnb-host | Airbnb Host | STR-specific |
| lawyer | Lawyer / Attorney | |
| plumber | Plumber / Trades | Emergency-first signals |
| sales-tiger | Sales Tiger | Dual-oar (talent + B2B buyer) |
| interior-designer | Interior Designer | Full-service business. Written for specific personal commitment. |
| mortgage-broker | Mortgage Broker | Dual-oar (buyers + refinancers) |

Internal/non-customer: `admin`, `researcher` (in registry, not in VALID_FLAVOR_KEYS)

---

## Tool Registry (25 tools in toolsMap)

All tools live in `api/src/tools/`. All must be in `toolsMap` in `ai.ts` or Gemini enters an infinite loop.

**Registered:**
tiger_onboard, tiger_scout, tiger_contact, tiger_aftercare, tiger_briefing, tiger_convert, tiger_export, tiger_email, tiger_hive, tiger_import, tiger_keys, tiger_lead, tiger_move, tiger_note, tiger_nurture, tiger_objection, tiger_score, tiger_score_1to10, tiger_search, tiger_settings, tiger_drive_list, tiger_strike_harvest, tiger_strike_draft, tiger_strike_engage, tiger_refine

**Load-bearing (do not remove without major refactor):**
- `tiger_aftercare` — tiger_convert hands off to it post-conversion. Entire retention pipeline.
- `tiger_objection` — tiger_nurture imports its functions at compile time. Removing breaks nurture.

**Intentionally NOT registered:**
- `tiger_gmail_send` — must never send from operator's personal Gmail without human approval.
- `tiger_postiz` — social broadcasting is not Tiger's job.

---

## Module Assessment Summary

Full details in `MODULE_ASSESSMENT.md`.

| Module | Status | Notes |
|---|---|---|
| 1. Scout | Degraded — Reddit 403, Serper fallback active | Oxylabs fix pending |
| 2. Hive | Working — passive learning via emitHiveEvent in scout/convert | 313 facts on first run |
| 3. Cognitive Architecture | buildSystemPrompt() wired: ICP, hive benchmarks, market facts, activeContext, fact_anchors | Never tested live |
| 4. Hatchery | BYOB/BYOK/ICP flow built | Never completed with a real operator watching |
| 5. Orchestration | Daily scout, nurture, value gap, briefing all built | Never run against real leads |
| 6. Tools | 25 tools registered. Audit complete. 2 load-bearing identified. | No live usage data |
| 7. Memory | Short-term, hive, fact_anchors all wired | Never validated in real conversation |
| 8. Payment/Dashboard | Payment gate open (C4). Admin dashboard operational. | C4 is the only public launch blocker |

---

## Post-Deploy Protocol (Mandatory Every Time)

```bash
# 1. Deploy API
gcloud run deploy tiger-claw-api \
  --source ./api \
  --region us-central1 \
  --project hybrid-matrix-472500-k5 \
  --quiet

# 2. Health check
curl https://api.tigerclaw.io/health

# 3. Fix all webhooks (idempotent)
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Deploy wizard (from web-onboarding/ directory)
npx vercel deploy --prod --yes
```

---

## Engineering Constraints (Non-Negotiable)

- `main` is branch-protected. Always `feat/` or `fix/` branch + PR. No AI agent pushes to main.
- **Gemini 2.0 Flash only.** 2.5-flash has a GCP function-calling bug. Do not change.
- No Docker containers per tenant. No OpenClaw. No Mini-RAG. Gone permanently.
- `buildSystemPrompt()` is async. Always `await` it.
- New tools in `api/src/tools/` MUST be registered in `toolsMap` in `ai.ts`. Missing = infinite tool loop.
- Market intelligence domain key = flavor **displayName** (e.g. `"Real Estate Agent"`), NOT flavor key.
- `node-fetch` is not in `package.json`. Use native `fetch` (Node 18+).
- Cloud SQL proxy runs on port **5433** locally, not 5432.
- One PR per fix. Test before opening a PR. Delete branch after merge.
- `tiger_gmail_send` and `tiger_postiz` are NOT in toolsMap by design. Do not re-add.
- 449 tests must pass before any PR is opened. Run `npm test` from `api/`.

---

## Future Vision (Do Not Build Yet)

- **Reflexion Loop:** Outcome signals feed back into fact_anchors and hive_signals. Agent wakes smarter. Build after 10+ agents have real outcome data.
- **Agent Leaderboard:** Opt-in fleet ranking by leads surfaced, pipeline activity, conversion rate. Build after Reflexion Loop.
- **Affiliate tracking:** `?ref=` tag on signup URL. Build when first referral sale actually happens.

Do not mention any of these publicly until built.

---

## Session Protocol

**Start of session:** Run cold start checklist. Read this file. Read `MODULE_ASSESSMENT.md`. Do not code until you know what is broken.

**End of session:** Update this file before closing:
1. Update "Last updated" line
2. Update Live Service Status if anything changed
3. Update Open Issues (mark resolved, add new)
4. Add session summary above

A session that ends without updating this file leaves the next agent blind.
