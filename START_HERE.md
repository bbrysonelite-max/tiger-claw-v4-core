# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-04-01 (Session 3 — broken windows sweep)
**Author:** Claude Sonnet 4.6

---

## What Is Tiger Claw?

AI sales agent SaaS. Customers buy on Stan Store, walk through a 5-step wizard to configure their bot + AI key + customer profile, hit "Hatch," and get a live AI sales agent. Built on Cloud Run, PostgreSQL, Redis/BullMQ, Gemini/OpenAI.

- **API:** Cloud Run (us-central1), project `hybrid-matrix-472500-k5`
- **Wizard Frontend:** Next.js on Vercel at `wizard.tigerclaw.io`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **Architecture:** BYOB (customer's Telegram token) + BYOK (customer's AI key)
- **DB password:** `TigerClaw2026Secure` (from Secret Manager: `tiger-claw-database-url`)
- **Cloud SQL instance:** `tiger-claw-postgres-ha` (proxy port **5433** locally — NOT 5432, DB: `tiger_claw_shared`, user: `botcraft`)

---

## Current State: ALL PHASES COMPLETE — FIRST BOT LIVE ✅

Captain Tiger Two (`bbryson-mne8ffim`) confirmed live on Telegram at 1:35 AM 2026-03-31.

### Merged PRs — Session 3 (2026-04-01)

| PR | What It Did | Status |
|----|-------------|--------|
| #117 + commits | feat: admin dashboard at `/admin`, Grok key health fix, SOUL.md integration, Postiz tool | MERGED |
| fix (in #117) | fix: remove `node-fetch` phantom imports — CI Test green | MERGED |

### Merged PRs — Session 2 (2026-03-31)

| PR | What It Did | Status |
|----|-------------|--------|
| direct commit | fix: bot greeting CTA — "I'm ready — let me hunt" | MERGED |
| #116 | fix: Grok model `grok-2-1212` → `grok-4-1-fast-non-reasoning` | MERGED |
| #115 | fix: `buildSystemPrompt` fallback to `customerProfile` when `icpSingle` missing | MERGED |
| #114 | fix: wizard ICP fast-path — write `icpSingle` + `botName` at hatch and first message | MERGED |
| #113 | fix: dashboard display — AI engine label + Telegram dual-state contradiction | MERGED |
| #112 | feat: intent bridge — market intelligence → `buildSystemPrompt()` | MERGED |
| #111 | fix: 3 critical fire test bugs | MERGED |

### Merged PRs — Session 1 (2026-03-31 early)

| PR | What It Did | Status |
|----|-------------|--------|
| #110 | fix: wizard UX friction pass + multi-agent auth | MERGED |
| #109 | feat: admin bot + heartbeat monitor | MERGED |
| #107 | fix: LINE-only provisioning (`preferredChannel` defaulted to `"telegram"`) | MERGED |

### Open PRs (triage in progress this session)

| PR | Title | Priority |
|----|-------|----------|
| #90 | Real API validation for Grok/OpenRouter keys | Pre-customer critical |
| #75 | Stan Store Integration Audit | Pre-customer critical |
| #74 | Ruthless Relevance Gate for Data Refinery | Data quality |
| #78 | Mine Quality Hardening | Data quality |
| #77 | Mine Quality Audit | Report |
| #46 | Email support agent | Likely stale |

---

## Bugs Found During Fire Test (3/30 Evening)

### BUG 1: Provisioner Name — FIXED by Gemini (deploying)
`provisioner.ts` UPDATE query was missing `name` in SET clause. Bot showed email prefix "bbryson" instead of wizard-entered name. Gemini added `name = $1` to the UPDATE.

### BUG 2: ICP Fast-Path — FIXED by Gemini (deploying)
The ICP data pipeline (wizard → hatch → `onboard_state.json`) was correctly wired, BUT `ai.ts` conversation handler didn't check for pre-loaded `customerProfile` before starting the onboarding interview. Bot said "glitch in the system" and asked ICP questions manually. Gemini added `checkWizardIcpFastPath` to both `processTelegramMessage` and `processLINEMessage`.

### BUG 3: Email Prefix as Name — Resolved by Bug 1 fix
`auth.ts` uses `email.split("@")[0]` as a placeholder name at purchase time. This is correct behavior — the provisioner now overwrites it with the wizard-provided name at hatch time.

---

## Bugs Previously Fixed (3/30 Earlier)

| Bug | Fix | Revision |
|-----|-----|----------|
| bot_pool spam alerts every 30s | Removed legacy pool check + POOL_ALERT from index.ts | 00170 |
| JSON parse errors from Gemini | `sanitizeGeminiJSON()` in geminiGateway.ts | 00168 (PR #108) |
| "No pending subscription" blocker | Multi-agent auth in auth.ts + SQL reset | 00172 (PR #110) |
| Wizard contrast/readability | All text-white opacity classes bumped | 00172 (PR #110) |
| "Total Due Today" scare copy | Changed to "Your Plan" + green "Paid via Stan Store" | 00172 (PR #110) |
| "AI Computations" jargon | Changed to "AI Provider" | 00172 (PR #110) |
| One-email-one-bot lock | Multi-agent branch in auth.ts | 00172 (PR #110) |

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
4. Writes ICP to `onboard_state.json` in **PostgreSQL** `tenant_states` table, **including `icpSingle` and `botName`** (critical — see ICP fix history below)
5. Enqueues BullMQ provisioning job
6. Worker: updates tenant (including name), registers Telegram webhook (if token), registers LINE webhook (if creds), sets status → onboarding

## First Message Behavior
- **Wizard-hatched bots (ICP in onboard_state.json):** Sends confident intro referencing the customer's ICP data, skips onboarding interview entirely
- **No ICP:** Runs calibration interview as before

---

## UX Issues Still Open (Noted During Fire Test)

| Issue | Priority | Notes |
|-------|----------|-------|
| Clicking "dashboard/admin" link loses wizard state, can't go back | MEDIUM | Navigation recovery needed |
| "Connected" text on AI provider line should be green | LOW | Visual confirmation |

---

## Database State (as of 2026-04-01)

| Tenant | Name | Status | Channel | AI Key |
|--------|------|--------|---------|--------|
| `484dbe39...` | bbryson-mne8ffim (Captain Tiger Two) | onboarding | Telegram ✅ | Grok xai-...VBOH ✅ **LIVE** |
| `71018251...` | heylookbrentisgolfing | onboarding | Telegram ✅ | openai/gpt-4o-mini ✅ |
| `8803b9f4...` | bbryson | pending | LINE ✅ | ❌ no key |

**No paying customer tenants yet.**

---

## Fire Test Result: ✅ PASSED (2026-03-31 1:35 AM)

Captain Tiger Two (`bbryson-mne8ffim`) responded on Telegram with correct ICP-aware greeting. No onboarding questions. Name correct. Grok key live.

**Next milestone:** Activate first paying customer from waiting list.

---

## Active Deals

| Deal | Contact | Status | Terms |
|------|---------|--------|-------|
| White Label | Max Steingart | Negotiating | 30% affiliate commission via Stan Store. Max must sell 10 before Pebo builds. |
| LINE Distribution | John (Bryson International Group) | Active | 21,000 LINE distributors in Thailand. John is Pebo's own downline. |
| Demo | Jeff Mack | Tonight 8 PM | Extremely non-technical. Uses Telegram. Paying Stan Store customer. |

---

## Critical Files

| File | What It Does |
|------|-------------|
| `api/src/routes/wizard.ts` | POST /wizard/hatch, POST /wizard/validate-key |
| `api/src/routes/auth.ts` | POST /auth/verify-purchase (multi-agent support) |
| `api/src/services/provisioner.ts` | Telegram + LINE webhook registration, name update |
| `api/src/services/ai.ts` | ICP fast-path bypass, processTelegramMessage, processLINEMessage |
| `api/src/services/db.ts` | activateSubscription(), createBYOK* |
| `api/src/services/queue.ts` | provisionWorker, telegramWorker, lineWorker |
| `web-onboarding/src/components/OnboardingModal.tsx` | WizardState, 5-step orchestration |
| `web-onboarding/src/components/wizard/StepCustomerProfile.tsx` | ICP collection |
| `web-onboarding/src/components/wizard/StepReviewPayment.tsx` | Hatch trigger |

---

## Rules of Engagement

1. **One PR per fix.** No chaining.
2. **Never push directly to main.** Always `feat/` branches + `gh pr create`.
3. **Stop if something breaks.** Don't stack fixes on a broken deploy.
4. **No new features.** Reduce friction, provision agents, sell. That's it.
5. **The mission:** Paying customers get a live bot that works.
