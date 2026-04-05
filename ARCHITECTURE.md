# Tiger Claw V4 — Core Architecture

**Last updated:** 2026-04-05 (Session 11 — Round 2 audit + security fixes PR #210)
**Status:** LIVE. Locked. Do not rewrite.

---

## Standing Rule

**No lying. No assuming. No guessing.** If you do not know the state of something, say so. Do not mark things working unless you have tested them live.

---

## 1. The Paradigm

Tiger Claw V4 is **stateless**. No long-running Docker containers per tenant. No RAG. No OpenClaw. No Mini-RAG. One shared Node.js Cloud Run process handles all tenants. Context is resolved per-request.

---

## 2. Component Stack

| Component | Technology | Actual Status |
|---|---|---|
| Compute | Google Cloud Run, Node.js/Express, port 4000 | ✅ Live. Revision 00330-6ml |
| Database | Cloud SQL PostgreSQL HA — `tiger_claw_shared` | ✅ Live |
| Cache & Queues | Cloud Redis HA + BullMQ (8 queues) | ✅ Live |
| AI Provider | Gemini 2.0 Flash — `@google/generative-ai` SDK | ✅ Live. **LOCKED — do not switch to 2.5-flash** (GCP function-calling bug) |
| Frontend (signup + dashboard) | Next.js on Vercel — `wizard.tigerclaw.io` | ✅ Live. **Vercel auto-deploy is BROKEN — deploy manually** |
| Frontend (website) | Static HTML — `tigerclaw.io` | ✅ Live |
| Payments | **Stan Store only** | ✅ Active. No Zapier. No Stripe. |
| Email (Resend) | Resend — `tigerclaw.io` domain verified | ✅ Live. `RESEND_API_KEY` in deploy script since Session 7. First production email confirmed delivered. |
| Serper (search) | 3 keys: `SERPER_KEY_1/2/3` | ✅ All confirmed working |
| Reddit (mine source) | Public JSON API | ❌ 403 from Cloud Run egress. Serper fallback active and working. |
| Stripe | Placeholder | ❌ Not used. Do not wire up. |
| Zapier | Dead code | ❌ Not used. `/webhooks/stan-store` dead code. |
| LINE | Deferred | ❌ Phase 2/3. Code preserved. LINE Official Account required. |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Multi-region | `us-central1` (primary) + `asia-southeast1`. Global HTTPS LB at `api.tigerclaw.io` (IP: `34.54.146.69`) | ✅ Live |

---

## 3. Customer Onboarding Flow (Current — Phase 1)

```
Customer pays on Stan Store
  → Stan Store sends confirmation email with wizard.tigerclaw.io/signup link
  → Customer enters purchase email on /signup
  → POST /auth/verify-purchase
      → if no DB record: creates one on-demand
      → if active record exists: creates new bot (multi-agent path)
  → Session token issued
  → Customer fills single-page form: agent name, niche, ICP, Telegram bot token, AI key
  → POST /wizard/hatch
  → BullMQ tenant-provisioning job
  → Provisioner: registers Telegram webhook (with TELEGRAM_WEBHOOK_SECRET), sets bot name/description
  → status → onboarding
  → First message: confident ICP-based intro, no interview
```

**BYOB (Bring Your Own Bot):** Customer provides their own Telegram bot token. No pool. No bottleneck.
**BYOK (Bring Your Own Key):** Customer provides their own Gemini API key. Platform key is fallback only.

---

## 4. Core Intelligence (The Brain — 25 Tools)

- Tools live in `api/src/tools/`
- Every tool uses `ToolContext` (`api/src/tools/ToolContext.ts`)
- `ai.ts` builds `ToolContext` statelessly on every message
- **Tools missing from `toolsMap` in `ai.ts` cause infinite loops — always register new tools**
- Scoring threshold: **80** — not configurable

### Registered Tools (25)
tiger_onboard, tiger_scout, tiger_contact, tiger_aftercare, tiger_briefing, tiger_convert, tiger_export, tiger_email, tiger_hive, tiger_import, tiger_keys, tiger_lead, tiger_move, tiger_note, tiger_nurture, tiger_objection, tiger_score, tiger_score_1to10, tiger_search, tiger_settings, tiger_drive_list, tiger_strike_harvest, tiger_strike_draft, tiger_strike_engage, tiger_refine

### Intentionally NOT Registered
- `tiger_gmail_send` — removed Session 8. Gemini must never send from operator's personal Gmail without explicit human approval. File preserved in `api/src/tools/tiger_google_workspace.ts`.
- `tiger_postiz` — removed Session 8. Social media broadcasting is not Tiger's job. File preserved in `api/src/tools/tiger_postiz.ts`.

### Tool Loop
1. Incoming message → `processTelegramMessage` (LINE deferred)
2. ICP Fast-Path Check — if `onboard_state.json` has `customerProfile` and onboarding incomplete, skip `tiger_onboard()`, send confident intro
3. `startFocus()` — writes `focus_state` Redis key
4. `buildSystemPrompt(tenant)` (async — always `await` it) — injects ICP, hive patterns, lead stats, market intel
5. `getChatHistory()` — loads history + `chat_memory` summary
6. Gemini function-calling loop via `runToolLoop()` — **only `{ output }` passed to Gemini**, raw data stripped
7. `saveChatHistory()` — triggers Sawtooth compression if threshold exceeded
8. `completeFocus()` — triggers compression if tool calls ≥ 12
9. Fire-and-forget: `factExtractionQueue.add()`

### Tool Behavior Rules
- When a tool fails or returns an error: **do not report the failure to the operator. Do not ask what to do next. Silently try the next best action.** (Enforced in system prompt — added Session 7 PR #185)

---

## 5. Memory Architecture

### Redis Keys
| Key | Purpose | TTL |
|---|---|---|
| `chat_history:{tenantId}:{chatId}` | Raw turn history | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Sawtooth compressed summaries | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending | 24 hours |
| `circuit_breaker:gemini:errors:{tenantId}` | Gemini error count | 1 hour |
| `circuit_breaker:gemini:tripped:{tenantId}` | Circuit tripped flag | 1 hour |
| `magic_short:{code}` | Short magic link → full URL | Same TTL as token |

### PostgreSQL (`tenant_states` table)
| `state_key` | Purpose |
|---|---|
| `scout_state.json` | Scout run timestamps, burst count, lead totals |
| `onboard_state.json` | Onboarding answers + ICP pre-loaded at hatch |
| `fact_anchors` | Extracted business facts from conversations |
| `score_1to10_sessions.json` | 1-10 scoring framework sessions |

### Dynamic System Prompt (`buildSystemPrompt`)
Async. Loads 4 signals in `Promise.all()`. DB failure = graceful degradation.
1. ICP summary (`icpSingle`, falling back to `customerProfile`) + `fact_anchors`
2. Hive patterns — top signals for tenant's flavor/region
3. Lead stats — live counts from `tenant_leads`
4. Market intelligence — up to 5 facts (confidence ≥ 70, within 7 days). Domain key = flavor **displayName** (e.g. `"Real Estate Agent"`), NOT flavor key (`"real-estate"`)

---

## 6. Key Management (4-Layer Fallback)

| Layer | Source | Threshold |
|---|---|---|
| 1 | Platform Onboarding Key | 50 msg/day |
| 2 | Tenant Primary BYOK | Unlimited |
| 3 | Tenant Fallback BYOK | Unlimited |
| 4 | Platform Emergency Key | ✅ Active (renewed Session 7) |

Dead key detection fires admin Telegram alert via `sendAdminAlert()` → `ADMIN_TELEGRAM_BOT_TOKEN` / `ADMIN_TELEGRAM_CHAT_ID`.

---

## 7. Queue Architecture (BullMQ — 8 Queues)

| Queue | Purpose |
|---|---|
| `tenant-provisioning` | New tenant setup |
| `telegram-webhooks` | Telegram message processing |
| `line-webhooks` | LINE (deferred — queue exists, worker active) |
| `fact-extraction` | Async fact anchor extraction |
| `ai-routines` | Scout, nurture, value-gap, check-ins |
| `global-cron` | Heartbeat scheduler (every minute) |
| `market-mining` | Daily intelligence mine (2 AM UTC) |
| `market-intelligence-batch` | Batch fact processing |

`ENABLE_WORKERS=true` must be set in deploy. It is. Do not remove it.

### Cron Schedule (global-cron heartbeat, every minute)
- **2 AM UTC** — `global_market_mining` job enqueued (date-stamped jobId prevents duplicates)
- **8 AM UTC** — Platform key health check; fires admin alert if expired
- **Hourly** — nurture checks, value-gap checks, daily scout (for eligible tenants)

### Mine Status
- `GET /admin/mine/status` — returns `{ isRunning, queueDepth, lastRun: { flavorsProcessed, postsFound, factsSaved, completedAt } }`
- `POST /admin/mine/run` — triggers immediate mine run (bypasses 2 AM cron)
- Mine worker logs `mine_complete` to `admin_events` on success

---

## 8. Scout Architecture

- **Burst mode**: user-triggered on-demand runs. Max 3/day, min 1h between.
- **Scheduled mode**: nightly cron at 5 AM tenant time. Must be passed explicitly: `mode: 'scheduled'`.
- **Sources (in order):**
  1. Reddit public JSON (currently 403 from Cloud Run egress — fallback active)
  2. Serper fallback (`SERPER_KEY_2`) — confirmed working
- Scoring threshold: **80** (platform default). Configurable per flavor via `FlavorConfig.scoreThreshold` — threaded through `runHunt → buildAndSaveLead → recomputeAndSave` (PR #204). Scoring uses profileFit + intentSignals only when engagement data absent (weights normalized — fixed Session 7 PR #180).

---

## 9. Admin

- **Dashboard URL:** `wizard.tigerclaw.io/admin`
- **Fleet ops URL:** `wizard.tigerclaw.io/admin/dashboard`
- **Token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **Webhook fix:** `POST /admin/fix-all-webhooks` — idempotent. TELEGRAM_WEBHOOK_SECRET now baked into deploy so this is a safety net, not mandatory.
- **Active tenant count:** `/admin/metrics` counts `status IN ('active', 'live')` only. `onboarding` and `pending` do NOT count as active.

### Key Admin Endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /admin/fleet` | All tenants with status |
| `GET /admin/platform-health` | Live probe of all 10 services |
| `GET /admin/pipeline/health` | Data mine health (facts/24h, stale verticals) |
| `GET /admin/mine/status` | Current mine queue state + last run result |
| `POST /admin/mine/run` | Trigger immediate mine run |
| `POST /admin/fix-all-webhooks` | Re-register all Telegram webhooks |
| `POST /admin/fleet/:id/report` | Trigger manual scout for a tenant |
| `POST /admin/fleet/:id/suspend` | Suspend a tenant |
| `POST /admin/fleet/:id/resume` | Resume a tenant |

---

## 10. Deployment

### API (Cloud Run)
```bash
GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh
```

### Wizard (Vercel)
**Auto-deploy is broken.** Deploy manually from Vercel dashboard until Root Directory setting is fixed.

### Post-Deploy Protocol (mandatory, every time)
```bash
# Verify health
curl https://api.tigerclaw.io/health

# Fix webhooks (idempotent — just confirms secret is wired)
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 11. Test Coverage

- **447 tests** across 41 test files. All passing as of Session 11 (PR #210).
- Every tool in `toolsMap` has test coverage.
- Run: `npm test` from `api/`
- CI runs on every PR push.

---

## 12. Known Broken / Not Built

| Item | Status |
|------|--------|
| Reddit mine source | ❌ 403 from Cloud Run egress. Serper fallback working. |
| Vercel auto-deploy | ❌ Broken. Deploy wizard manually. |
| Stripe | ❌ Placeholder. Not used. |
| Zapier | ❌ Dead code. |
| LINE | ❌ Deferred. Requires LINE Official Account. |
| Customer-facing dashboard | ✅ Built. `GET/POST /dashboard/:slug` — session-token auth + ownership check (PR #210). |

---

> **Note to all agents:** Architecture is locked. No RAG. No containers. No OpenClaw. No switching AI providers. If you see a TypeScript error, fix the interface — do not rewrite the system. `tiger_gmail_send` and `tiger_postiz` are intentionally absent from toolsMap — do not re-add them.
