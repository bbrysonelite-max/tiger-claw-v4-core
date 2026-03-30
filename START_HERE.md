# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-03-30 (Monday afternoon — RESTORATION COMPLETE)
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

## Current State: READY TO FIRE TEST

Everything is merged and deployed. The wizard is live at `wizard.tigerclaw.io`.

### All Merged PRs (complete history)

| PR  | What It Did | Status |
|-----|-------------|--------|
| #106| fix: LINE-only provisioning | MERGED |
| #107| feat: preferredChannel type fix | MERGED |
| #108| fix: sanitize Gemini JSON escape sequences | MERGED |
| #109| feat: restore admin bot + heartbeat monitor | MERGED |

### Open PRs
- `feat: add /webhooks/stan-store Zapier bridge for auto-provisioning` (Ready for Review)

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

## Database State (as of 2026-03-30)

| Tenant | Name | Status | Telegram | LINE | AI Key |
|--------|------|--------|----------|------|--------|
| `71018251...` | heylookbrentisgolfing | onboarding | ✅ | ❌ | ✅ openai/gpt-4o-mini |
| `8803b9f4...` | bbryson | pending | ❌ | ✅ token+secret saved | ❌ |

**No customer tenants exist yet.** Fire test has not been completed with a real customer.

## Status Updates (Post-Restoration)

| Item | Status | Notes |
|-------|----------|-------|
| Admin bot token | **FIXED** | New token `@AlienProbeadmin_bot` active. Responds to `/status`. |
| Heartbeat Monitor | **ACTIVE** | Health monitor checks admin bot status every 30s. |
| JSON Parse Errors | **FIXED** | Gemini response sanitization added (PR #108). |
| LINE fire test | **PASSED** | Webhooks confirmed working in Cloud Run logs. |
| ~25 dead BotFather bots | LOW | Need manual /deletebot cleanup |

---

## Fire Test Checklist

```
[ ] Go to wizard.tigerclaw.io
[ ] Walk through all 5 steps with a fresh Telegram token + Gemini key + ICP filled in
[ ] Hit Hatch — watch Cloud Run logs for provisioning success
      NOTE: Admin Alerts are now ACTIVE. You will get a Telegram ping from @AlienProbeadmin_bot.
[ ] Send first message on Telegram
[ ] Gate: bot sends confident intro (NOT onboarding questions)
[ ] Celebrate
[ ] Pick first real customer from the waiting list
```

---

## Critical Files

| File | What It Does |
|------|-------------|
| `api/src/routes/wizard.ts` | POST /wizard/hatch, POST /wizard/validate-key |
| `api/src/routes/auth.ts` | POST /auth/verify-purchase (on-demand record creation) |
| `api/src/services/provisioner.ts` | Telegram + LINE webhook registration |
| `api/src/services/ai.ts` | ICP first-message bypass, processTelegramMessage, processLINEMessage |
| `api/src/services/db.ts` | activateSubscription(), createBYOK* |
| `api/src/services/queue.ts` | provisionWorker, telegramWorker, lineWorker |
| `web-onboarding/src/components/OnboardingModal.tsx` | WizardState, 5-step orchestration |
| `web-onboarding/src/components/wizard/StepChannelSetup.tsx` | Channel validation (Telegram OR LINE) |
| `web-onboarding/src/components/wizard/StepCustomerProfile.tsx` | ICP collection |

---

## Rules of Engagement

1. **One PR per fix.** No chaining.
2. **Never push directly to main.** Always `feat/` branches + `gh pr create`.
3. **Stop if something breaks.** Don't stack fixes on a broken deploy.
4. **The mission:** Paying customers get a live bot that works. That's it.
