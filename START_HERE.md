# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
Stop what you are doing. Read this entire document and `CLAUDE.md`. These are your injected directives. Do not ask Brent to repeat himself. Do not rely on hallucinated history.

---

## 1. The Current State of the Universe

**Tiger Claw is LIVE and fully deployed. CI is green. PRs #62–#79 merged. Purchase-based auth LIVE.**
- **API:** `https://api.tigerclaw.io` — Cloud Run `tiger-claw-api`, multi-region (us-central1 + asia-southeast1)
- **Load Balancer:** Global HTTPS LB at `34.54.146.69` — both regions behind Anycast IP
- **Architecture:** V4 Stateless Serverless — one API process, all tenants, context resolved per-request
- **Database:** PostgreSQL HA via Cloud SQL Proxy (`tiger_claw_shared`)
- **Cache/Queue:** Redis HA + BullMQ (8 queues)
- **AI Engine:** Gemini 2.0 Flash (LOCKED — `gemini-2.5-flash` has a GCP function-calling bug, do not use it)
- **Tests:** 396 passing
- **Flavors:** 15 customer-facing industry flavors, all with subreddit-scoped scoutQueries (PR #73)
- **Min-instances:** 1 — no cold start
- **Data Refinery:** v5 pipeline FULLY AUTONOMOUS — fires nightly at 2 AM UTC via BullMQ. First run: 313 facts saved across 14 flavors.

**Strict Rule 1:** OpenClaw, Mini-RAG, and per-tenant Docker containers are DEAD. Do not reference or restore them.

**Strict Rule 2:** `main` is branch-protected. NEVER push directly. Always use `feat/` branches and `gh pr create`.

**Strict Rule 3:** Read `CLAUDE.md` before writing any code. Non-negotiable product and engineering directives.

**Strict Rule 4:** Anthropic is NOT wired. Do not add it back without implementing the full `@anthropic-ai/sdk` code path in `api/src/services/ai.ts`. Deferred to Phase 6.

**Strict Rule 5:** BYOB PIVOT is complete and live. Bot pool is permanently removed from the provisioning path. Telegram tenants bring their own token via the wizard. `pool.ts` is retained for token encryption only.

**Strict Rule 6:** The 61 pool tokens are Brent's personal fleet. Retrieve them via `GET /admin/pool/tokens`. Do NOT delete them.

**Strict Rule 7:** Magic link email flow is DEAD. Auth is now purchase-based: `POST /auth/verify-purchase`. Do not restore magic link logic.

---

## 2. What Has Been Accomplished (Full History)

1. **V4 Stateless Architecture** — Cloud Run API, shared PostgreSQL, Redis, BullMQ.
2. **18 Native Function Calling Tools** — `api/src/tools/`. All tests passing.
3. **Business Model: Card Upfront** — No free trial. Stan Store checkout. 7-day MBG.
4. **Multi-Provider AI** — Google Gemini, OpenAI, Grok, OpenRouter, Kimi. Anthropic deferred to Phase 6.
5. **Memory Architecture V4.1** — `buildSystemPrompt()` is async. Sawtooth compression, fact anchors, hive signals, focus primitives.
6. **Value-Gap Detection Cron** — 9 AM UTC daily. Active/onboarding tenant, zero leads in 3 days → diagnostic message to operator.
7. **Email Infrastructure** — Resend (outbound), Postmark (inbound support). `hello@tigerclaw.io`, `support@tigerclaw.io` live.
8. **Email Support Agent** — Postmark → BullMQ → AI → Resend reply.
9. **Admin Dashboard** — `wizard.tigerclaw.io/admin/dashboard`. Bearer token auth. Fleet management, bot pool health.
10. **Beta Hardening** — ADMIN_TOKEN rotated, Telegram webhook secret, dead trial code removed.
11. **Stan Store Webhook** — `POST /webhooks/stripe` provisions user. Idempotent via Redis.
12. **Zoom Call 2026-03-27** — Went well. Post-call: 7-day observation window.
13. **SWOT Analysis completed** — 6 weaknesses identified, all 6 fixed.
14. **15 Flavors** — 3 new niches added (dorm-design, mortgage-broker, personal-trainer). scoutQueries on all 15.
15. **Multi-Region Deploy** — asia-southeast1 added. Global HTTPS LB at 34.54.146.69.
16. **v5 Data Refinery ACTIVATED** — `tiger_refine.ts` real Gemini extraction.
17. **Autonomous Mining Cron** — `miningQueue` + `miningWorker` + `market_miner.ts`. Fires 2 AM UTC daily.
18. **Webhook Rate Limiting** — 60 req/min per tenant, 20/min per IP email.
19. **Reliability Hardening** — All CRITICAL + HIGH findings fixed (PRs #67). 11 findings total.
20. **BYOB Pivot SHIPPED** — Pool code removed. Wizard 4 steps. Telegram BYOB with real-time `getMe` validation.
21. **Admin Pool Utilities** — `GET /admin/pool/tokens`, `POST /admin/pool/retire-batch`.
22. **Website Content Audit** — All CTAs route through `tigerclaw.io/#pricing`. AI provider list correct.
23. **Gemini Rate Limit Hardening** — `geminiGateway.ts`: semaphore + exponential backoff. PR #71.
24. **Stan Store → Zapier Bridge** — `POST /webhooks/stan-store` with HMAC auth. PR #76. Root cause: Stan Store uses proprietary managed Stripe account — direct Stripe webhooks impossible.
25. **ScoutQueries Tightened** — All 14 flavors now use `subreddit:NAME` operator to prevent junk facts. PR #73.
26. **Mine Quality Audit** — Spec at `specs/MINE_QUALITY_AUDIT.md`. 7,872 facts, 65% quality, 55% actionable. PR #72.
27. **Purchase-Based Auth (PR #79)** — Magic link flow REMOVED. New flow:
    - Stan Store receipt → `wizard.tigerclaw.io` → enter purchase email
    - `POST /auth/verify-purchase` — checks `pending_setup` subscription within 72h → returns signed HMAC session token
    - `POST /wizard/hatch` → calls `activateSubscription(botId)` → subscription goes `active`
    - `wizard.tigerclaw.io` landing page updated with email input + verify button
    - `StepIdentity` simplified — no more internal `/wizard/auth` call

---

## 3. SWOT Weakness Fix Status (ALL RESOLVED)

| # | Weakness | Status | PR |
|---|---|---|---|
| 1 | No rate limiting on webhooks | ✅ Fixed | #49 |
| 2 | Magic links unsigned | ✅ Fixed | #50 |
| 3 | Birdie cron not running | ✅ Fixed | Mine now runs in Cloud Run |
| 4 | 3 missing flavor niches | ✅ Fixed | #51 |
| 5 | Thin data volume / Refinery undeployed | ✅ Fixed | #52, #56, #57 |
| 6 | Single-region (us-central1 only) | ✅ Fixed | #53 |

---

## 4. Open PRs (Pending Review/Merge)

| PR | Branch | Description | CI |
|----|--------|-------------|-----|
| #70 | `feat/gemini-circuit-breaker` | Phase 5 #13/#14 — Gemini circuit breaker + unit economics | ⚠️ CI has not re-run against latest commits — rerun before merging |
| #74 | `feat/relevance-gate` | Phase 6 — Ruthless Relevance Gate for Data Refinery | ✅ Green |
| #75 | `feat/stanstore` | Stan Store audit + email fix + circuit_breaker tests | ⚠️ Touches ai.ts — review for conflicts with main before merging |
| #46 | `feat/support` | Email support agent + session wrap docs | ✅ Green (old) |

---

## 5. Multi-Region Architecture

| Component | Detail |
|---|---|
| Primary region | `us-central1` |
| Secondary region | `asia-southeast1` (Singapore) — for Thai customers |
| Load Balancer IP | `34.54.146.69` (Anycast) |
| DNS | `api.tigerclaw.io A → 34.54.146.69` (Porkbun) |
| SSL cert | `tiger-claw-lb-cert` — managed, ACTIVE |
| VPC | `tiger-claw-vpc` — BGP routing GLOBAL |
| CI variable | `MULTI_REGION_READY=true` — deploys both regions on every merge to main |

---

## 6. Memory Architecture (V4.1 — Fully Shipped)

`buildSystemPrompt()` is **async**. On every request it injects four live signals:
- **Operator profile** — from `onboard_state` in `tenant_states`
- **Network intelligence** — top 3 `hive_signals` rows for this tenant's vertical/region
- **Pipeline stats** — live lead counts from `tenant_leads`
- **Fact anchors** — extracted business facts from `tenant_states.fact_anchors`

All loaded in `Promise.all()` — DB unreachable = static prompt, no crash.

---

## 7. v5 Data Refinery (Fully Autonomous)

**Pipeline:** BullMQ `miningWorker` (2 AM UTC) → `market_miner.ts` → Reddit JSON API (subreddit-scoped queries) → `POST /mining/refine` → Gemini 2.0 Flash extraction → `market_intelligence` table (120-day decay)

**First run results (2026-03-27):** 313 facts, 14 flavors, 7 Reddit rate-limit misses (handled gracefully).
**Mine Quality Audit (2026-03-29):** 7,872 facts total, 65% quality, 55% actionable. Root cause of junk: off-topic subreddits — fixed by subreddit-scoped scoutQueries in PR #73.

---

## 8. Product

| Product | Price |
|---|---|
| Tiger-Claw Pro (Telegram + LINE) | $197/mo |
| Industry Agent (custom flavor) | $197/mo |

**15 Customer-Facing Flavors:** network-marketer, real-estate, health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger, researcher, interior-designer, dorm-design, mortgage-broker, personal-trainer.

Doctor removed — healthcare compliance risk. Do not re-add it.

**Supported AI providers:** Google Gemini, OpenAI, Grok, OpenRouter, Kimi. Anthropic is NOT wired — Phase 6.

---

## 9. Tenant Roster (Active)

| Slug | Email | Status | Notes |
|---|---|---|---|
| `debbie-cameron` | justagreatdirector@outlook.com | live | Founding member |
| `john-thailand` | vijohn@hotmail.com | live | Founding member — John + Noon (Thailand) |
| `chana-loha` | chana.loh@gmail.com | live | Founding member — Chana |
| `phaitoon` | phaitoon2010@gmail.com | live | Founding member — Toon (Thailand) |

Cron heartbeat confirms 11 total active tenants. Phase 4 activation (John/Noon/Toon/Debbie) is in progress by Brent.

**7 past customers** (paid, never received service) — preserved for complimentary re-activation outreach. Phase 6 task #17.

---

## 10. BYOB Architecture (Live — Phase 3 Complete)

**Wizard flow (post-PR #79):**
1. Customer buys on Stan Store → receipt email: "Set up your agent at wizard.tigerclaw.io"
2. Customer goes to wizard, enters purchase email → `POST /auth/verify-purchase`
3. Backend checks for `pending_setup` subscription within 72 hours → returns signed session token
4. Wizard opens with email + botId pre-loaded → customer picks niche, configures AI keys
5. Hatch → `activateSubscription(botId)` → bot goes live

**Pool tokens (61 available):** Brent's personal fleet. Retrieve via:
```
GET https://api.tigerclaw.io/admin/pool/tokens?limit=N
Authorization: Bearer <ADMIN_TOKEN>
```

---

## 11. Stan Store Integration (Live — PR #76 + #79)

**Root cause confirmed:** Stan Store uses a proprietary managed Stripe account. Direct Stripe webhooks are impossible.

**Current architecture:**
- **Zapier bridge:** Stan Store "New Customer" → Zapier → `POST /webhooks/stan-store` — creates user + `pending_setup` subscription
- **Stan receipt email:** Rich text editor configured to send customer to `wizard.tigerclaw.io`
- **Auth:** Customer enters purchase email → `POST /auth/verify-purchase` → session token → wizard

**Zapier secret:** `ZAPIER_WEBHOOK_SECRET` — set in GCP Secret Manager + Cloud Run (both regions).

---

## 12. Gemini Rate Limit Hardening (Phase 5 #15 — PR #71)

**`api/src/services/geminiGateway.ts`** — standalone module:
- **Semaphore:** caps concurrent Gemini calls at `GEMINI_CONCURRENCY` (default: 10)
- **Exponential backoff:** retries 429/quota errors up to 3 times (~1s → ~2s → ~4s + jitter)
- All 10 Gemini call sites hardened

---

## 13. Infrastructure

### Cloud
| Service | Detail |
|---|---|
| API | `https://api.tigerclaw.io` — Cloud Run multi-region behind Global HTTPS LB |
| DB | Cloud SQL PostgreSQL HA `tiger_claw_shared` |
| GCP Project | `hybrid-matrix-472500-k5` |
| Wizard | `wizard.tigerclaw.io` — Next.js, Vercel, `web-onboarding/` |
| Website | `tigerclaw.io` — static, `tiger-bot-website/` submodule |
| Email outbound | Resend — `hello@tigerclaw.io`, `support@tigerclaw.io` |
| Email inbound | Postmark — `support@tigerclaw.io` → `/webhooks/email` |

### Local Mac Cluster
| Machine | IP | Role |
|---|---|---|
| Cheese Grater | 192.168.0.2 | Primary dev — offline Reflexion Loop tool + backup mine at 3 AM |
| Birdie | 192.168.0.136 | Standby |
| Monica | 192.168.0.138 | Compute node (standby) |

**Mac cluster is an OFFLINE ops tool.** Never called by Cloud Run.

---

## 14. Key Secrets (GCP Secret Manager — never commit)

| Secret | Notes |
|---|---|
| `ADMIN_TOKEN` | `b1cb78d33181c705ec838cdfec06912922808a423ebabad056c39450ae84e69e` |
| `MAGIC_LINK_SECRET` | Also used as fallback for `WIZARD_SESSION_SECRET` — verify mounted in Cloud Run |
| `WIZARD_SESSION_SECRET` | Optional — falls back to `MAGIC_LINK_SECRET`. Signs purchase verify tokens. |
| `ZAPIER_WEBHOOK_SECRET` | `ce892f417c6d219ba4ab223d774530f9f63dbaab39a68732e9fb459f1c75415f` — Zapier → stan-store auth |
| `ENCRYPTION_KEY` | AES-256-GCM key for bot token encryption |
| `RESEND_API_KEY` | Outbound email |
| `STRIPE_SECRET_KEY` | Stan Store webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature |
| `TELEGRAM_WEBHOOK_SECRET` | Inbound webhook auth |
| `POSTMARK_WEBHOOK_TOKEN` | Inbound email auth |
| `GEMINI_CONCURRENCY` | Optional — defaults to 10. Set higher for wave demand. |

---

## 15. What's Next — MORNING PRIORITY

### 🔥 FIRE TEST — FIRST THING (Brent + Claude)

**This is the #1 task when Brent wakes up.**

Two purchases on Stan Store:
1. Tiger-Claw Pro (Telegram + LINE)
2. Industry Agent

Then go to `wizard.tigerclaw.io`, enter purchase email `bbryson@me.com`, verify purchase, complete wizard, confirm live bot.

**What to watch:**
- `POST /auth/verify-purchase` returns `{ ok: true, sessionToken, botId }`
- Wizard opens with email + botId pre-loaded
- Hatch completes → subscription goes `active`
- Bot is live on Telegram

**If verify-purchase returns 404:** The Stan Store webhook (Zapier or Stan receipt) didn't create the `pending_setup` subscription. Check Cloud Run logs for `[stan-store-webhook]` entries.

---

## 16. Known Issues

| Priority | Issue | Status |
|---|---|---|
| 🔴 HIGH | Fire test not yet done — end-to-end purchase → wizard → live bot | DO FIRST THING MORNING |
| 🟡 MED | PR #70 CI hasn't run against latest commits — may be stale | Rerun CI before merging |
| 🟡 MED | PR #75 touches ai.ts — review for conflicts before merging | Review before merging |
| 🟡 MED | `DATABASE_READ_URL` pinned to secret version 8 (should be latest) | NOT FIXED |
| 🟡 LOW | Reddit scout returns 0 results (403 without OAuth) | NOT FIXED — needs TigerClaw-branded Reddit app |

---

## 17. Reliability Audit Findings Tracker

Full report: `specs/RELIABILITY_AUDIT.md`

All 11 findings fixed (PR #67). ✅

---

*Last updated: 2026-03-29 ~02:00 local (Brent sleeping). PRs #69–#79 merged and live. Purchase-based auth shipped. Fire test is first priority on wake-up. 396 tests passing.*
