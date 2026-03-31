# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-03-31 (Session 2)
**Author:** Claude Sonnet 4.6

---

## What Is Tiger Claw?

AI sales agent SaaS. Customers buy on Stan Store, walk through a 5-step wizard to configure their bot + AI key + customer profile, hit "Hatch," and get a live AI sales agent. Built on Cloud Run, PostgreSQL, BullMQ, Gemini/OpenAI/Grok/OpenRouter.

- **API:** Cloud Run (us-central1), project `hybrid-matrix-472500-k5`
- **Wizard Frontend:** Next.js on Vercel at `wizard.tigerclaw.io`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **Architecture:** BYOB (customer's Telegram token) + BYOK (customer's AI key)
- **DB password:** `TigerClaw2026Secure` (Secret Manager: `tiger-claw-database-url`)
- **Cloud SQL instance:** `tiger-claw-postgres-ha` (use proxy port 5433 locally — NOT 5432)
- **State storage:** PostgreSQL per-tenant schemas (`t_{tenantId}.bot_states`) — NOT Redis

---

## Current State: FIRST BOT CONFIRMED LIVE ✅

Captain Tiger Two (`bbryson-mne8ffim`) responded successfully on Telegram at 1:35 AM 2026-03-31. Fire test passed for real. First real customer is the next step.

### All Merged PRs (this session — 2026-03-31 Session 2)

| PR | What It Did | Status |
|----|-------------|--------|
| direct commit | fix: bot greeting CTA — "I'm ready — let me hunt" | MERGED to main |
| #113 | fix: dashboard display — AI engine label mashup + Telegram dual-state contradiction | MERGED |
| #114 | fix: wizard ICP fast-path — write `icpSingle` + `botName` at hatch and first message | MERGED |
| #115 | fix: `buildSystemPrompt` fallback to `customerProfile` when `icpSingle` missing (covers existing bots) | MERGED |
| #116 | fix: Grok model `grok-2-1212` → `grok-4-1-fast-non-reasoning` (xAI dropped old model) | MERGED |

### Open PRs (needs triage)
| PR | Title | Notes |
|----|-------|-------|
| #90 | Real API validation for Grok/OpenRouter keys | May be superseded by key health monitor |
| #78 | Mine Quality Hardening & Reliability Audit | Needs review |
| #77 | Mine Quality Audit (Task #18) | Needs review |
| #75 | Stan Store Integration Audit | Needs review |
| #74 | Ruthless Relevance Gate for Data Refinery | Needs review |
| #46 | Email support agent + session wrap docs | Likely stale |

---

## Wizard Flow (Current — 5 Steps)

1. **StepIdentity** — niche, bot name, your name, email
2. **StepChannelSetup** — Telegram (optional) + LINE (optional). At least one required.
3. **StepAIConnection** — BYOK key install + validation (Gemini free tier available)
4. **StepCustomerProfile** — ICP: who/problem/not-working/where. Network marketers also get prospect section.
5. **StepReviewPayment** — order summary + "Hatch" button

---

## What Happens at Hatch

1. `POST /wizard/hatch` validates botId, subscription, AI key
2. Activates subscription (`pending_setup` → `active`)
3. Saves LINE credentials encrypted to tenant record (if provided)
4. Writes ICP to `onboard_state.json` **including `icpSingle` and `botName`** (critical — see ICP bug history below)
5. Enqueues BullMQ provisioning job
6. Worker: updates tenant, registers Telegram + LINE webhooks, sets status → onboarding

## First Message Behavior

- **Wizard-hatched bots:** Sends confident intro ("I'm ready — let me hunt"), skips `tiger_onboard()` entirely
- **No ICP:** Runs calibration interview as before

---

## ICP Fast-Path — How It Works (Bug History)

This was a two-part bug fixed in PRs #114 and #115.

**Root cause:** Wizard writes `customerProfile` to `onboard_state.json`. `buildSystemPrompt` reads `icpSingle.idealPerson`. These never matched. Bot saw `hasOnboarding=true` but empty ICP block → LLM re-ran onboarding on every message.

**Fix 1 (PR #114):** Hatch now writes `icpSingle` (translated from `customerProfile`) + `botName`. Fast-path also writes `icpSingle` when marking `phase=complete`.

**Fix 2 (PR #115):** `buildSystemPrompt` falls back to `customerProfile` when `icpSingle` is missing. Covers bots hatched before #114 with no state repair needed.

**Key field mapping:**
| Wizard writes (`customerProfile`) | `buildSystemPrompt` reads (`icpSingle`) |
|---|---|
| `idealCustomer` | `idealPerson` |
| `problem` | `problemFaced` |
| `notWorking` | `currentApproachFailing` |
| `whereToFind` | `onlinePlatforms` |

---

## Grok / xAI Key Handling

- **Old model (dead):** `grok-2-1212` — xAI no longer serves this model
- **Current model:** `grok-4-1-fast-non-reasoning`
- **Key prefix:** `xai-...` — detected as `provider=grok`, routed through OpenAI SDK with `baseURL: https://api.x.ai/v1`
- **Health monitor bug (known):** Cron passes SDK-level provider `openai` to `validateAIKey`, which hits `api.openai.com` with an xAI key → false `key_health=dead`. Does not block message delivery.

---

## Intent Bridge

`market_intelligence` table → `buildSystemPrompt()`. Every bot message includes up to 5 fresh mined facts for the tenant's vertical.

- **Confidence threshold:** 70/100 minimum
- **Freshness window:** 7 days
- **Domain key:** flavor `displayName` (e.g. `"Real Estate Agent"`), NOT the flavor key (`"real-estate"`)
- **Files:** `api/src/services/market_intel.ts` → `getMarketIntelligence()`, `api/src/services/ai.ts` → `formatMarketIntelligence()`

---

## Database State (as of 2026-03-31 Session 2)

| Tenant | Name | Status | Channel | AI Key |
|--------|------|--------|---------|--------|
| `484dbe39...` | bbryson-mne8ffim (Captain Tiger Two) | onboarding | Telegram ✅ | Grok xai-...VBOH ✅ LIVE |
| `71018251...` | heylookbrentisgolfing | onboarding | Telegram ✅ | openai/gpt-4o-mini ✅ |
| `8803b9f4...` | bbryson | pending | LINE ✅ | ❌ |

**No paying customer tenants yet.**

---

## Infrastructure Notes

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1), latest revision `tiger-claw-api-00186-jq7` |
| Cloud SQL instance | `tiger-claw-postgres-ha` (NOT `tiger-claw-db`) |
| Cloud SQL proxy | **port 5433** locally (5432 is used by local Postgres on some machines) |
| DB user | `botcraft`, DB `tiger_claw_shared` |
| Bot state | PostgreSQL per-tenant schema `t_{tenantId}.bot_states` |
| Wizard | Next.js on Vercel at `wizard.tigerclaw.io` |
| GitHub | `bbrysonelite-max/tiger-claw-v4-core` |
| Deploys | Auto via GHA on merge to main |

---

## Critical Files

| File | What It Does |
|------|-------------|
| `api/src/routes/wizard.ts` | POST /wizard/hatch — writes icpSingle + botName to onboard_state |
| `api/src/routes/auth.ts` | POST /auth/verify-purchase (on-demand record creation) |
| `api/src/routes/webhooks.ts` | POST /webhooks/stan-store (Zapier bridge) |
| `api/src/routes/dashboard.ts` | GET /dashboard/:slug — customer dashboard data |
| `api/src/services/provisioner.ts` | Telegram + LINE webhook registration |
| `api/src/services/ai.ts` | buildSystemPrompt, checkWizardIcpFastPath, processTelegramMessage, processLINEMessage, resolveAIProvider |
| `api/src/services/market_intel.ts` | getMarketIntelligence() — intent bridge query layer |
| `api/src/services/db.ts` | getBotState/setBotState (Postgres), activateSubscription, createBYOK* |
| `api/src/services/queue.ts` | provisionWorker, telegramWorker, lineWorker, cron heartbeat, key health monitor |
| `api/src/services/pool.ts` | encryptToken / decryptToken (AES-256-GCM) |
| `web-onboarding/src/app/dashboard/page.tsx` | Customer dashboard UI |
| `web-onboarding/src/components/wizard/StepAIConnection.tsx` | BYOK key install + provider config |

---

## Rules of Engagement

1. **One PR per fix.** No chaining.
2. **Never push directly to main** unless user explicitly instructs it.
3. **Stop if something breaks.** Don't stack fixes on a broken deploy.
4. **Always test against prod DB** before merging data-layer changes. CI Postgres (`role "root"`) is pre-existing broken — use Cloud SQL proxy.
5. **The mission:** Paying customers get a live bot that works. That's it.
