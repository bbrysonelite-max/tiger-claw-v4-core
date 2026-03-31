# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-03-31
**Author:** Claude Sonnet 4.6

---

## What Is Tiger Claw?

AI sales agent SaaS. Customers buy on Stan Store, walk through a 5-step wizard to configure their bot + AI key + customer profile, hit "Hatch," and get a live AI sales agent. Built on Cloud Run, PostgreSQL, Redis/BullMQ, Gemini/OpenAI.

- **API:** Cloud Run (us-central1), project `hybrid-matrix-472500-k5`
- **Wizard Frontend:** Next.js on Vercel at `wizard.tigerclaw.io`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **Architecture:** BYOB (customer's Telegram token) + BYOK (customer's AI key)
- **DB password:** `TigerClaw2026Secure` (from Secret Manager: `tiger-claw-database-url`)
- **Cloud SQL proxy port:** 5432 (proxy user: `botcraft`, DB: `tiger_claw_shared`)

---

## Current State: READY FOR FIRST REAL CUSTOMER

Everything is merged and deployed. Intent bridge is live. The bot is smarter than it was yesterday.

### All Merged PRs (this session — 2026-03-31)

| PR  | What It Did | Status |
|-----|-------------|--------|
| #107| fix: LINE-only provisioning — preferredChannel inference bug | MERGED |
| #109| fix: Zapier bridge cleanup — remove unused import | MERGED |
| #110| fix: wizard UX friction pass — contrast, copy, multi-agent support | MERGED |
| #111| fix: 3 critical fire test bugs (name update, ICP fast-path, email placeholder) | MERGED |
| #112| feat: intent bridge — market intelligence → bot system prompt | MERGED |

### Open PRs
| PR  | Title | Notes |
|-----|-------|-------|
| #90 | Real API validation for Grok/OpenRouter keys | Needs triage |
| #78 | Mine Quality Hardening & Reliability Audit | Needs triage |
| #77 | Mine Quality Audit (Task #18) | Needs triage |
| #75 | Stan Store Integration Audit | Needs triage |
| #74 | Ruthless Relevance Gate for Data Refinery | Needs triage |
| #46 | Email support agent + session wrap docs | Needs triage — may be stale |

---

## Wizard Flow (Current — 5 Steps)

1. **StepIdentity** — niche, bot name, your name, email
2. **StepChannelSetup** — Telegram (optional) + LINE (optional, needs access token + secret). At least one required.
3. **StepAIConnection** — BYOK key install + validation (Gemini free tier available)
4. **StepCustomerProfile** — ICP: who/problem/not-working/where. Network marketers also get prospect section.
5. **StepReviewPayment** — order summary + "Hatch" button

---

## What Happens at Hatch

1. `POST /wizard/hatch` validates botId, subscription, AI key
2. Activates subscription (`pending_setup` → `active`)
3. Saves LINE credentials encrypted to tenant record (if provided)
4. Writes ICP to `onboard_state.json` in Redis
5. Enqueues BullMQ provisioning job
6. Worker: updates tenant, registers Telegram webhook (if token), registers LINE webhook (if creds, non-fatal), sets status → onboarding

## First Message Behavior

- **Wizard-hatched bots (ICP in onboard_state.json):** Sends confident intro, skips `tiger_onboard()` entirely
- **No ICP:** Runs calibration interview as before

---

## Intent Bridge (NEW — PR #112)

`market_intelligence` table → `buildSystemPrompt()`. Every bot message now includes up to 5 fresh mined facts for that tenant's vertical.

- **10,833 facts** in prod as of 2026-03-31
- **Confidence threshold:** 70/100 minimum
- **Freshness window:** 7 days
- **Domain key:** flavor `displayName` (e.g. `"Real Estate Agent"`), NOT the flavor key (`"real-estate"`)
- **Files:** `api/src/services/market_intel.ts` → `getMarketIntelligence()`, `api/src/services/ai.ts` → `formatMarketIntelligence()`

---

## Database State (as of 2026-03-31)

| Tenant | Name | Status | Telegram | LINE | AI Key |
|--------|------|--------|----------|------|--------|
| `71018251...` | heylookbrentisgolfing | onboarding | ✅ | ❌ | ✅ openai/gpt-4o-mini |
| `8803b9f4...` | bbryson | pending | ❌ | ✅ token+secret saved | ❌ |

**No customer tenants exist yet.**

---

## Fire Test Checklist

```
[ ] Go to wizard.tigerclaw.io
[ ] Walk through all 5 steps with a fresh Telegram token + Gemini key + ICP filled in
[ ] Hit Hatch — watch Cloud Run logs for provisioning success
      NOTE: Admin Alerts are ACTIVE. You will get a Telegram ping from @AlienProbeadmin_bot.
[ ] Send first message on Telegram
[ ] Gate: bot sends confident intro (NOT onboarding questions)
[ ] Gate: bot weaves in a market fact naturally when relevant
[ ] Celebrate
[ ] Pick first real customer from the waiting list
```

---

## Critical Files

| File | What It Does |
|------|-------------|
| `api/src/routes/wizard.ts` | POST /wizard/hatch, POST /wizard/validate-key |
| `api/src/routes/auth.ts` | POST /auth/verify-purchase (on-demand record creation) |
| `api/src/routes/webhooks.ts` | POST /webhooks/stan-store (Zapier bridge) |
| `api/src/services/provisioner.ts` | Telegram + LINE webhook registration |
| `api/src/services/ai.ts` | ICP first-message bypass, processTelegramMessage, processLINEMessage, buildSystemPrompt |
| `api/src/services/market_intel.ts` | getMarketIntelligence() — intent bridge query layer |
| `api/src/services/db.ts` | activateSubscription(), createBYOK* |
| `api/src/services/queue.ts` | provisionWorker, telegramWorker, lineWorker |
| `web-onboarding/src/components/OnboardingModal.tsx` | WizardState, 5-step orchestration |

---

## Rules of Engagement

1. **One PR per fix.** No chaining.
2. **Never push directly to main.** Always `feat/` branches + `gh pr create`.
3. **Stop if something breaks.** Don't stack fixes on a broken deploy.
4. **Always test against prod DB** before merging data-layer changes. The CI Postgres infra bug (`role "root"`) is pre-existing and not your code — but verify SQL against the real schema.
5. **The mission:** Paying customers get a live bot that works. That's it.
