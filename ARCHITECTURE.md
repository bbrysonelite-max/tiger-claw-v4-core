# Tiger Claw V4 — Core Architecture

**Last updated:** 2026-03-24
**Status:** LIVE. Locked. Do not rewrite.

---

## 1. The Paradigm

Tiger Claw V4 is **stateless**. There are no long-running Docker containers per tenant. There is no RAG. There is no OpenClaw. There is no Mini-RAG.

The entire platform operates as a shared-nothing Node.js Google Cloud Run API (`api/`). One process handles all tenants. Context is resolved per-request.

---

## 2. Component Stack

| Component | Technology | Notes |
|---|---|---|
| Compute | Google Cloud Run | Node.js/Express, port 4000 |
| Database | Google Cloud SQL (PostgreSQL HA) | `tiger_claw_shared` |
| Cache & Queues | Google Cloud Redis HA + BullMQ | 5 queues |
| AI Provider | Google Gemini 2.0 Flash | `@google/generative-ai` SDK — LOCKED |
| Frontend (wizard) | Next.js on Vercel | `wizard.tigerclaw.io` — `web-onboarding/` subdirectory |
| Frontend (website) | Static HTML on Vercel | `tigerclaw.io` — `tiger-bot-website` repo |
| Payments | Stan Store + Stripe | Stan Store gates access; Stripe handles subscriptions |
| Email | Resend | Provisioning receipts, notifications |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Cloud Run Service | `tiger-claw-api` | Region: `us-central1` |

---

## 3. Core Intelligence (The "Brain")

- **19 active tools** in `api/src/tools/` — Gemini function-calling, not OpenClaw skills
- Every tool strictly adheres to `ToolContext` typing (`api/src/tools/ToolContext.ts`)
- `ai.ts` builds `ToolContext` statelessly on every incoming message
- Tools missing from `toolsMap` in `ai.ts` cause infinite loops — always register new tools
- **Scoring threshold: 80** — not configurable, not discussable

### Tool Loop
1. Incoming message → `processTelegramMessage` or `processLINEMessage`
2. `startFocus()` — writes `focus_state` Redis key
3. `buildSystemPrompt(tenant)` (async) — injects memory context
4. `getChatHistory()` — loads history + prepends `chat_memory` summary if exists
5. Gemini function-calling loop via `runToolLoop()`
6. `saveChatHistory()` — saves turns, triggers Sawtooth compression if threshold exceeded
7. `completeFocus()` — triggers compression if tool call count >= 12
8. Fire-and-forget: `factExtractionQueue.add()` for async fact extraction

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
| `onboard_state` | Onboarding interview answers |
| `fact_anchors` | Extracted business facts from live conversations |

### Dynamic System Prompt (`buildSystemPrompt`)
Async. Injects three live signals via `buildMemoryContext()`:
1. **ICP summary** — from `onboard_state.json` + `fact_anchors`
2. **Hive patterns** — top 3 `hive_signals` rows for tenant's vertical/region
3. **Lead stats** — live counts from `tenant_leads`

All three loaded in `Promise.all()`. DB failure = graceful degradation, no crash.

### Sawtooth Compression (Two Triggers)
- **History threshold:** `history.length > MAX_HISTORY_TURNS * 2` → `compressChatHistory()`
- **Focus threshold:** `toolCallsSinceStart >= 12` → `completeFocus()` → `compressChatHistory()`

Compression uses `PLATFORM_ONBOARDING_KEY` (not tenant's key). Merges summary into `chat_memory` Redis key (30d TTL).

### Mac Cluster (192.168.0.2) — OFFLINE ONLY
Reads Cloud SQL via Auth Proxy. Runs Reflexion Loops offline. Proposes system prompt improvements for Brent to review. **NOT called by Cloud Run. Cannot break production.**

---

## 5. Key Management (4-Layer Fallback)

Tenants never go dark immediately if billing fails.

| Layer | Source | Threshold |
|---|---|---|
| 1 | Platform Onboarding Key (Tiger Claw provided) | 50 msg/day |
| 2 | Tenant Primary BYOK | Unlimited |
| 3 | Tenant Fallback BYOK | Unlimited |
| 4 | Platform Emergency Keep-Alive | 5 msg, pauses after 24h |

Handled in `tiger_keys.ts` and `ai.ts`.

---

## 6. Queue Architecture (BullMQ)

| Queue | Worker | Purpose |
|---|---|---|
| `tenant-provisioning` | `provisionWorker` | New tenant setup |
| `telegram-webhooks` | `telegramWorker` | Telegram message processing |
| `line-webhooks` | `lineWorker` | LINE message processing |
| `fact-extraction` | `factExtractionWorker` | Async fact anchor extraction |
| `ai-routines` | `routineWorker` | Scout, nurture, trial reminders |
| `global-cron` | `cronWorker` | Heartbeat scheduler (every minute) |

---

## 7. Security & Isolation

- SQL queries never built from LLM output
- Tenant data siloed to tenant-specific schemas (`t_{uuid}`)
- Bot tokens AES-256-GCM encrypted at rest via `services/pool.ts`
- BYOK keys validated server-side before storage — never store plaintext
- `ALLOWED_ORIGINS` enforced on all CORS — fails loudly if not set
- All secrets in Cloud Secret Manager or environment variables — no hardcoded values

---

## 8. Deployment

### API (Cloud Run)
Triggered automatically by GitHub Actions on merge to `main`. Do not deploy manually.

```bash
# The only deploy path:
git push origin feat/your-branch
gh pr create && gh pr merge --auto --squash
# GitHub Actions handles the rest
```

### Wizard (Vercel)
Vercel watches `tiger-claw-v4-core` repo. Merge to `main` → auto-deploy `web-onboarding/` to `wizard.tigerclaw.io`.

### Website (Vercel)
Separate repo `tiger-bot-website`. Push to `main` → auto-deploy to `tigerclaw.io`.

---

> **Note to all AI agents:** This architecture is locked. If you see a type error, fix the TypeScript interface. Do NOT rewrite the architecture to fix it. Do NOT restore OpenClaw. Do NOT add per-tenant containers. Do NOT switch AI providers.
