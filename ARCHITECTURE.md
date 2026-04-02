# Tiger Claw V4 — Core Architecture

**Last updated:** 2026-04-01 (Session 5)
**Status:** LIVE. Locked. Do not rewrite.

---

## 1. The Paradigm

Tiger Claw V4 is **stateless**. There are no long-running Docker containers per tenant. There is no RAG. There is no OpenClaw. There is no Mini-RAG. The entire platform operates as a shared-nothing Node.js Google Cloud Run API (`api/`). One process handles all tenants. Context is resolved per-request.

---

## 2. Component Stack

| Component | Technology | Notes |
|---|---|---|
| Compute | Google Cloud Run | Node.js/Express, port 4000 |
| Database | Google Cloud SQL (PostgreSQL HA) | `tiger_claw_shared` |
| Cache & Queues | Google Cloud Redis HA + BullMQ | 8 queues |
| AI Provider | Google Gemini 2.0 Flash | `@google/generative-ai` SDK — LOCKED. gemini-2.5-flash has a GCP function-calling bug. |
| Frontend (wizard) | Next.js on **Vercel** | `wizard.tigerclaw.io` — `web-onboarding/` subdirectory. NOT Cloud Run. |
| Frontend (website) | Static HTML on Vercel | `tigerclaw.io` — `tiger-bot-website` repo |
| Payments | Stan Store | Stan Store webhook → Zapier → `POST /webhooks/stan-store`. `X-Zapier-Secret` header required. |
| Email | Resend | Provisioning receipts, notifications |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Cloud Run Services | `tiger-claw-api` | Multi-region: `us-central1` (primary) + `asia-southeast1`. Global HTTPS LB at `34.54.146.69`. |

---

## 3. Core Intelligence (The "Brain")

- **26 active tools** in `api/src/tools/` — Gemini function-calling, not OpenClaw skills
- Every tool strictly adheres to `ToolContext` typing (`api/src/tools/ToolContext.ts`)
- `ai.ts` builds `ToolContext` statelessly on every incoming message
- Tools missing from `toolsMap` in `ai.ts` cause infinite loops — always register new tools
- **Scoring threshold: 80** — not configurable, not discussable

### Tool Loop
1. Incoming message → `processTelegramMessage` or `processLINEMessage`
2. **ICP Fast-Path Check (added 2026-03-30):** `checkWizardIcpFastPath(tenantId)` — if `onboard_state.json` has `customerProfile` AND onboarding is not yet complete, skip `tiger_onboard()` entirely and send confident ICP-aware intro
3. `startFocus()` — writes `focus_state` Redis key
4. `buildSystemPrompt(tenant)` (async) — injects memory context including ICP data
5. `getChatHistory()` — loads history + prepends `chat_memory` summary if exists
6. Gemini function-calling loop via `runToolLoop()` — **only `{ output }` is returned to Gemini** from tool results; raw data fields are stripped to prevent woody/technical responses
7. `saveChatHistory()` — saves turns, triggers Sawtooth compression if threshold exceeded
8. `completeFocus()` — triggers compression if tool call count >= 12
9. Fire-and-forget: `factExtractionQueue.add()` for async fact extraction

---

## 4. Memory Architecture (V4.1)

All four phases are shipped and live.

### Redis Keys
| Key | Purpose | TTL |
|---|---|---|
| `chat_history:{tenantId}:{chatId}` | Raw turn history | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Sawtooth compressed summaries | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending | 24 hours |

### PostgreSQL (`tenant_states` table)
| `state_key` | Purpose |
|---|---|
| `onboard_state` | Onboarding interview answers + wizard `customerProfile` (ICP data pre-loaded at hatch) |
| `fact_anchors` | Extracted business facts from live conversations |

### Dynamic System Prompt (`buildSystemPrompt`)
Async. Injects **four live signals** loaded in `Promise.all()`. DB failure on any signal = graceful degradation, no crash.

1. **ICP summary** — from `onboard_state.json` (`icpSingle`, falling back to `customerProfile`) + `fact_anchors`
2. **Hive patterns** — top signals from `hive_signals` for tenant's flavor/region
3. **Lead stats** — live counts from `tenant_leads`
4. **Market intelligence** — up to 5 fresh facts from `market_intelligence` (confidence ≥ 70, within 7 days). Domain key is flavor **displayName** (e.g. `"Real Estate Agent"`), NOT the flavor key (`"real-estate"`). See `getMarketIntelligence()` in `market_intel.ts`.

### Sawtooth Compression (Two Triggers)
- **History threshold:** `history.length > MAX_HISTORY_TURNS * 2` → `compressChatHistory()`
- **Focus threshold:** `toolCallsSinceStart >= 12` → `completeFocus()` → `compressChatHistory()`

Compression uses `PLATFORM_ONBOARDING_KEY` (not tenant's key). Merges summary into `chat_memory` Redis key (30d TTL).

### Mac Cluster (192.168.0.2) — OFFLINE ONLY
Reads Cloud SQL via Auth Proxy. Runs Reflexion Loops offline. Proposes system prompt improvements for Brent to review.
**NOT called by Cloud Run. Cannot break production.**

---

## 5. Multi-Agent Architecture (Added 2026-03-30)

- One email can own multiple bots. Each Stan Store purchase creates a fresh bot_id + tenant + subscription.
- `auth.ts` `/verify-purchase` checks: if existing bot's subscription is NOT `pending_setup`, creates a NEW bot (multi-agent path).
- Session token carries the correct bot_id through all 5 wizard steps.
- Provisioner receives bot_id (UUID), not email — no cross-contamination between agents.
- Critical for scale: Pebo wants 20+ agents, John's 21,000 distributors may want several each.

---

## 6. Key Management (4-Layer Fallback)

Tenants never go dark immediately if billing fails.

| Layer | Source | Threshold |
|---|---|---|
| 1 | Platform Onboarding Key (Tiger Claw provided) | 50 msg/day |
| 2 | Tenant Primary BYOK | Unlimited |
| 3 | Tenant Fallback BYOK | Unlimited |
| 4 | Platform Emergency Keep-Alive | 5 msg, pauses after 24h |

Handled in `tiger_keys.ts` and `ai.ts`.

---

## 7. Queue Architecture (BullMQ)

| Queue | Worker | Purpose |
|---|---|---|
| `tenant-provisioning` | `provisionWorker` | New tenant setup (name, webhook, status) |
| `telegram-webhooks` | `telegramWorker` | Telegram message processing |
| `line-webhooks` | `lineWorker` | LINE message processing |
| `fact-extraction` | `factExtractionWorker` | Async fact anchor extraction |
| `ai-routines` | `routineWorker` | Scout (+ morning report), nurture, value-gap check-ins, weekly check-ins, Strike/Postiz routines |
| `global-cron` | `cronWorker` | Heartbeat scheduler (every minute) |

---

## 8. Morning Hunt Report (Added 2026-04-01)

`daily_scout` routine fires at 7 AM UTC for every active tenant. After `tiger_scout` runs, Tiger composes a morning message and sends it via Telegram or LINE. Language of Hope fires if pipeline is empty — no silent runs.

Previously: `runToolLoop` result was discarded (`return ''`). Now: `accumulatedText` is captured and pushed to operator.

---

## 9. Provisioning Flow (Updated 2026-03-30)

1. `POST /wizard/hatch` validates botId, subscription, AI key
2. Activates subscription (`pending_setup` → `active`)
3. Writes `customerProfile` to `onboard_state.json` (ICP pre-load)
4. Enqueues BullMQ `tenant-provisioning` job
5. Provisioner: updates tenant record **including name** from wizard input
6. Registers Telegram webhook (BYOB token → `setWebhook`)
7. Rebrands Telegram profile: `setMyName` + `setMyDescription` using **tenant.name** (now correct)
8. Registers LINE webhook (if credentials, non-fatal)
9. Status → `onboarding`
10. First inbound message → ICP fast-path check → confident intro (no interview)

---

## 9. Security & Isolation

- SQL queries never built from LLM output
- Tenant data siloed to tenant-specific schemas (`t_{uuid}`)
- Bot tokens AES-256-GCM encrypted at rest via `services/pool.ts`
- BYOK keys validated server-side before storage — never store plaintext
- `ALLOWED_ORIGINS` enforced on all CORS — fails loudly if not set
- All secrets in Cloud Secret Manager or environment variables

---

## 10. Deployment

### API (Cloud Run)
Triggered automatically by GitHub Actions on merge to `main`.

### Wizard (Vercel)
Vercel watches `tiger-claw-v4-core` repo. Merge to `main` → auto-deploy `web-onboarding/` to `wizard.tigerclaw.io`.

### Website (Vercel)
Separate repo `tiger-bot-website`. Push to `main` → auto-deploy to `tigerclaw.io`.

---

> **Note to all AI agents:** This architecture is locked. If you see a type error, fix the TypeScript interface. Do NOT rewrite the architecture. Do NOT restore OpenClaw. Do NOT add per-tenant containers. Do NOT switch AI providers.
