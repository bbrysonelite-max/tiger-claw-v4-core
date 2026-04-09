# Tiger Claw — State of the Union

**Last updated:** 2026-04-09 (Session 17 close — PRs #263–#272 merged)
**This is the single source of truth. Read nothing else until you finish this file.**

---

## The Three Documents — Read In Order

| # | File | Purpose |
|---|------|---------|
| 1 | `SOTU.md` ← you are here | What is true right now. Platform state, what's broken, what's working. No opinion, just facts. |
| 2 | `WHAT_TIGER_CLAW_DOES.md` | What the platform is, what the agent can do, the payment flow, the sale. Product vision. |
| 3 | `HOW_TIGER_WINS.md` | Why things fail and the expert fix for each. The strategy. Read this before forming any plan. |

---

## Standing Orders

**No lying. No assuming. No guessing.**
- Do not claim anything works unless you have tested it live.
- Do not mark a session complete if known broken items remain.
- The operator is running a real business. False confidence causes real damage.
- No AI agent pushes directly to `main`. All changes via `feat/` or `fix/` branch + PR.
- After every PR: verify with `gh pr view <number>` that state is `MERGED`. After every deploy, verify health endpoint returns 200. Do not tell the operator something is done until you have proof it is done.
- **Read Cloud Run logs before diagnosing anything.** The root cause is almost always visible immediately in the logs. Do not guess.

---

## Ground Truth as of 2026-04-09

**Brents Tiger 01 (@Brentstiger01_bot) is live. Prospect engagement mode is deployed.**

- Bot provisioned, ICP pre-seeded, webhook registered.
- Bot description updated: *"Let me take you by the hand and lead you to your brighter future."* — no Tiger Claw branding visible to prospects.
- `/start` opens with 4-language covenant greeting, ends with *"What's going on for you right now?"*
- System prompt: prospect engagement mode active — warm opening, no tool names, no status reports, no internal language exposed.
- Two real prospects were messaging the bot at session close (11:40 PM PT). Results unknown — too late to verify. **Check first thing next session.**
- Operator asked 5 warm contacts to message the bot. No confirmed successful prospect conversation yet.
- Tiger Strike pipeline confirmed firing — 20 engagement links generated, admin alert received.

The full loop (pay → provision → hatch → scout → contact → reply with a real prospect) has not yet closed. That remains day zero.

---

## Current Platform State

**Last deployed revision:** `tiger-claw-api-00434-c6h` (deployed 2026-04-09, Session 17 close)
**Health (last verified 2026-04-09):** postgres OK, redis OK, workers OK
**Tests:** 462/462 passing
**Wizard:** `wizard.tigerclaw.io` — Vercel, auto-deploy confirmed working

---

## What Was Done This Session (Session 18 — 2026-04-09)

**PR #274 merged:**

1. **PR #274 — Remove bot pool (BYOB only)**
   - Deleted 5,559 lines of dead bot pool code: all `bot_pool` DB functions, all `/admin/pool/*` routes, `ops/create-bot-pool/`, `ops/botpool/`, `docs/operations/BOT-POOL-MANUAL-IMPORT.md`, `ops/admin-bot/src/commands/pool.ts`.
   - `pool.ts` is now crypto/Telegram utilities only — no pool logic.
   - `getTenantBotToken` / `getTenantBotUsername` read from `tenants` table only — bot_pool fallback removed.
   - `fixBotPoolOrphans()` startup call removed from `index.ts`.
   - CLAUDE.md and RULES.md (Rule 15) now loudly declare BYOB. No agent can miss it.
   - Root cause of OpenRouter $100 drain: missing BYOK → platform key → 429 → circuit breaker → OpenRouter. That fallback chain is dead.
   - 456/456 tests passing.

**Also this session:**
- Fleet cleaned: 8 test/orphan tenants terminated (FiretestApril5, Teddy Tiger Claw, Tigertest100, Tigertest1001, Tiger Test 102, orphan brents-tiger-01-mnpcril3, Zapier Test, FiretestagentApril6)
- Old Brents Tiger 01 (56d45bfd) terminated — had no BYOK key, was burning platform key every minute
- Tigeralldaytest (3bf45773) provisioned with valid BYOK Gemini key — confirmed `source=bot_ai_config`
- Manual mine forced: 684 facts saved, all 8 flavors, 2 minutes

---

## What Was Done Previously (Session 17 — 2026-04-08/09)

**PRs #263–#272 merged:**

1. **PR #263 — Orchestrator SETNX dedup + strike queuing order**
   - Reporting Agent was firing 5x per mine run — research agent retry failures pushed completed counter past expected. Fixed with Redis SETNX one-shot guard.
   - Strike pipeline was exiting without queuing facts if Gemini drafting failed. Moved `markFactsQueued` before `draftReplies`.

2. **PR #264 — Strike harvest verbatim column (ROOT CAUSE)**
   - `harvestFacts()` selected `verbatim` from `market_intelligence` — column does not exist. Every run crashed silently. First successful pipeline run confirmed: 20 links, admin alert received.

3. **PR #265 — Rule 13: update docs after every merge**

4. **PR #267 — Dashboard contrast fix**
   - All `text-zinc-400/500/600` labels on dark backgrounds bumped to readable levels. Zero-state indicators preserved.

5. **PR #268 — Session docs updated**

6. **PR #269 — Provisioner botName top-level fix (CRITICAL)**
   - `botName` was written inside `identity{}` only. Code reads it at top level (`state.botName`). Gemini saw "Bot name: —. Completed: —" and entered a confused self-onboarding loop, asking prospects "What is your name?" and offering to reset settings.
   - Fixed: `botName` and `completedAt` now written at top level on every hatch.
   - Direct DB fix applied to Brents Tiger 01. Polluted fact_anchors cleaned.

7. **PR #270 — Prospect engagement mode**
   - System prompt was operator-management first. Prospects got status reports and tool lists.
   - Added: WHO YOU ARE TALKING TO block, dream injection directive, covenant opening for new conversations, explicit answers for "what can you do?", "who are you?", "hi/start". Four voice examples for prospect conversations.
   - HARD RULE: never surface internal system state in responses.

8. **PR #271 — Bot description + /start message**
   - Bot Telegram description was "AI-powered network-marketer agent for Brents Tiger 01. Managed by Tiger Claw." Replaced with covenant line. Live bot updated immediately via Bot API.
   - /start greeting ended with "Let's get to work! I'm having my nails done later!" — replaced with "What's going on for you right now?"

9. **PR #272 — No tool names in responses**
   - Previous rule caught full names but not shorthand (tigerlead, tigernurture, tigerstrikedraft, etc.). Explicitly listed all variants. Added rule: never explain reasoning out loud mid-message.

**Fleet cleanup:**
- Tiger Test 102 (`b7df9821`) and orphan Brents Tiger 01 (`1ed77b8f`) were generating circuit breaker alerts — both suspended.

**Lesson from this session — MANDATORY for next agent:**
- The bot had no prospect mode at all. It was built entirely for operator management. When real prospects messaged it they got status reports, tool names, and onboarding language. This was broken from day one and only discovered when real people tried to use it.
- **Always test from a FRESH chatId (not the operator's own account) to see what a prospect actually sees.**
- **Read Cloud Run logs before diagnosing.** Every bug this session was visible in the logs immediately.

---

## Open Issues

| # | Issue | Priority |
|---|---|---|
| DAY ZERO | No confirmed successful prospect conversation yet. Two people were messaging at session close — check results first thing. | IMMEDIATE |
| FIRST CONVERSATION | Verify the two people who messaged got a real conversation, not internal language. Screenshot needed. | FIRST THING |
| PADDLE PRODUCT | Webhook live but no Paddle product/price. No checkout URL. Operator cannot monetize until this exists. | HIGH |
| C4 | Payment gate open — direct wizard access bypasses payment. Fix after Paddle loop proven. | NEXT |
| ADMIN ALERT BUG | Underscores in error messages break Telegram Markdown parser. Alerts with error text fail silently. | HIGH |
| FLEET DEBRIS | Tiger Test 102 + orphan suspended. FiretestApril5, Teddy Tiger Claw, Tigertest100, etc. still cluttering fleet. Terminate when convenient. | LOW |
| PROSPECT VALIDATION | Prospect engagement mode deployed but not yet validated with a confirmed successful conversation. | NEXT SESSION |

**Past customers owed bots (3 people paid, never received service):**
`chana.loh@gmail.com`, `nancylimsk@gmail.com`, `lily.vergara@gmail.com` — offer complimentary re-activation when platform is proven live.

---

## Cold Start Checklist (Do This First, Every Session)

1. Read this file top to bottom
2. Run `curl https://api.tigerclaw.io/health` — confirm postgres, redis, workers all OK
3. **Check if any prospects messaged overnight — read their conversations before touching any code**
4. Read Cloud Run logs for errors: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=tiger-claw-api AND severity>=ERROR" --project=hybrid-matrix-472500-k5 --limit=20 --format=json`
5. Do not touch anything until you know what is broken and what is not

**Admin token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
**DB (local):** `cloud-sql-proxy "hybrid-matrix-472500-k5:us-central1:tiger-claw-postgres-ha" --port=5433` then port `5433`, user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`

---

## What This Product Is

Stateless agent hatchery. Operator brings their own Telegram bot token (BYOB) and Gemini API key (BYOK). One-page signup. Agent hatches knowing its ICP — no interview, no questions. Bot talks to prospects directly on Telegram. Hive gets smarter with every run.

**The value proposition: Your agent hunts while you sleep.**

**Active channel:** Telegram only. LINE is future.

---

## How the Bot Talks to Prospects — Critical Context

The bot is deployed as a DIRECT PROSPECT INTERFACE. Operator sends `t.me/Brentstiger01_bot` to warm contacts. Prospects message the bot directly on Telegram. The bot's job: warm conversation, find their pain, install the dream, qualify them for the NuSkin opportunity.

The bot is NOT primarily an operator management tool. Operator management commands (scout, status, etc.) work via `/` commands. Plain text conversations are always treated as prospect interactions.

**The opening:** "Let me take you by the hand and lead you to your brighter future."
**Then:** Ask one question about them. Find their situation. Never mention the platform, tools, or internal state.

---

## Admin Hatch (Operator Fleet)

```bash
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/hatch \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "<BotFather token>",
    "name": "Brents Tiger 02",
    "flavor": "network-marketer",
    "email": "bbryson@me.com",
    "aiKey": "<Gemini key>",
    "product": "Nuskin"
  }'
```

**BotFather rate limit:** ~1 new bot per 8 minutes to avoid 24-hour lockout.

---

## Current Onboarding Path

```
Operator pays via Paddle checkout (checkout URL not yet created)
  → Paddle fires POST /webhooks/paddle (transaction.completed)
  → Webhook provisions: createBYOKUser + createBYOKBot + createBYOKSubscription(pending_setup)
  → Operator navigates to wizard.tigerclaw.io
  → POST /wizard/hatch → BullMQ job → bot registered, webhook set, onboard state pre-seeded
  → Bot is immediately operational — no interview
  → Prospects message the bot directly via Telegram link
```

**Payment gate is still open** for direct wizard access (C4). Fix after Paddle loop is proven.

---

## Architecture (Locked)

| Layer | Technology | Notes |
|---|---|---|
| Compute | Google Cloud Run | Node.js/Express, port 4000, `tiger-claw-api` |
| Database | Cloud SQL PostgreSQL HA | `tiger_claw_shared`, instance `tiger-claw-postgres-ha`, proxy port **5433** locally (NOT 5432) |
| Cache / Queues | Cloud Redis + BullMQ | 11 workers. `ENABLE_WORKERS=true` required in deploy. |
| AI | Gemini 2.0 Flash | LOCKED. Do not switch to 2.5-flash (GCP function-calling bug). |
| Signup + Dashboard | Next.js, `web-onboarding/` | `wizard.tigerclaw.io` — Vercel. Auto-deploy working. |
| Payments | Paddle (active) | Stan Store dead. Paddle webhook live. No product/price yet. |
| Scout search | Serper + Oxylabs | 3 Serper keys round-robin. Oxylabs for Reddit (1,684+ facts/run). |
| Email | Resend | Domain verified. `RESEND_API_KEY` in deploy. |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Multi-region | `us-central1` (primary) + `asia-southeast1` | Global LB at `api.tigerclaw.io` |

---

## Live Service Status

Last verified 2026-04-09:

| Service | Status | Notes |
|---------|--------|-------|
| Cloud Run | OK | Revision 00434-c6h |
| Postgres | OK | Healthy |
| Redis | OK | Healthy |
| Workers | OK | ENABLE_WORKERS=true confirmed, 11 workers |
| Serper keys (x3) | OK | Round-robin active |
| Oxylabs | OK | 1,684+ facts per mine run |
| Platform Gemini key | OK | Active |
| Admin Telegram bot | PARTIAL | Alerts fire but fail when message contains underscores (Markdown bug) |
| Resend | OK | Test email confirmed delivered |
| TELEGRAM_WEBHOOK_SECRET | OK | secretWired: true confirmed |
| Vercel (wizard.tigerclaw.io) | OK | Auto-deploy confirmed working |
| Paddle webhook | OK | Live at /webhooks/paddle. No product/price yet. |
| Tiger Strike pipeline | OK | Confirmed firing — 20-link alert received |
| Brents Tiger 01 | LIVE | @Brentstiger01_bot — prospect mode active |
| Tiger Test 102 | SUSPENDED | No valid keys. Suspended to stop circuit breaker alerts. |
| Orphan (mnpcril3) | SUSPENDED | Duplicate tenant, no bot token. Suspend only — terminate when convenient. |

---

## Fleet Status

| Tenant | Bot | Status | Notes |
|---|---|---|---|
| brents-tiger-01-mnpcripl | @Brentstiger01_bot | onboarding* | *Provisioned pre-status fix. Bot IS live and responding. |
| brents-tiger-01-mnpcril3 | (none) | suspended | Orphan from duplicate-tenant bug. Terminate when convenient. |
| brent-bryson-mnp4j46n | Tiger Test 102 | suspended | No valid keys. Noise only. |
| Various | FiretestApril5, Teddy, Tigertest100, etc. | error/onboarding/pending | Test debris. Terminate in bulk when convenient. |

---

## Tool Registry (26 tools in toolsMap)

**Registered:**
tiger_onboard, tiger_scout, tiger_contact, tiger_aftercare, tiger_briefing, tiger_convert, tiger_export, tiger_email, tiger_hive, tiger_import, tiger_keys, tiger_lead, tiger_move, tiger_note, tiger_nurture, tiger_objection, tiger_score, tiger_score_1to10, tiger_search, tiger_settings, tiger_drive_list, tiger_strike_harvest, tiger_strike_draft, tiger_strike_engage, tiger_refine, tiger_book_zoom

**Intentionally NOT registered:** `tiger_gmail_send`, `tiger_postiz`

---

## Engineering Constraints (Non-Negotiable)

- `main` is branch-protected. Always `feat/` or `fix/` branch + PR. No AI agent pushes to main.
- **Gemini 2.0 Flash only.** 2.5-flash has a GCP function-calling bug. Do not change.
- No Docker containers per tenant. No OpenClaw. No Mini-RAG. Gone permanently.
- `buildSystemPrompt()` is async. Always `await` it.
- New tools in `api/src/tools/` MUST be registered in `toolsMap` in `ai.ts`. Missing = infinite tool loop.
- Market intelligence domain key = flavor **displayName** (e.g. `"Real Estate Agent"`), NOT flavor key.
- `node-fetch` is not in `package.json`. Use native `fetch` (Node 18+).
- Cloud SQL proxy: binary is `cloud-sql-proxy`, instance `hybrid-matrix-472500-k5:us-central1:tiger-claw-postgres-ha`, port **5433** locally.
- One PR per fix. Test before opening a PR. Delete branch after merge.
- `tiger_gmail_send` and `tiger_postiz` are NOT in toolsMap by design. Do not re-add.
- **462 tests must pass** before any PR is opened. Run `npm test` from `api/`.
- After every PR merge: update RULES.md and SOTU.md.
- Read logs before diagnosing. Cloud Run logs are ground truth.

---

## Post-Deploy Protocol (Mandatory Every Time)

```bash
# 1. Deploy API
GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh

# 2. Health check
curl https://api.tigerclaw.io/health

# 3. Fix all webhooks (idempotent)
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Session Protocol

**Start of session:**
1. Run cold start checklist above
2. Read this file
3. **Check prospect conversations first — before any code**
4. Do not code until you know what is broken

**End of session:** Update this file before closing:
1. Update "Last updated" line
2. Update Live Service Status
3. Update Open Issues
4. Add session summary
5. Update RULES.md with any new constraints discovered

A session that ends without updating this file leaves the next agent blind.
