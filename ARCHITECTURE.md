# Tiger Claw V4 — Core Architecture

**Last updated:** 2026-04-09 (Session 18 — ground truth rewrite, verified against codebase)
**Status:** LIVE. Locked. Do not rewrite.

---

## Standing Rule

**No lying. No assuming. No guessing.** Every fact in this document was verified by reading the source code on 2026-04-09.

---

## 1. The Paradigm

Tiger Claw V4 is **stateless**. No long-running Docker containers per tenant. No RAG. No OpenClaw. No Mini-RAG. One shared Node.js/Express Cloud Run process handles all tenants. Context is resolved per-request from PostgreSQL and Redis.

**BYOB / BYOK only:** Every operator provides their own Telegram bot token (from BotFather) and their own Gemini API key. The platform holds no bot pool and no shared API keys for production use.

---

## 2. Component Stack (Verified)

| Component | Technology | Status |
|---|---|---|
| Compute | Google Cloud Run, Node.js/Express, port 4000 | ✅ Live. Revision `tiger-claw-api-00442-tjd` |
| Database | Cloud SQL PostgreSQL HA — `tiger_claw_shared` | ✅ Live. 25 migrations applied. |
| Cache & Queues | Cloud Redis HA + BullMQ (10 queues, 6 active workers) | ✅ Live |
| AI Provider | Gemini 2.0 Flash — `@google/generative-ai` SDK | ✅ Live. **LOCKED — do not switch to 2.5-flash** (GCP function-calling bug) |
| AI Fallback | OpenRouter — circuit breaker activates after 3 Gemini errors/hour | ✅ Active |
| Frontend | Next.js on Vercel — `wizard.tigerclaw.io` | ✅ Live. Auto-deploy confirmed working. |
| Payments | Paddle (primary) | ✅ Webhook live. Product/price not yet created. |
| Email | Resend — `tigerclaw.io` domain verified | ✅ Live |
| Search | Serper — 3 keys round-robin (`SERPER_KEY_1/2/3`) | ✅ Active |
| Web scraping | Oxylabs Realtime API | ✅ Live. 684 facts on last run. |
| Reddit | Public JSON API | ❌ 403 from Cloud Run egress. Oxylabs + Serper fallback active. |
| Stripe | Placeholder only | ❌ Not used |
| LINE | Deferred | ❌ Phase 2. Code present, not active. |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Multi-region | `us-central1` primary + `asia-southeast1`. Global HTTPS LB at `api.tigerclaw.io` | ✅ Live |

---

## 3. Customer Onboarding Flow (Paddle — Current)

```
Customer pays via Paddle checkout
  → Paddle fires POST /webhooks/paddle (transaction.completed)
  → Webhook: createBYOKUser + createBYOKBot + createBYOKSubscription(pending_setup)
  → Customer navigates to wizard.tigerclaw.io
  → Wizard: flavor selection → agent name → Telegram bot token → Gemini key
  → POST /wizard/hatch → BullMQ tenant-provisioning job
  → Provisioner:
      - Registers Telegram webhook (with TELEGRAM_WEBHOOK_SECRET)
      - Pre-seeds onboard_state.json: phase="complete" IF product provided, else "identity"
      - ICP pre-seeded from flavor defaultBuilderICP
  → Status → live
  → First message: confident ICP-based response, no interview required
```

**NOTE:** Paddle product + price not yet created. No checkout URL exists.

**Payment gate is open (C4).** Direct wizard access bypasses payment.

---

## 4. Route Architecture (Verified)

22 route files mounted in `api/src/index.ts`:

| Mount | File | Key Endpoints |
|-------|------|--------------|
| `/health` | health.ts | GET — system health check |
| `/auth` | auth.ts | POST verify-purchase, POST session |
| `/wizard` | wizard.ts | POST trial, POST hatch, POST import-contacts, POST validate-key |
| `/dashboard` | dashboard.ts | GET /:slug, POST /:slug/update-key |
| `/tenants` | tenants.ts | PATCH /:id/status, POST /:id/keys/activate, POST /:id/scout |
| `/subscriptions` | subscriptions.ts | POST register, POST checkout, GET trial-checkout |
| `/webhooks` | webhooks.ts | POST stripe, POST telegram/:id, POST line/:id, POST email, POST stan-store, POST lemon-squeezy, POST paddle |
| `/webhooks/ops` | ops.ts | POST — admin ops Telegram bot |
| `/mining` | mining.ts | POST refine |
| `/keys` | keys.ts | POST validate |
| `/flavors` | flavors.ts | GET — all flavor configs |
| `/hive` | hive.ts | GET patterns, POST patterns |
| `/admin` | admin.ts | ~40 endpoints — fleet mgmt, provisioning, dashboard, skills curation, mine controls |
| `/go/:code` | index.ts (inline) | GET — magic link short redirect |

**Total:** ~82 endpoints across 22 route files.

---

## 5. AI Tools (Verified — 26 Registered)

Tools live in `api/src/tools/`. All use `ToolContext` (`api/src/tools/ToolContext.ts`). Registered in `toolsMap` in `api/src/services/ai.ts`.

**Missing registration = infinite tool loop. Always register new tools.**

| Tool | Purpose |
|------|---------|
| `tiger_onboard` | Guided identity + ICP setup |
| `tiger_scout` | Find prospects via web/Serper |
| `tiger_contact` | Send Telegram contact message |
| `tiger_aftercare` | Post-conversion follow-up |
| `tiger_briefing` | Market briefing + pipeline summary |
| `tiger_convert` | Log a prospect as converted |
| `tiger_export` | Export leads/data |
| `tiger_email` | Send email (Layer 4 key only) |
| `tiger_hive` | Submit anonymous patterns |
| `tiger_import` | Import contact list |
| `tiger_keys` | Manage AI keys + record telemetry |
| `tiger_lead` | Create/log lead record |
| `tiger_move` | Move lead between pipeline stages |
| `tiger_note` | Add internal note to lead |
| `tiger_nurture` | Nurture sequence automation |
| `tiger_objection` | Handle sales objections |
| `tiger_score` | ML-based prospect scoring |
| `tiger_score_1to10` | Manual 1–10 scoring framework |
| `tiger_search` | Web search via Serper |
| `tiger_settings` | Update bot settings |
| `tiger_drive_list` | Google Workspace integration |
| `tiger_strike_harvest` | Pull high-confidence leads from data refinery |
| `tiger_strike_draft` | Draft contextual reply in operator's voice |
| `tiger_strike_engage` | Generate Web Intent URLs for approved drafts |
| `tiger_refine` | Data refinery — mine and extract facts |
| `tiger_book_zoom` | Cal.com booking link generation (inactive — no calcomBookingUrl set) |

**Intentionally NOT registered:** `tiger_gmail_send`, `tiger_postiz` — removed Session 8. Do not re-add.

---

## 6. System Prompt Architecture (`buildSystemPrompt`)

Async. Called on every message. Always `await` it.

Loads in parallel:
1. `onboard_state.json` — operator identity + ICP (pre-seeded at hatch)
2. Approved skills for this tenant/flavor
3. `SOUL.md` voice block + FITFAO operating protocol
4. Hive benchmarks (cross-tenant, anonymized)
5. Market intelligence (up to 5 facts, confidence ≥ 70, within 7 days)

**`hasOnboarding` requires:** `phase === 'complete'` AND at least one real identity field (`productOrOpportunity` or `biggestWin`). Phase=complete with empty identity falls back to incomplete-onboarding branch.

**`displayOperatorName`:** Falls back to `"my operator"` when identity is missing — prevents incoherent prospect-facing phrases.

Domain key for market intelligence = flavor **displayName** (e.g. `"Real Estate Agent"`), NOT flavor key (`"real-estate"`).

---

## 7. Circuit Breaker (Gemini → OpenRouter)

- Tracks Gemini errors per tenant in Redis: `circuit_breaker:gemini:errors:{tenantId}` (1-hour TTL)
- After 3 errors in 1 hour: circuit trips, flag set at `circuit_breaker:gemini:tripped:{tenantId}`
- Tripped circuit: all AI calls route to OpenRouter for 1 hour
- Admin alert fires when circuit trips
- Reset: `POST /admin/fleet/:tenantId/clear-circuit-breaker`

**This is production-grade.** It burned $100 in OpenRouter charges when a tenant had no BYOK key and was running platform-key calls at mine volume. The root cause (missing BYOK) was fixed in PR #274.

---

## 8. Queue Architecture (BullMQ — 10 Queues)

| Queue | Worker | Status | Purpose |
|-------|--------|--------|---------|
| `tenant-provisioning` | `provisionWorker` | ✅ Active | New tenant setup |
| `telegram-webhooks` | `telegramWorker` | ✅ Active | Incoming Telegram messages |
| `line-webhooks` | `lineWorker` | ✅ Active (deferred flow) | Incoming LINE messages |
| `fact-extraction` | `factExtractionWorker` | ✅ Active | Async fact anchor extraction |
| `ai-routines` | `routineWorker` | ✅ Active | Scout, nurture, value-gap, check-ins |
| `email-support` | `emailWorker` | ✅ Active | Inbound support emails |
| `global-cron` | ⚠️ No worker | Queue defined, no implementation | Heartbeat scheduler |
| `market-mining` | ⚠️ No worker | Queue defined, no implementation | Daily intelligence mine |
| `market-intelligence-batch` | ⚠️ No worker | Queue defined, no implementation | Batch fact processing |
| `stan-store-onboarding` | ⚠️ No worker | Queue defined, no implementation | Stan Store pre-sale setup |

`ENABLE_WORKERS=true` must be set in deploy. It is. Do not remove it.

### Cron Schedule (ai-routines worker handles scheduling)
- **2 AM UTC** — global market mining job
- **8 AM UTC** — platform key health check
- **Hourly** — nurture checks, value-gap checks, daily scout (eligible tenants)

---

## 9. Memory Architecture

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
| key | Purpose |
|---|---|
| `onboard_state.json` | Operator identity + ICP — pre-seeded at hatch |
| `fact_anchors` | Extracted business facts from conversations |
| `scout_state.json` | Scout run timestamps, burst count, lead totals |
| `score_1to10_sessions.json` | 1-10 scoring sessions |

---

## 10. Key Management (4-Layer)

| Layer | Source | Threshold |
|---|---|---|
| 1 | Platform Onboarding Key | 50 msg/day |
| 2 | Tenant Primary BYOK | Unlimited |
| 3 | Tenant Fallback BYOK | Unlimited |
| 4 | Platform Emergency Key | Active |

Dead key detection fires admin Telegram alert via `sendAdminAlert()`.

---

## 11. Admin

- **Dashboard:** `wizard.tigerclaw.io/admin/dashboard`
- **Token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **Active tenant count:** counts `status IN ('active', 'live')` only. `onboarding` and `pending` do NOT count.

Key admin endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /admin/fleet` | All tenants |
| `GET /admin/dashboard/tenants` | Structured tenant table with onboarding state |
| `POST /admin/hatch` | Provision bot directly (requires product for full identity) |
| `POST /admin/fix-all-webhooks` | Re-register all Telegram webhooks |
| `GET /admin/mine/status` | Mine queue state + last run result |
| `POST /admin/mine/run` | Trigger immediate mine |
| `POST /admin/fleet/:id/reset-conversation` | Clear Redis chat history + onboard_state |
| `DELETE /admin/fleet/:id` | Terminate tenant |
| `POST /admin/fleet/:id/clear-circuit-breaker` | Reset Gemini circuit breaker |

---

## 12. Deployment

### API (Cloud Run)
```bash
GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh
```

### Wizard (Vercel)
Auto-deploy: push to main → Vercel deploys automatically.

### Post-Deploy (mandatory every time)
```bash
curl https://api.tigerclaw.io/health

ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 13. Test Coverage

- **456 tests** across 44 test files. All passing as of 2026-04-09.
- Run: `npm test` from `api/`
- CI runs on every PR push (Test + CI Pipeline + Deploy to Cloud Run).

---

## 14. Flavor Registry (16 Flavors)

network-marketer, real-estate, sales-tiger, lawyer, doctor, health-wellness, baker, plumber, personal-trainer, interior-designer, airbnb-host, candle-maker, gig-economy, admin, dorm-design, researcher

Each flavor provides: `displayName`, `professionLabel`, `defaultKeywords`, `defaultBuilderICP`, `fallbackIntelligence`.

---

## 15. Known Broken / Not Built

| Item | Status |
|------|--------|
| Reddit mine source | ❌ 403 from Cloud Run egress. Oxylabs + Serper fallback working. |
| Paddle product/price | ❌ Not yet created. Webhook live, no checkout URL. |
| Admin alert markdown | ⚠️ Fails when error text contains underscores. |
| 4 BullMQ queues (global-cron, market-mining, market-intelligence-batch, stan-store-onboarding) | ⚠️ Queues defined, no workers implemented. |
| Stripe | ❌ Placeholder. Dead code in routes. |
| LINE | ❌ Deferred. Requires LINE Official Account. |
| Cal.com booking | ⚠️ `tiger_book_zoom` built. Inactive — no `calcomBookingUrl` set. |

---

> **Architecture is locked.** No RAG. No containers. No OpenClaw. No switching AI providers. `tiger_gmail_send` and `tiger_postiz` are intentionally absent from toolsMap. There is no bot pool — BYOB only.
