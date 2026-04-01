# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-03-31 (Tuesday afternoon — SOUL & SOCIAL MOAT LIVE)
**Author:** Gemini CLI

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

## Current State: SOUL & SOCIAL MOAT LIVE (Phase 7)

### Timeline (2026-03-31)

| Time (MST) | Event |
|------------|-------|
| 08:00 | Morning queue: Build admin dashboard + fix Grok key bug |
| 10:30 | **Operator Command Center** built at `/admin` (PR #117) |
| 11:15 | Grok/OpenRouter "Key Dead" false-positive bug fixed |
| 14:00 | **SOUL.md** integrated: Brand mission & voice injected into every agent prompt |
| 14:20 | **Hope-Infused Intelligence** fallbacks added for dry data mines |
| 17:00 | **Postiz Integration** complete: Autonomous multi-platform broadcasting (tiger_postiz) |
| 17:15 | Martha onboarded as Intelligence Monitor |

### Staff Roster
- **Brent:** Operator / Lead Strategy
- **Gemini CLI:** Lead Engineer / Orchestrator
- **Claude (Terminal):** Batch Ops / Data Auditor
- **Martha:** Intelligence Monitor (Pipeline Health & Freshness)

### Merged PRs (complete history)

| PR | What It Did | Status |
|-----|-------------|--------|
| #117| feat: admin dashboard + grok key health fix | MERGED |
| (push)| feat: SOUL.md integration + fallback intelligence | MERGED |
| (push)| feat: Postiz integration (tiger_postiz) | MERGED |
| #110| fix: wizard UX friction pass — multi-agent support | MERGED |
| #109| feat: restore admin bot + heartbeat monitor | MERGED |

### Open PRs
- `feat: add /webhooks/stan-store Zapier bridge for auto-provisioning` (Ready for Review)

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
4. Writes ICP to `onboard_state.json` in Redis
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

## Database State (as of 2026-03-30 5:45 PM MST)

| Tenant | Slug | Status | Channel | AI Key |
|--------|------|--------|---------|--------|
| `71018251...` | heylookbrentisgolfing | onboarding | Telegram | ✅ openai/gpt-4o-mini |
| `8803b9f4...` | bbryson-mndsgv0q | onboarding | Telegram | ✅ google |
| (newest) | bbryson-mndudbum | onboarding | Telegram | ✅ google |

---

## Fire Test Checklist

```
[x] Go to wizard.tigerclaw.io
[x] Walk through all 5 steps with a fresh Telegram token + Gemini key + ICP filled in
[x] Hit Hatch — watch Cloud Run logs for provisioning success
[x] Verify provisioning job succeeds (Job 4 — bbryson-mndudbum AWAKE)
[ ] PENDING: Verify bot name shows wizard-entered name (not email prefix)
[ ] PENDING: Send first message — bot sends confident ICP-aware intro (NOT onboarding questions)
[ ] Jeff Mack demo at 8 PM
[ ] Pick first real customer from the waiting list
```

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
