# Tiger Claw — State of the Union

**Last updated:** 2026-04-03 (Session 6 — COMPLETE)
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

## Current Tenant Fleet (as of 2026-04-03 end of session)

| Slug | Status | Bot | Notes |
|---|---|---|---|
| `brent-bryson-mnjd321r` | onboarding | @Testtigerfour_bot "Teddy" | Brent's test bot — onboarding in progress |
| `john-69cd9564` | onboarding | @BGJN8_bot | John — reset fresh, subscription pending_setup, webhook live. Send `wizard.tigerclaw.io/signup` |
| `jeff-mack-69cd955d` | pending | Unassigned | Jeff Mack — paid, send `wizard.tigerclaw.io/signup` |
| `justagreatdirector-mne9xtna` | pending | Unassigned | Debbie — paid, send `wizard.tigerclaw.io/signup` |

`john-mnic5pc1` — **TERMINATED** (duplicate created when John re-signed up; shared same bot token as john-69cd9564, causing webhook conflicts). All test bots and Toon bots deprovisioned. Fleet is clean.

---

## What Happened on April 3, 2026 (Session 6)

### Earlier in session (bugs from April 2 fixed)
**Six bugs fixed and deployed (PRs #145–#148):**
- `fix-all-webhooks` was silently processing 0 tenants (wrong JOIN for BYOB arch) — fixed
- Telegram token validation had no timeout — 8s AbortController added
- LINE setup had no warning about Official Account requirement — warning added
- Provisioning suspension fired no admin alert — Telegram alert now fires immediately on failure
- Admin dashboard showed blank on API errors — error now displayed, auto-refresh every 30s added
- "Fix Webhooks" button added to admin dashboard

**SOTU.md created.** Phase 1 spec written and approved (`specs/PHASE_1_SIGNUP.md`).

### Later in session — Dashboard and Landing Page Polish (PRs #166–#167)

| PR | Description |
|---|---|
| #166 | Remove LINE channel card and Channel Config quick action from customer dashboard |
| #167 | Refresh root landing page — email redirects to `/signup`, tighten copy, remove old 5-step wizard modal |

- `wizard.tigerclaw.io` root page now dead-ends to `/signup` — old `OnboardingModal` is fully retired
- Customer dashboard: Telegram + WhatsApp only. No LINE, no "Founding Member", no Channel Config link.
- `?email=` pre-fill on signup page was already built — Stan Store just needs to append it to the receipt link

### Phase 1 Signup — Built, Deployed, and Proven (PRs #156–#165)

The 5-step wizard is replaced by a single-page signup at `wizard.tigerclaw.io/signup`.

**Flow:** Stan Store purchase → email gate → form (name, flavor, bot token, Gemini key, ICP) → Launch → Telegram bot wakes up.

**PRs merged:**
| PR | Description |
|---|---|
| #156 | Phase 1 signup page — single-page flow |
| #157 | Fix 4 CI test failures (ai, admin, dashboard, provisioner) |
| #158–#163 | Fix verify-purchase endpoint, payload fields, hatch response, botToken field, aiKey inline, HatchResponse type |
| #164 | Remove X/Twitter announcement; add "Your agent will be live in 60 seconds." tagline |
| #165 | Fix TELEGRAM_WEBHOOK_SECRET trim — trailing newline caused permanent secret mismatch |

**Post-deploy:** `/admin/fix-all-webhooks` called — all 12 tenants re-registered with trimmed secret.

**End-to-end test PASSED:** `@Testtigerfour_bot` ("Teddy Tiger Claw") provisioned via the new signup page. Bot responded in Telegram: *"Good to be seen. This is going to be great."*

**Stan Store link updated:** `wizard.tigerclaw.io` → `wizard.tigerclaw.io/signup` (Brent updated in Stan Store admin).

### Session 6 — End of Day (2026-04-03)

**All PRs merged and deployed. Fleet clean. Platform ready.**

| Item | Status |
|---|---|
| PR #171 — Remove 3-per-day cap from tiger_briefing | ✅ Merged + deployed |
| PR #172 — Fix admin test mock | ✅ Merged |
| PR #173 — Soft ICP fallback at hatch | ✅ Merged + deployed |
| Mine purge — 11,170 bad pre-gate facts removed | ✅ Done |
| "60 Seconds" → "2 Minutes" across wizard frontend | ✅ Live on wizard.tigerclaw.io |
| "Enterprise V4.0" navbar label removed | ✅ Live |
| setWebhook on onboarding→active confirmed already built | ✅ No action needed |
| Reflexion Loop + Agent Leaderboard captured as future vision | ✅ In SOTU |
| Vercel auto-deploy broken — manual command documented | ⚠️ Known issue |

**Fleet (end of session):**
- `brent-bryson-mnjd321r` (Teddy) — onboarding, webhook live
- `john-69cd9564` — onboarding, pending_setup, webhook live

**Next session priorities:**
1. Get Debbie, Jeff, John through wizard — self-serve proof
2. Watch mine quality as it refills nightly
3. Fix Vercel auto-deploy root directory in project settings
4. Sprint 2: email webhook sender validation (low urgency)

### Session 6 — Later (2026-04-03 afternoon)

| PR / Action | Description |
|---|---|
| PR #171 | Remove 3-per-day cap language from tiger_briefing — was telling operator "need 3 more to hit daily minimum" |
| PR #172 | Fix admin test — add pool mock to reset-conversation (CI green) |
| PR #173 | Soft ICP fallback at hatch — empty idealPerson auto-populates from FLAVOR_DEFAULT_ICP, 12 flavors covered |
| DB action | Purged 11,170 pre-gate contaminated facts from market_intelligence. 1,345 clean post-gate facts remain. Mine refills nightly. |
| Copy | "60 Seconds" → "2 Minutes" across wizard frontend (layout, landing page, signup page) |
| Copy | Removed "Enterprise V4.0" navbar label from wizard |
| John cleanup | Terminated duplicate john-mnic5pc1 (same bot token as john-69cd9564). john-69cd9564 reset to onboarding + pending_setup subscription. Webhook live. |

### Session 6 Wrap — Reliability sprint confirmed complete, John fully cleaned up

**Reliability Sprint 1 — all 4 items were already deployed before context compaction.** Audit verified against live code; every fix confirmed in place:
- Stripe Redis fails closed (503) ✅
- `resumeTenant()` checks `tgData.ok` + fires admin alert ✅  
- Telegram enqueue failure fires admin alert ✅
- LINE webhook catch fires admin alert ✅
- Cron heartbeat includes 'onboarding' ✅

**John duplicate bot cleanup:**
- PR #170 deploy confirmed live (uptime 105s after deploy)
- `reset-conversation` run on `john-69cd9564` — both Redis and PostgreSQL onboard_state cleared (`onboard_state_cleared: true`)
- `john-mnic5pc1` created this morning (John re-signed up with same bot token) — TERMINATED to eliminate webhook conflict
- `john-69cd9564` status → `onboarding`, subscription → `pending_setup` — ready for wizard
- fix-all-webhooks run — both active bots clean (2 processed, 2 fixed)
- Root cause documented: same-token duplicate is detectable when fix-all-webhooks returns "Too Many Requests" on second registration

**Send John:** `wizard.tigerclaw.io/signup` with email `vijohn@hotmail.com`

### Later in session — Fleet cleanup, John reset, reliability sprint (PRs #168–#170)

| PR | Description |
|---|---|
| #168 | Allow manual report trigger for onboarding tenants (not just active) |
| #169 | Daily scout waterfall — never idle, never report failure. Rate-limited? Fall through to search → mine → cold outreach. Never mention empty pipeline. |
| #170 | reset-conversation now clears PostgreSQL onboard_state too, not just Redis |

**Fleet cleanup:**
- Deprovisioned 4 dead test bots in Brent's name (tokens deleted from BotFather)
- Deprovisioned all 3 Phaitoon/Toon bots — no debris from beta
- Brent deleted 22 bot tokens from BotFather, kept only Teddy

**John reset:**
- `john-69cd9564` was deprovisioned by accident, immediately restored via suspend→resume
- Full reset run: Redis chat history + onboard_state cleared
- John starts fresh — bot will greet him day-one when he messages it
- Send John: `wizard.tigerclaw.io/dashboard?slug=john-69cd9564`

**Morning report confirmed working:**
- Triggered manually via `/admin/fleet/:tenantId/report`
- Bot pushed proactively to Telegram (not a reply — unprompted)
- Rate-limited on first run (no leads yet) — waterfall fix (#169) addresses this
- Real test: 7 AM UTC tomorrow after Teddy completes onboarding

**Stan Store cleanup:**
- Both products updated to `wizard.tigerclaw.io/signup`
- `?email=` pre-fill already built in signup page — Stan Store just needs to append it
- Lemon Squeezy migration in progress (Brent)

### Key learnings
- `TELEGRAM_WEBHOOK_SECRET` in GCP Secret Manager may have a trailing newline. After any deploy, always call `/admin/fix-all-webhooks` to re-register webhooks with the current (trimmed) secret. This is now standard post-deploy protocol.
- The trim fix (#165) ensures the comparison always works going forward.
- `reset-conversation` previously only cleared Redis — useless for bots whose state lives in PostgreSQL. Now clears both.

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
| 1 | **Entry point email** — Does Stan Store actually send customers a link after purchase? What URL is in that email? | ✅ Resolved — Stan Store link updated to `wizard.tigerclaw.io/signup`. Flow confirmed live. |
| 2 | **Pending customers** — Jeff Mack, Debbie are in `pending` status and have paid. They need to be sent through the signup page. | 🔴 Active — send them `wizard.tigerclaw.io/signup` |
| 3 | **Mine validation** — 10,833 facts in production but never spot-checked for quality. | ⏳ Deferred |
| 4 | **Morning report never seen by a real customer** — Built and deployed, but no real customer has completed onboarding and seen a report. | ⏳ Deferred |
| 5 | **Price and positioning** — $97/$147 Stan Store vs. Founding 50 at $50/month are unreconciled. | ⏳ Deferred |

---

## Future Vision (Do Not Build Yet — Capture Only)

These ideas emerged from live use. They are NOT on the roadmap yet. They go here so they are never lost.

### Reflexion Loop — Agents That Learn
Each agent accumulates outcome data: which approaches closed leads, which got ghosted, which objection handlers worked. That data feeds back into `fact_anchors` (per-agent) and `hive_signals` (fleet-wide). The agent wakes up each morning slightly smarter than yesterday.

**What's already there:** `fact_anchors`, `hive_signals`, `tiger_convert`, lead scoring history, morning report.  
**What's missing:** The feedback loop closing — outcome signals flowing back into the agent's behavior.  
**When to build:** After 10+ agents have hatched and generated real outcome data to learn from.

### Agent Leaderboard — The Competition
Opt-in, privacy-respecting leaderboard across the fleet. Operators see how their agent ranks on leads surfaced, pipeline activity, conversion rate, scout velocity. For a downline of 21,000 distributors — imagine the motivation. The leaderboard and the Reflexion Loop are connected: the best-performing agents teach the fleet.

**What's already there:** All the underlying data exists per-tenant.  
**When to build:** After Reflexion Loop is live and there are enough agents to make rankings meaningful.

**Do not mention either of these publicly until they are built.**

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
| Jeff Mack + Debbie — paid, `pending`, never onboarded — send `wizard.tigerclaw.io/signup` | High — Brent doing outreach |
| ~~Self-serve single-page signup~~ | ✅ DONE — `wizard.tigerclaw.io/signup` live and tested 2026-04-03 |
| ~~Old 5-step wizard (OnboardingModal)~~ | ✅ RETIRED — root page redirects to `/signup` |
| ~~LINE + Channel Config on customer dashboard~~ | ✅ REMOVED — dashboard shows Telegram + WhatsApp only |
| Stan Store receipt email — append `?email={{customer_email}}` to link | Quick — Brent does in Stan Store admin. Code already reads it. |
| **Vercel auto-deploy from GitHub is broken** — project root dir is misconfigured (doubling `web-onboarding/web-onboarding`). Until fixed, deploy wizard manually: `VERCEL_PROJECT_ID=prj_7Y7IZeI6uCmhX95QF0AVC0wRnsFY VERCEL_ORG_ID=team_sknWq0TNjp6Fe4g7j5cgb4Mf vercel deploy --prod` from repo root. Fix: update Root Directory in Vercel project settings to empty. | Ops — fix when convenient |
| **Always call `/admin/fix-all-webhooks` after every API deploy** — TELEGRAM_WEBHOOK_SECRET mismatch will kill all bots silently | Ops discipline — add to checklist |
| ~~**RELIABILITY SPRINT Sprint 1** — all 4 items DONE~~ | ✅ COMPLETE |
| ~~Stripe Redis idempotency fails open~~ | ✅ Fixed |
| ~~`resumeTenant()` doesn't check setWebhook success~~ | ✅ Fixed |
| ~~Telegram enqueue failure not alerted~~ | ✅ Fixed |
| ~~LINE webhook errors swallowed~~ | ✅ Fixed |
| ~~Add 'onboarding' to cron status filter~~ | ✅ Fixed |
| ~~ICP validation blocks hatch with empty profile~~ | ✅ Fixed — soft fallback auto-populates from flavor defaults (PR #173, pending merge) |
| ~~3-per-day cap language in tiger_briefing output~~ | ✅ Fixed — removed from bot output (PR #171) |
| ~~Pre-gate mine contamination~~ | ✅ Fixed — 11,170 bad facts purged, 1,345 clean post-gate facts remain |
| ~~admin test reset-conversation missing mock~~ | ✅ Fixed — CI green (PR #172) |
| setWebhook not re-called on onboarding→active transition | Medium (Sprint 2) |
| Email webhook processes any sender, not just tenants | Medium (Sprint 2) |
| **Same-token duplicate bots** — if a customer re-signs up with same email + same bot token, two records share one Telegram token. Fix: terminate the duplicate. Detection: fix-all-webhooks returns "Too Many Requests" on second registration. | Ops awareness |
| Wizard frontend navbar "Enterprise V4.0" label removed | ✅ Done |
| "60 Seconds" → "2 Minutes" across wizard frontend | ✅ Done |
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

# ⚠️  MANDATORY after every API deploy — re-registers all webhooks with correct secret
# Without this, TELEGRAM_WEBHOOK_SECRET mismatch will silently kill all bots
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
