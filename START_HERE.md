# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-03-30 (Monday morning — post all-nighter session 2)
**Author:** Pebo + Claude Code

---

## What Is Tiger Claw?

AI sales agent SaaS. Customers buy on Stan Store, walk through a 5-step wizard to configure their bot + AI key + customer profile, hit "Hatch," and get a live AI sales agent. Built on Cloud Run, PostgreSQL, Redis/BullMQ, Gemini/OpenAI.

- **API:** Cloud Run (us-central1), project `hybrid-matrix-472500-k5`
- **Wizard Frontend:** Next.js on Vercel at `wizard.tigerclaw.io`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **Architecture:** BYOB (customer's Telegram token) + BYOK (customer's AI key)
- **DB password:** `TigerClaw2026Secure` (from Secret Manager: `tiger-claw-database-url`)
- **Cloud SQL proxy port:** 5433 (proxy user: `botcraft`, DB: `tiger_claw_shared`)

---

## Current State: READY TO FIRE TEST

Everything is merged and deployed. The wizard is live at `wizard.tigerclaw.io`.

### All Merged PRs (complete history)

| PR  | What It Did | Status |
|-----|-------------|--------|
| #93 | secrets.ts EISDIR crash fix | MERGED |
| #94 | BYOK key observability | MERGED |
| #95 | activateSubscription() loud failure | MERGED |
| #96 | Pre-flight validation on /hatch | MERGED |
| #97 | userId fix in provisioning queue | MERGED |
| #98 | Clear stale wizard state after hatch | MERGED |
| #99 | verify-purchase creates records on-demand | MERGED |
| #100 | StepCustomerProfile ICP step (4 fields) | MERGED |
| #101 | Network-marketer prospect section | MERGED |
| #102 | Bot skips onboarding when wizard ICP present | MERGED |
| #103 | LINE webhook registration in provisioner | MERGED |
| #104 | LINE-only validation (superseded by #105) | MERGED |
| #105 | LINE-only bots + full wizard readability overhaul | MERGED |

### Open PRs
None. Everything is on main.

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

## Database State (as of 2026-03-30 morning)

| Tenant | Name | Status | Telegram | LINE | AI Key |
|--------|------|--------|----------|------|--------|
| `71018251...` | heylookbrentisgolfing | onboarding | ✅ | ❌ | ✅ openai/gpt-4o-mini |
| `8803b9f4...` | bbryson | pending | ❌ | ✅ token+secret saved | ❌ |

**No customer tenants exist yet.** Fire test has not been completed with a real customer.

## Known Issues (Post-Session)

| Issue | Severity | Notes |
|-------|----------|-------|
| Admin bot token expired | HIGH | `sendAdminAlert()` returns 401 — all provisioning alerts silently failing. Token: `8451751033:AAEN...`. Fix: get new token from BotFather, update env var in Cloud Run. |
| `bbryson` tenant stuck at `pending` | LOW | LINE creds saved but provisioner never ran. Test record — ignore or re-hatch. |
| `bot_ai_keys` dead write | LOW | Wizard writes here, runtime never reads. Cleanup after fire test. |
| LINE-only bot untested end-to-end | MEDIUM | Provisioner supports it, wizard supports it. Never fire-tested. |
| ~25 dead BotFather bots | LOW | Need manual /deletebot cleanup |

---

## Fire Test Checklist

```
[ ] Go to wizard.tigerclaw.io
[ ] Walk through all 5 steps with a fresh Telegram token + Gemini key + ICP filled in
[ ] Hit Hatch — watch Cloud Run logs for provisioning success
      NOTE: sendAdminAlert() is broken (401) — you will NOT get a Telegram ping.
      Instead: query DB — if status = 'onboarding', provisioner succeeded.
[ ] Send first message on Telegram
[ ] Gate: bot sends confident intro (NOT onboarding questions)
[ ] Celebrate
[ ] Fix admin bot token (BotFather → new token → Cloud Run env var)
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
