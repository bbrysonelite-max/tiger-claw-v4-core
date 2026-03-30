# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-03-30 (Monday — we pulled an all-nighter)
**Author:** Pebo + Claude Code

---

## What Is Tiger Claw?

AI sales agent SaaS. Customers buy on Stan Store, walk through a 5-step wizard to configure their bot + AI key + customer profile, hit "Hatch," and get a live AI sales agent. Built on Cloud Run, PostgreSQL, Redis/BullMQ, Gemini/OpenAI.

- **API:** Cloud Run (us-central1), project `hybrid-matrix-472500-k5`
- **Wizard Frontend:** Next.js on Vercel at `wizard.tigerclaw.io`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **Architecture:** BYOB (customer's Telegram token) + BYOK (customer's AI key)
- **DB password:** `TigerClaw2026Secure` (from Secret Manager: `tiger-claw-database-url`)
- **Cloud SQL proxy port:** 5433 (proxy user: `botcraft`)

---

## Where We Are Right Now

### Phases 1–5a COMPLETE. Fire test is the next gate.

| PR  | What It Fixed | Status |
|-----|---------------|--------|
| #93 | secrets.ts EISDIR crash (container crash-loop) | MERGED |
| #94 | BYOK key observability — logs where keys resolve from | MERGED |
| #95 | activateSubscription() fails loudly | MERGED |
| #96 | Pre-flight validation on /hatch | MERGED |
| #97 | userId in provisioning queue (was tenant UUID, now user UUID) | MERGED |
| #98 | Clear stale wizard frontend state after hatch | MERGED |
| #99 | verify-purchase creates records on-demand (no webhook required) | MERGED |
| #100 | StepCustomerProfile wizard step (ICP collection, 4 fields) | MERGED |
| #101 | Network-marketer prospect section in StepCustomerProfile | MERGED |
| #102 | Bot skips onboarding interview when wizard ICP is present | **OPEN — needs merge** |
| #103 | LINE webhook registration in provisioner + UI collects both LINE creds | **OPEN — needs merge** |

---

## Database State (as of 2026-03-30)

Only 2 tenants exist:

| Tenant ID | Name | Status | Telegram | LINE | AI Key |
|-----------|------|--------|----------|------|--------|
| `71018251...` | heylookbrentisgolfing | onboarding | ✅ | ❌ | ✅ openai/gpt-4o-mini |
| `8803b9f4...` | bbryson | pending | ❌ | ❌ | ❌ |

Tenant `2ca971d3-c6c6-4ab9-aa55-d1b2d327ee5a` **does not exist** in the database (confirmed 2026-03-30).

---

## Wizard Flow (Current — 5 Steps)

1. **StepIdentity** — niche, bot name, your name, email
2. **StepChannelSetup** — Telegram bot token (required) + LINE credentials (optional: access token + channel secret)
3. **StepAIConnection** — BYOK key entry + validation
4. **StepCustomerProfile** — ICP fields (who/problem/not-working/where); network-marketer also gets prospect section
5. **StepReviewPayment** — order summary + "Hatch" button

---

## What Happens at Hatch

1. `POST /wizard/hatch` — validates botId, subscription, AI key
2. Activates subscription (`pending_setup` → `active`)
3. Saves LINE credentials encrypted to tenant record (if provided)
4. Writes ICP to `onboard_state.json` in Redis
5. Enqueues provisioning job to BullMQ
6. Worker calls `provisionTenant()`:
   - Updates tenant record
   - Registers Telegram webhook (if bot token present)
   - Registers LINE webhook via LINE API (if `lineChannelAccessToken` present, non-fatal)
   - Sets status → onboarding

## First Message Behavior

- **Wizard-hatched bots (ICP present):** Skips `tiger_onboard()` entirely. Sends confident intro: *"I'm [botName], your AI sales agent powered by Tiger Claw..."*
- **Bots without ICP:** Runs `tiger_onboard()` calibration interview as before.

---

## Stan Store Purchase Flow

`Stan Store purchase → receipt email with ?email= link → wizard.tigerclaw.io?email=X → POST /auth/verify-purchase → wizard`

- If Stan Store webhook fired: finds existing record, issues session token
- If no webhook (common): **creates records on-demand** (PR #99), issues session token
- Zapier is still active but no longer required

---

## Fire Test Checklist

```
[ ] Merge PR #102 (ICP first-message bypass)
[ ] Merge PR #103 (LINE webhook registration)
[ ] Deploy to Cloud Run (auto on main merge)
[ ] Complete wizard with a fresh Telegram token + Gemini key + ICP filled in
[ ] Hit Hatch — watch Cloud Run logs
[ ] Send first message to the bot on Telegram
[ ] Gate: bot sends confident intro, NOT onboarding questions
[ ] Optional: add LINE credentials and verify LINE webhook registers
```

---

## Critical Files

| File | What It Does |
|------|-------------|
| `api/src/routes/wizard.ts` | POST /wizard/hatch, POST /wizard/validate-key |
| `api/src/routes/auth.ts` | POST /auth/verify-purchase (on-demand record creation) |
| `api/src/services/provisioner.ts` | Telegram + LINE webhook registration |
| `api/src/services/ai.ts` | processTelegramMessage(), processLINEMessage(), ICP first-message bypass |
| `api/src/services/db.ts` | activateSubscription(), createBYOK*, lookupPurchaseByEmail() |
| `api/src/services/queue.ts` | provisionWorker, telegramWorker, lineWorker |
| `web-onboarding/src/components/OnboardingModal.tsx` | WizardState, 5-step flow |
| `web-onboarding/src/components/wizard/StepCustomerProfile.tsx` | ICP collection step |

---

## Rules of Engagement

1. **One PR per fix.** No chaining. Verify after every merge.
2. **Never push directly to main.** Always `feat/` branches + `gh pr create`.
3. **Stop if something breaks.** Don't stack fixes on top of a broken deploy.
4. **The mission:** ONE clean bot hatches end-to-end. Then first real customer.
