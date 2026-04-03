# Tiger Claw — State of the Union

**Last updated:** 2026-04-03 (Session 6 — bug fixes, SOTU created, Phase 1 spec written)
**Read this first. Read nothing else until you have finished this file.**

---

## What This Product Is

Tiger Claw is an AI sales agent SaaS. A customer pays, walks through a setup wizard, and gets a live AI bot on Telegram (or LINE) that prospects for them — finding leads, nurturing them, and moving them toward a sale — automatically, around the clock.

The operator is a network marketer, real estate agent, or similar. Their bot does the outreach. The operator reviews leads and closes deals.

**The value proposition in one sentence:** Your bot hunts while you sleep.

---

## What the Product Actually Does (The Bot's Job)

When a prospect messages the bot:
1. The bot reads the message and pulls context: operator's ICP, live market intelligence, lead history, hive patterns from similar operators
2. Gemini (AI) runs a tool loop — it can search the web, score leads, log contacts, draft follow-ups, send nurture messages, and more
3. The bot responds in the operator's brand voice, moves the prospect forward, or flags them as a hot lead
4. The operator gets a morning report at 7 AM UTC with what the bot found overnight

This runs statelessly. No containers per tenant. One Cloud Run process handles all tenants.

---

## Architecture (Locked — Do Not Redesign)

```
Stan Store payment
    → Zapier webhook
    → POST /webhooks/stan-store
    → BullMQ tenant-provisioning queue
    → Provisioner: create tenant, register Telegram webhook, status → onboarding

Telegram message
    → POST /webhooks/telegram/:tenantId
    → BullMQ telegram-webhooks queue
    → processTelegramMessage()
    → buildSystemPrompt() [async, 4 signals]
    → Gemini function-calling loop (runToolLoop)
    → Reply to operator/prospect
```

| Layer | Technology | Notes |
|---|---|---|
| Compute | Google Cloud Run | Node.js/Express, port 4000, `tiger-claw-api` service |
| Database | Cloud SQL PostgreSQL | `tiger_claw_shared`, proxy port **5433** locally (NOT 5432) |
| Cache / Queues | Cloud Redis + BullMQ | 8 queues |
| AI | Gemini 2.0 Flash | `@google/generative-ai` SDK — **LOCKED. Do not change to 2.5-flash** (GCP function-calling bug) |
| Frontend (wizard) | Next.js, `web-onboarding/` | Deployed to Cloud Run at `wizard.tigerclaw.io` |
| Frontend (website) | Static HTML | `tigerclaw.io`, separate repo |
| Payments | Stan Store | Stan Store → Zapier → `/webhooks/stan-store` (requires `X-Zapier-Secret` header) |
| Email | Resend | Provisioning receipts |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Repo | `github.com/bbrysonelite-max/tiger-claw-v4-core` | |

**Multi-region:** `us-central1` (primary) + `asia-southeast1`. Global HTTPS load balancer at `api.tigerclaw.io` (IP: `34.54.146.69`).

---

## Access

| Resource | Value |
|---|---|
| API (prod) | `https://api.tigerclaw.io` |
| Wizard | `https://wizard.tigerclaw.io` |
| Admin dashboard | `https://wizard.tigerclaw.io/admin/dashboard` |
| Admin token | `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"` |
| GCP project | `hybrid-matrix-472500-k5` |
| DB (local proxy) | port `5433`, user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure` |

Admin token is stored in localStorage after first login — no re-entry needed.

---

## Business Model

- **BYOB:** Customer provides their own Telegram bot token from @BotFather
- **BYOK:** Customer provides their own AI key (Gemini, OpenAI, Grok, OpenRouter)
- **Payment:** Stan Store ($97 base / $147 Pro). Currently needs to be replaced with Lemon Squeezy or Paddle for international VAT compliance.
- **Founding 50 program:** $50/month, first 50 customers. Not yet launched.

---

## The Bot's Brain (26 Tools)

All tools live in `api/src/tools/`. Each uses `ToolContext` (`ToolContext.ts`). All must be registered in `toolsMap` in `ai.ts` — missing registration causes an infinite tool loop.

| Tool | What It Does |
|---|---|
| `tiger_scout` | Web search for prospects matching ICP |
| `tiger_lead` | Log a prospect as a lead |
| `tiger_score` / `tiger_score_1to10` | Score lead quality |
| `tiger_nurture` | Schedule / send follow-up messages |
| `tiger_onboard` | Walk operator through ICP interview (skipped if ICP already loaded) |
| `tiger_contact` | Manage contact records |
| `tiger_note` | Add notes to contacts |
| `tiger_convert` | Mark a lead as converted |
| `tiger_move` | Move lead through pipeline stages |
| `tiger_search` | General web search |
| `tiger_briefing` | Pull operator briefing/context |
| `tiger_objection` | Handle prospect objections |
| `tiger_settings` | Read/write tenant settings |
| `tiger_keys` | Manage AI key fallback chain |
| `tiger_hive` | Read hive signals from similar operators |
| `tiger_import` / `tiger_export` | Bulk lead import/export |
| `tiger_email` | Send email to prospects |
| `tiger_aftercare` | Post-close follow-up |
| `tiger_refine` | Refine prospect targeting |
| `tiger_strike_draft` | Draft outreach messages |
| `tiger_postiz` | Social media posting |
| `tiger_google_workspace` | Google Workspace integration |

**Critical:** Only `{ output }` from tool results is passed to Gemini. Raw data fields (reasons, counts, internal state) are stripped in `runToolLoop`. This prevents the bot from narrating its own limitations.

---

## Memory Architecture

### Redis (hot, per-conversation)
| Key | Purpose | TTL |
|---|---|---|
| `chat_history:{tenantId}:{chatId}` | Raw turn history | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Compressed summaries (Sawtooth) | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending | 24 hours |

### PostgreSQL (`tenant_states` table)
| `state_key` | Purpose |
|---|---|
| `onboard_state` | ICP data — written at hatch from wizard, read by `buildSystemPrompt` |
| `fact_anchors` | Business facts extracted from live conversations |

### `buildSystemPrompt()` — 4 Live Signals
Async. Loads in `Promise.all()`. DB failure = graceful degradation, never crashes delivery.
1. ICP: reads `icpSingle` from `onboard_state`, falls back to `customerProfile`
2. Hive patterns: top signals from `hive_signals` for tenant's flavor/region
3. Lead stats: live counts from `tenant_leads`
4. Market intelligence: up to 5 facts from `market_intelligence` (confidence ≥ 70, within 7 days). Domain key = flavor **displayName** (e.g. `"Real Estate Agent"`), NOT flavor key (e.g. `"real-estate"`)

### Sawtooth Compression
Fires on two triggers: history length > `MAX_HISTORY_TURNS * 2`, or tool call count ≥ 12. Uses `PLATFORM_ONBOARDING_KEY`, not tenant's key.

---

## AI Key Fallback Chain (4 Layers)

Tenants never go dark immediately on billing failure.

| Layer | Source | Limit |
|---|---|---|
| 1 | Platform Onboarding Key | 50 msg/day |
| 2 | Tenant Primary BYOK | Unlimited |
| 3 | Tenant Fallback BYOK | Unlimited |
| 4 | Platform Emergency Keep-Alive | 5 msg, pauses after 24h |

---

## Provisioning Flow

1. `POST /wizard/hatch` — validates botId, subscription, AI key
2. Activates subscription (`pending_setup` → `active`)
3. Writes `customerProfile` to `onboard_state` (ICP pre-load, skips interview)
4. Enqueues `tenant-provisioning` BullMQ job
5. Provisioner: updates tenant record, registers Telegram webhook with `TELEGRAM_WEBHOOK_SECRET`, rebrands bot profile (`setMyName`, `setMyDescription`), registers LINE webhook if provided
6. Status → `onboarding`
7. First inbound message → ICP fast-path check → confident intro (no interview if ICP loaded)

**If provisioning fails:** tenant is set to `suspended`, `sendAdminAlert` fires a Telegram message to the operator immediately with the reason and the action to take. Check `/admin/dashboard`.

---

## Multi-Agent Architecture

One email can own multiple bots. Each Stan Store purchase creates a fresh `bot_id` + tenant + subscription. `auth.ts` `/verify-purchase` creates a new bot if existing bot's subscription is not `pending_setup`. Session token carries `bot_id` through all 5 wizard steps.

---

## Wizard Flow (5 Steps, `web-onboarding/`)

1. **StepIdentity** — niche, bot name, operator name, email
2. **StepChannelSetup** — Telegram (BYOB token, 8s validation timeout) and/or LINE (requires Official Account, not personal)
3. **StepAIConnection** — BYOK key + validation
4. **StepCustomerProfile** — ICP: ideal customer, problems they have, platforms they're on
5. **StepReviewPayment** — "Hatch"

---

## Current Tenant Fleet (as of 2026-04-03)

| Email | Slug | Status | Channel |
|---|---|---|---|
| `vijohn@hotmail.com` | `john-mnic5pc1` | onboarding | telegram |
| `vijohn@hotmail.com` | `john-69cd9564` | **active** | telegram |
| `bbryson@me.com` | `bbryson-mnhl9y5z` | onboarding | telegram |
| `bbryson@me.com` | `brent-bryson-mni9u75z` | pending | telegram |
| `jeffmackte@gmail.com` | `jeff-mack-69cd955d` | pending | telegram |
| `justagreatdirector@outlook.com` | `justagreatdirector-mne9xtna` | pending | telegram |
| `phaitoon2010@gmail.com` | `phaitoon2010-mnflobh4` | onboarding | telegram |
| `phaitoon2010@gmail.com` | `phaitoon2010-mnf0nh7y` | onboarding | telegram |
| `phaitoon2010@gmail.com` | `phaitoon2010-mne9vd0y` | onboarding | telegram |

**Paying customers with live bots:** John (`john-69cd9564`, active). All others are pending or in onboarding without a completed wizard.

All 9 tenants are `network-marketer` flavor. No other flavors have been used by real customers yet.

---

## What Happened on April 3, 2026 (Session 6)

**Six bugs from the April 2 failure fixed and deployed (PRs #145–#148):**
- `fix-all-webhooks` was silently processing 0 tenants (wrong JOIN for BYOB arch) — fixed
- Telegram token validation had no timeout — 8s AbortController added
- LINE setup had no warning about Official Account requirement — warning added
- Provisioning suspension fired no admin alert — Telegram alert now fires immediately on failure
- Admin dashboard showed blank on API errors — error now displayed, auto-refresh every 30s added
- "Fix Webhooks" button added to admin dashboard — no more curl commands on live calls

**Post-deploy:** `fix-all-webhooks` run against prod — all 4 active/onboarding Telegram tenants re-registered with secret token.

**SOTU.md created** — this document. Replaces START_HERE.md, STATE_OF_THE_TIGER_PATH_FORWARD.md, and session state in CLAUDE.md as the single source of truth.

**dramatic-failure.md committed to repo** — April 2 post-mortem is part of the permanent record.

**Phase 1 spec written and approved** — `specs/PHASE_1_SIGNUP.md`. Single-page self-serve signup. Ready to build.

---

## What Happened on April 2, 2026 (Read This)

A paying customer (John, Thailand) was on a live Zoom call for onboarding. The call failed completely. Six bugs combined:

1. Webhook was re-registered without `TELEGRAM_WEBHOOK_SECRET` — every message returned `401 Unauthorized`, silently
2. Telegram token validation had no timeout — infinite spinner in the wizard
3. Tenant got suspended automatically with no alert to the operator
4. Admin dashboard showed blank data on API errors (silent failure)
5. Wrong domain (`app.tigerclaw.io` instead of `wizard.tigerclaw.io`) was shared with the customer
6. LINE section gave no warning that a personal LINE account cannot connect to the API

**All six bugs were fixed on 2026-04-03 (PRs #145–#148, deployed).** Fix Webhooks was run post-deploy; all active tenant webhooks now carry the secret.

The platform works. The delivery failed. The bones are solid.

---

## The One Unresolved Problem

No customer has ever successfully onboarded without the founder present.

The wizard requires 2–3 hours of live support per customer. Until a customer can go from payment to bot talking, alone, the business does not scale. The next major milestone is a self-serve onboarding path that works without Brent in the room.

This is not a coding problem yet. It is the next decision to make.

---

## Pre-Launch Concerns (Address in Order)

These were identified 2026-04-03 before building Phase 1. Address one at a time. Do not build past concern #1 until it is resolved.

| # | Concern | Status |
|---|---|---|
| 1 | **Entry point email** — Does Stan Store actually send customers a link after purchase? What URL is in that email? If the link goes to the old wizard or doesn't exist, the new signup page is invisible. **Test: buy a $1 agent on Stan Store and see what arrives.** | 🔴 Active — testing now |
| 2 | **Pending customers** — Jeff Mack, Debbie, Spain customer are in `pending` status and have paid. They need to be onboarded before more time passes or they request refunds. | ⏳ Deferred until #1 resolved |
| 3 | **Mine validation** — 10,833 facts in production but never spot-checked for quality. The mine is a key differentiator. Before telling customers it exists, verify that 20-30 facts are actually useful. | ⏳ Deferred |
| 4 | **Morning report never seen by a real customer** — Built and deployed in Session 5, but every tenant is a test account or incomplete onboard. Brent should receive a real morning report from his own bot before customers are told to expect one. | ⏳ Deferred |
| 5 | **Price and positioning** — $97/$147 Stan Store vs. Founding 50 at $50/month are unreconciled. The signup page copy must match what's being sold. Decide before the page goes live. | ⏳ Deferred |

---

## Engineering Constraints (Non-Negotiable)

- `main` is branch-protected. Always create a `feat/` or `fix/` branch and use `gh pr create`. Never push directly to main.
- Never use `--no-verify` or `--force-push` to main without explicit instruction.
- **No Docker containers per tenant.** No OpenClaw. No Mini-RAG. These are permanently gone.
- **Gemini 2.0 Flash only.** 2.5-flash has a function-calling bug on GCP. Do not change this.
- The Mac cluster at `192.168.0.2` (Cheese Grater) is an offline Reflexion Loop tool. Cloud Run never calls it.
- `buildSystemPrompt()` is async. Always `await` it.
- All DB/Redis calls in hot paths must have `try/catch` with graceful degradation. A DB outage must never crash message delivery.
- New tools in `api/src/tools/` MUST be registered in `toolsMap` in `ai.ts`. Missing = infinite tool loop.
- Market intelligence domain key is flavor **displayName**, not flavor key.
- `node-fetch` is not in `package.json`. Use native `fetch` (Node 18+).
- Cloud SQL proxy runs on **port 5433** locally, not 5432.
- One PR per fix. No chaining unrelated changes.
- Test before opening a PR. Do not open PRs for code that has not been verified.

---

## Known Open Issues

| Item | Priority |
|---|---|
| `bot_ai_keys` dead write — wizard writes here, runtime reads `bot_ai_config` | Low |
| Stan Store needs replacing with Lemon Squeezy or Paddle (international VAT) | High (before next international customer) |
| Past customers owed bots: `chana.loh@gmail.com`, `nancylimsk@gmail.com`, `lily.vergara@gmail.com` — paid, never onboarded | High |
| **Self-serve single-page signup** | **Phase 1 — spec complete, ready to build. See `specs/PHASE_1_SIGNUP.md`** |
| Customer-facing dashboard | Phase 2 |
| LINE channel support | Phase 2 or 3 — deliberately deferred. Code exists, do not delete. LINE requires a LINE Official Account (business registration at developers.line.biz) — customers must bring a Channel Access Token and Channel Secret. Personal LINE accounts cannot connect to the API. Add back via customer dashboard when there is demonstrated demand. |
| Multi-provider AI keys in signup (OpenAI, Grok, OpenRouter) | Phase 2 via customer dashboard — Gemini only in Phase 1 |

---

## Reference: Deploy Commands

```bash
# Deploy API to Cloud Run
GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh

# Deploy frontend (wizard + admin dashboard)
GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-frontend.sh

# Re-register all tenant webhooks with secret (run after any API deploy)
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
# Or: use the "Fix Webhooks" button on wizard.tigerclaw.io/admin/dashboard
```

---

---

## MANDATORY: Session Protocol for Every Agent

**Before you write a single line of code, read this entire file.**

This is not optional. This is the entry point. No other document takes precedence.

**At the end of every session, you must update this file.** A session is not complete until SOTU.md reflects the new state of the project. Specifically, update:

1. **Last updated** date at the top
2. **Current Tenant Fleet** — pull live data from `GET /admin/fleet` and replace the table
3. **Known Open Issues** — mark resolved items done, add any new issues discovered
4. **What Happened** section — add a brief entry for the session: what was built, what PRs were merged, what was deployed
5. Any **architecture changes**, new tools registered, or constraint additions

If a session ends without updating SOTU.md, the next agent starts blind. That is the failure mode this document exists to prevent.

**This document is the single source of truth. If it conflicts with any other document, this one is correct. All other session docs (START_HERE.md, STATE_OF_THE_TIGER_PATH_FORWARD.md) are superseded by this file.**
