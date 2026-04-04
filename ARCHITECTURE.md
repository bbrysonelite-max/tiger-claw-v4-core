# Tiger Claw V4 — Core Architecture

**Last updated:** 2026-04-03 (Session 6)
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
| Compute | Google Cloud Run, Node.js/Express, port 4000 | ✅ Live |
| Database | Cloud SQL PostgreSQL HA — `tiger_claw_shared` | ✅ Live |
| Cache & Queues | Cloud Redis HA + BullMQ (8 queues) | ✅ Live |
| AI Provider | Gemini 2.0 Flash — `@google/generative-ai` SDK | ✅ Live. **LOCKED — do not switch to 2.5-flash** (GCP function-calling bug) |
| Frontend (signup + dashboard) | Next.js on Vercel — `wizard.tigerclaw.io` | ✅ Live. **Vercel auto-deploy is BROKEN — deploy manually** |
| Frontend (website) | Static HTML — `tigerclaw.io` | ✅ Live |
| Payments | **Stan Store only** | ✅ Active. Customer pays → gets email with link → `wizard.tigerclaw.io/signup` → email verified self-contained in DB. No Zapier. No Stripe. |
| Email (Resend) | Resend — `tigerclaw.io` domain verified | ⚠️ Domain verified but `RESEND_API_KEY` is **not in the deploy script** — emails not delivered in production |
| Stripe | Placeholder | ❌ Not used. `STRIPE_PRICE_BYOK` = `price_placeholder_replace_me`. Do not wire up without a decision. |
| Zapier | Dead code | ❌ Not used. `/webhooks/stan-store` and `ZAPIER_WEBHOOK_SECRET` are dead code. |
| LINE | Deferred | ❌ Phase 2/3. Code preserved. LINE Official Account (business registration) required — personal accounts cannot connect. |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Multi-region | `us-central1` (primary) + `asia-southeast1`. Global HTTPS LB at `api.tigerclaw.io` (IP: `34.54.146.69`) | ✅ Live |

---

## 3. Customer Onboarding Flow (Current — Phase 1)

```
Customer pays on Stan Store
  → Stan Store sends confirmation email
  → Email contains link: wizard.tigerclaw.io/signup
  → Customer enters purchase email
  → POST /auth/verify-purchase
      → if no DB record: creates one on-demand (stan_store_self_serve_...)
      → if active record: creates second bot (multi-agent path)
  → Session token issued
  → Customer fills single-page form: agent name, niche, ICP, Telegram bot token, AI key
  → POST /wizard/hatch
  → BullMQ tenant-provisioning job
  → Provisioner: registers Telegram webhook, sets bot name/description, status → onboarding
  → First message: ICP fast-path intro (confident, no interview)
```

**The 5-step wizard is retired for new customers.** `/signup` is the entry point. The old wizard steps still exist in code but are not the primary flow.

---

## 4. Core Intelligence (The Brain — 26 Tools)

- Tools live in `api/src/tools/`
- Every tool uses `ToolContext` (`api/src/tools/ToolContext.ts`)
- `ai.ts` builds `ToolContext` statelessly on every message
- **Tools missing from `toolsMap` in `ai.ts` cause infinite loops — always register new tools**
- Scoring threshold: **80** — not configurable

### Tool Loop
1. Incoming message → `processTelegramMessage` (LINE deferred)
2. ICP Fast-Path Check — if `onboard_state.json` has `customerProfile` and onboarding incomplete, skip `tiger_onboard()`, send confident intro
3. `startFocus()` — writes `focus_state` Redis key
4. `buildSystemPrompt(tenant)` (async) — injects ICP, hive patterns, lead stats, market intel
5. `getChatHistory()` — loads history + `chat_memory` summary
6. Gemini function-calling loop via `runToolLoop()` — **only `{ output }` passed to Gemini**, raw data stripped
7. `saveChatHistory()` — triggers Sawtooth compression if threshold exceeded
8. `completeFocus()` — triggers compression if tool calls ≥ 12
9. Fire-and-forget: `factExtractionQueue.add()`

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
| 4 | Platform Emergency Key | ❌ **EXPIRED** — must be renewed |

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

`ENABLE_WORKERS=true` must be set in deploy. It is. Do not remove it.

---

## 8. Scout Architecture

- **Burst mode**: user-triggered on-demand runs (default when mode not specified). Max 3/day, min 1h between.
- **Scheduled mode**: nightly cron at 5 AM tenant time. Must be passed explicitly: `mode: 'scheduled'`.
- Sources: Reddit (public JSON), Facebook Groups via Serper, LINE OpenChat via Serper
- **All 3 Serper keys currently return 403 — scout finds zero prospects on every tenant**
- Reddit public API accessible but returning 403 from Cloud Run egress — under investigation

---

## 9. Admin

- **Dashboard URL:** `wizard.tigerclaw.io/admin` (not /admin/dashboard)
- **Token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **Mandatory post-deploy:** `POST /admin/fix-all-webhooks` after every API deploy

---

## 10. Deployment

### API (Cloud Run)
GitHub Actions deploys on merge to `main`. **No AI agent is to push directly to main.** All changes via `feat/` branch + PR.

### Wizard (Vercel)
**Auto-deploy is broken.** Deploy manually from Vercel dashboard until Root Directory setting is fixed.

### Post-Deploy Protocol (mandatory, every time)
```bash
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 11. Known Broken — Do Not Claim Otherwise

| Service | Status | Fix Required |
|---------|--------|-------------|
| Serper keys (all 3) | 403 | New keys from serper.dev |
| Platform emergency Gemini key | Expired | Renew in GCP secrets |
| Resend email in production | Not in deploy script | Add `RESEND_API_KEY` to deploy-cloudrun.sh |
| Stripe | Placeholder | Decision needed — not a current priority |
| Zapier | Dead code | Can be removed when convenient |
| nurture_check calling tiger_scout | Wrong behavior | Bug — not yet fixed |
| Vercel auto-deploy | Broken | Fix Root Directory in Vercel settings |

---

> **Note to all agents:** Architecture is locked. No RAG. No containers. No OpenClaw. No switching AI providers. If you see a TypeScript error, fix the interface — do not rewrite the system.
