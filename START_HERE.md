# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
Stop what you are doing. Read this entire document and `CLAUDE.md`. These are your injected directives. Do not ask Brent to repeat himself. Do not rely on hallucinated history.

---

## 1. The Current State of the Universe

**Tiger Claw is LIVE and fully deployed. CI is green. PRs #62–#71 merged. Phase 3 BYOB pivot COMPLETE.**
- **Timestamp:** 2026-03-29 23:45 UTC
- **API:** `https://api.tigerclaw.io` — Cloud Run `tiger-claw-api`, multi-region (us-central1 + asia-southeast1)
- **Load Balancer:** Global HTTPS LB at `34.54.146.69` — both regions behind Anycast IP
- **Architecture:** V4 Stateless Serverless — one API process, all tenants, context resolved per-request
- **Database:** PostgreSQL HA via Cloud SQL Proxy (`tiger_claw_shared`)
- **Cache/Queue:** Redis HA + BullMQ (8 queues)
- **AI Engine:** Gemini 2.0 Flash (LOCKED — `gemini-2.5-flash` has a GCP function-calling bug, do not use it)
- **Tests:** 395 passing (Verified on main)
- **Flavors:** 15 customer-facing industry flavors, all with full field set including scoutQueries
- **Min-instances:** 1 — no cold start
- **Data Refinery:** v5 pipeline FULLY AUTONOMOUS — fires nightly at 2 AM UTC via BullMQ.
- **Circuit Breaker:** LIVE — auto-failover to OpenRouter after 3 Gemini failures.
- **Economics:** INSTRUMENTED — per-tenant API call tracking live in Redis.


**Strict Rule 1:** OpenClaw, Mini-RAG, and per-tenant Docker containers are DEAD. Do not reference or restore them.

**Strict Rule 2:** `main` is branch-protected. NEVER push directly. Always use `feat/` branches and `gh pr create`.

**Strict Rule 3:** Read `CLAUDE.md` before writing any code. Non-negotiable product and engineering directives.

**Strict Rule 4:** Anthropic is NOT wired. Do not add it back without implementing the full `@anthropic-ai/sdk` code path in `api/src/services/ai.ts`. Deferred to Phase 6.

**Strict Rule 5:** BYOB PIVOT is complete and live. Bot pool is permanently removed from the provisioning path. Telegram tenants bring their own token via the 4-step wizard. `pool.ts` is retained for token encryption only. See `STATE_OF_THE_TIGER_PATH_FORWARD.md`.

**Strict Rule 6:** The 61 pool tokens are Brent's personal fleet. Retrieve them via `GET /admin/pool/tokens`. Do NOT delete them.

---

## 2. What Has Been Accomplished (Full History)

1. **V4 Stateless Architecture** — Cloud Run API, shared PostgreSQL, Redis, BullMQ.
2. **18 Native Function Calling Tools** — `api/src/tools/`. All tests passing.
3. **Business Model: Card Upfront** — No free trial. Stan Store checkout. 7-day MBG.
4. **Multi-Provider AI** — Google Gemini, OpenAI, Grok, OpenRouter, Kimi. Anthropic deferred to Phase 6.
5. **Memory Architecture V4.1** — `buildSystemPrompt()` is async. Sawtooth compression, fact anchors, hive signals, focus primitives. PRs #20–#24, merged.
6. **Value-Gap Detection Cron** — 9 AM UTC daily. Active/onboarding tenant, zero leads in 3 days → diagnostic message to operator. PR #26.
7. **Email Infrastructure** — Resend (outbound), Postmark (inbound support). `hello@tigerclaw.io`, `support@tigerclaw.io` live.
8. **Email Support Agent** — PR #45: Postmark → BullMQ → AI → Resend reply.
9. **Admin Dashboard** — `wizard.tigerclaw.io/admin/dashboard`. Bearer token auth. Fleet management, bot pool health.
10. **Beta Hardening** — ADMIN_TOKEN rotated, Telegram webhook secret, dead trial code removed. PRs #41–#44.
11. **Stan Store Webhook** — `POST /webhooks/stripe` provisions user + sends magic link email. Idempotent via Redis.
12. **Zoom Call 2026-03-27** — Went well. Post-call: 7-day observation window.
13. **SWOT Analysis completed** — 6 weaknesses identified, all 6 fixed.
14. **15 Flavors** — 3 new niches added (dorm-design, mortgage-broker, personal-trainer). scoutQueries added to all 15.
15. **Multi-Region Deploy** — asia-southeast1 added. Global HTTPS LB at 34.54.146.69. SSL cert ACTIVE. PR #53.
16. **v5 Data Refinery ACTIVATED** — `tiger_refine.ts` replaced mock with real Gemini extraction. PR #56.
17. **Autonomous Mining Cron** — `miningQueue` + `miningWorker` + `market_miner.ts`. Fires 2 AM UTC daily. PR #57.
18. **Webhook Rate Limiting** — 60 req/min per tenant, 20/min per IP email. PR #49.
19. **HMAC Magic Links** — `MAGIC_LINK_SECRET`-signed, 72h TTL. PR #50.
20. **CI Type Fixes** — All TypeScript errors post-merge resolved. PRs #54, #55.
21. **ICP Null Guard** — `tiger_scout.ts` crash on `idealPerson` undefined fixed. PR #60.
22. **Double JSON.parse Fix** — `queue.ts` and `ai.ts` were wrapping already-parsed JSONB. PR #61.
23. **Tiger Strike Tools** — `tiger_strike_draft/engage/harvest.ts` committed (were missing, blocked CI).
24. **First-Lead Email** — `sendFirstLeadNotification()` in email.ts; tiger_scout sends email to tenant when first leads arrive.
25. **Wizard Auth Fix** — Magic link `token`/`expires` now flow through `page.tsx` → `OnboardingModal` → `StepIdentity` → `/wizard/auth`. PR #62.
26. **Safe Gemini Text Extraction + KeyState Fix** — PR #63.
27. **Conversation Counter** — `GET /admin/conversations` endpoint. Per-tenant 24h + today message counts via Redis. PR #66.
28. **Feedback Loop LINE Fix** — `processSystemRoutine()` now delivers all feedback routines to LINE tenants. PR #66.
29. **Reliability Audit** — `specs/RELIABILITY_AUDIT.md` — 4 CRITICAL, 7 HIGH, 3 MED findings identified. PR #66.
30. **Reliability Hardening** — All CRITICAL + HIGH findings fixed: cron 'onboarding' gap, Stripe Redis fail-closed, LINE webhook alert, resumeTenant response check, setWebhook on activation, ICP validation guard, email unknown sender guard, Telegram enqueue alert. PRs #67.
31. **BYOB Pivot SHIPPED** — PR #68 merged. Pool code removed from provisioner + queue. Wizard is now 4 steps (Identity → Channel → AI → Review). Telegram BYOB card with real-time `getMe` validation. `telegramBotToken` flows through to hatch.
32. **Admin Pool Utilities** — `GET /admin/pool/tokens?limit=N` (decrypted tokens for wizard use), `POST /admin/pool/retire-batch` (bulk retire). PR #68.
33. **Website Content Audit Fixed** — All CTAs route through `tigerclaw.io/#pricing`. AI provider list corrected everywhere (Google Gemini, OpenAI, Grok, OpenRouter, Kimi — Anthropic removed). `tiger-bot-website` pushed directly to main and live. PRs #69, #70.
34. **Gemini Rate Limit Hardening** — `geminiGateway.ts`: process-level semaphore (default 10 concurrent, tunable via `GEMINI_CONCURRENCY` env var) + exponential backoff on 429s (up to 3 retries, ~1s/2s/4s + jitter). All 10 Gemini call sites hardened. PR #71.
35. **Gemini Circuit Breaker (Task #13)** — 3 consecutive 429/5xx errors trigger 1-hour failover to OpenRouter. PR #70.
36. **AI Unit Economics (Task #14)** — Instrumented tool loop to track per-tenant and platform-wide API call counts in Redis. PR #70.
37. **Secret Pinning Fix (Critical Item #3)** — Unpinned DATABASE_READ_URL from version 8; now uses latest in all regions.
38. **MAGIC_LINK_SECRET Secured** — Created in GCP Secret Manager and mounted in both Cloud Run regions. Verified end-to-end.

---

## 3. SWOT Weakness Fix Status (ALL RESOLVED)

| # | Weakness | Status | PR |
|---|---|---|---|
| 1 | No rate limiting on webhooks | ✅ Fixed | #49 |
| 2 | Magic links unsigned | ✅ Fixed | #50 |
| 3 | Birdie cron not running | ✅ Fixed | Mine now runs in Cloud Run |
| 4 | 3 missing flavor niches | ✅ Fixed | #51 |
| 5 | Thin data volume / Refinery undeployed | ✅ Fixed | #52, #56, #57 — 313 facts on first run |
| 6 | Single-region (us-central1 only) | ✅ Fixed | #53 |

---

## 4. Open PRs (Pending Review/Merge)

| PR | Branch | Description |
|----|--------|-------------|
| #71 | `feat/gemini-rate-limit-hardening` | Phase 5 #15 — Gemini semaphore + exponential backoff |

All other PRs through #70 are merged and live.

---

## 5. Multi-Region Architecture

| Component | Detail |
|---|---|
| Primary region | `us-central1` |
| Secondary region | `asia-southeast1` (Singapore) — for Thai customers |
| Load Balancer IP | `34.54.146.69` (Anycast) |
| DNS | `api.tigerclaw.io A → 34.54.146.69` (Porkbun) |
| SSL cert | `tiger-claw-lb-cert` — managed, ACTIVE |
| VPC | `tiger-claw-vpc` — BGP routing GLOBAL |
| CI variable | `MULTI_REGION_READY=true` — deploys both regions on every merge to main |

asia-southeast1 health confirmed 2026-03-27: uptime 12h, PostgreSQL/Redis all green, 22ms response time.

---

## 6. Memory Architecture (V4.1 — Fully Shipped)

`buildSystemPrompt()` is **async**. On every request it injects four live signals:
- **Operator profile** — from `onboard_state` in `tenant_states`
- **Network intelligence** — top 3 `hive_signals` rows for this tenant's vertical/region
- **Pipeline stats** — live lead counts from `tenant_leads`
- **Fact anchors** — extracted business facts from `tenant_states.fact_anchors`

All loaded in `Promise.all()` — DB unreachable = static prompt, no crash.

**Redis key inventory:**
| Key | Purpose | TTL |
|---|---|---|
| `chat_history:{tenantId}:{chatId}` | Raw turn history | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Sawtooth compressed summaries | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending | 24 hours |
| `msg_count:{tenantId}:{YYYYMMDD}` | Per-tenant daily message counter | 48 hours |
| `stripe:processed:{sessionId}` | Stripe idempotency guard | 24 hours |

---

## 7. v5 Data Refinery (Fully Autonomous)

**Pipeline:** BullMQ `miningWorker` (2 AM UTC) → `market_miner.ts` → Reddit JSON API → `POST /mining/refine` → Gemini 2.0 Flash extraction → `market_intelligence` table (120-day decay)

**Schedules:**
| Scheduler | Time | Role |
|---|---|---|
| BullMQ `miningWorker` in Cloud Run | 2 AM UTC | Primary — autonomous |
| Cheese Grater launchd `io.tigerclaw.market-miner` | 3 AM local | Backup — `isAlreadyMined()` dedup prevents double-saves |

**First run results (2026-03-27):** 313 facts, 14 flavors, 7 Reddit rate-limit misses (handled gracefully).

---

## 8. Product

| Product | Price |
|---|---|
| Tiger-Claw Pro (Pre-Flavored) | $147/mo |
| Industry Agent | $197/mo |

**15 Customer-Facing Flavors:** network-marketer, real-estate, health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger, researcher, interior-designer, dorm-design, mortgage-broker, personal-trainer.

Doctor removed — healthcare compliance risk. Do not re-add it.

**Supported AI providers:** Google Gemini, OpenAI, Grok, OpenRouter, Kimi. Anthropic is NOT wired — Phase 6.

---

## 9. Tenant Roster (Active)

| Slug | Email | Status | Notes |
|---|---|---|---|
| `debbie-cameron` | justagreatdirector@outlook.com | live | Founding member |
| `john-thailand` | vijohn@hotmail.com | live | Founding member — John + Noon (Thailand) |
| `chana-loha` | chana.loh@gmail.com | live | Founding member — Chana |
| `phaitoon` | phaitoon2010@gmail.com | live | Founding member — Toon (Thailand) |

Cron heartbeat confirms 11 total active tenants. Phase 4 activation (John/Noon/Toon/Debbie) is in progress by Brent.

**7 past customers** (paid, never received service) — preserved for complimentary re-activation outreach. Phase 6 task #17.

---

## 10. BYOB Architecture (Live — Phase 3 Complete)

**The wizard is 4 steps:** Identity → Channel Setup → AI Connection → Review & Pay.

**Channel Setup step (step 2):**
- Telegram BYOB card is primary and required. Paste field validates token live via `api.telegram.org/getMe` with 700ms debounce. Shows `@botusername — Verified` on success. Blocks Next if invalid.
- WhatsApp and LINE are optional below.

**Token flow:** `WizardState.telegramBotToken` → `StepReviewPayment` hatch POST → `wizard.ts HatchSchema.botToken` → provisioner.

**Pool tokens (61 available):** For Brent's personal agent fleet. Retrieve plaintext tokens via:
```
GET https://api.tigerclaw.io/admin/pool/tokens?limit=N
Authorization: Bearer <ADMIN_TOKEN>
```
Bulk retire unused tokens via `POST /admin/pool/retire-batch` with `{ ids: string[] }`.

---

## 11. Gemini Rate Limit Hardening (Phase 5 #15 — PR #71)

**`api/src/services/geminiGateway.ts`** — new standalone module:
- **Semaphore:** caps concurrent Gemini calls at `GEMINI_CONCURRENCY` (default: 10). Tunable via Cloud Run env var, no redeploy needed.
- **Exponential backoff:** retries 429/quota errors up to 3 times (~1s → ~2s → ~4s + jitter). Non-rate errors fail immediately.
- All 10 Gemini call sites across `ai.ts`, `factExtractor.ts`, `tiger_refine.ts`, `tiger_strike_draft.ts`, `queue.ts` now call `callGemini()`.
- Extracted from `ai.ts` to avoid circular import with tool files.

To tune: set `GEMINI_CONCURRENCY=20` in Cloud Run for high-throughput instances.

---

## 12. Infrastructure

### Cloud
| Service | Detail |
|---|---|
| API | `https://api.tigerclaw.io` — Cloud Run multi-region behind Global HTTPS LB |
| DB | Cloud SQL PostgreSQL HA `tiger_claw_shared` |
| GCP Project | `hybrid-matrix-472500-k5` |
| Wizard | `wizard.tigerclaw.io` — Next.js, Vercel, `web-onboarding/` |
| Website | `tigerclaw.io` — static, `tiger-bot-website/` submodule, deployed from `main` |
| Email outbound | Resend — `hello@tigerclaw.io`, `support@tigerclaw.io` |
| Email inbound | Postmark — `support@tigerclaw.io` → `/webhooks/email` |

### Local Mac Cluster
| Machine | IP | Role |
|---|---|---|
| Cheese Grater | 192.168.0.2 | Primary dev — offline Reflexion Loop tool + backup mine at 3 AM |
| Birdie | 192.168.0.136 | Standby |
| Monica | 192.168.0.138 | Compute node (standby) |
| iMac | 192.168.0.116 | — |
| MacBook Air | 192.168.0.237 | brents-2020-air.local |

**Mac cluster is an OFFLINE ops tool.** Never called by Cloud Run.

---

## 13. Key Secrets (GCP Secret Manager — never commit)

| Secret | Notes |
|---|---|
| `ADMIN_TOKEN` | `b1cb78d33181c705ec838cdfec06912922808a423ebabad056c39450ae84e69e` |
| `MAGIC_LINK_SECRET` | ⚠️ Verify it exists in GCP Secret Manager and is mounted in Cloud Run |
| `ENCRYPTION_KEY` | AES-256-GCM key for bot token encryption |
| `RESEND_API_KEY` | Outbound email |
| `STRIPE_SECRET_KEY` | Stan Store webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature |
| `TELEGRAM_WEBHOOK_SECRET` | Inbound webhook auth |
| `POSTMARK_WEBHOOK_TOKEN` | Inbound email auth |
| `GEMINI_CONCURRENCY` | Optional — defaults to 10. Set higher for wave demand. |

---

## 14. What's Next (Phase 4 in progress, Phase 5 open)

### Phase 4 — Activation (Brent's lane, in progress)
- John & Noon (LINE) — Brent contacting
- Toon (LINE) — Brent contacting
- Debbie (Telegram BYOB) — tomorrow (she's asleep, Spain)

### Phase 5 — Hardening for 50-seat release
- #13 Model-level circuit breaker — GEMINI task
- #14 Gemini unit economics — GEMINI task
- #15 Gemini rate limit hardening — ✅ DONE (PR #71, pending merge)
- #16 Activation playbook — BRENT + CLAUDE, next

### Phase 6 — Growth
See `STATE_OF_THE_TIGER_PATH_FORWARD.md` for full task list.

---

## 15. Known Issues

| Priority | Issue | Status |
|---|---|---|
| 🔴 CRITICAL | `MAGIC_LINK_SECRET` not confirmed mounted in Cloud Run | UNVERIFIED — Brent's lane |
| 🔴 HIGH | Full fire test (Stan Store → wizard → live BYOB bot) not done | NOT DONE — use `/admin/pool/tokens` + magic link |
| 🟡 MED | Welcome email says "bot in 60 seconds" — false for BYOB wizard flow | NOT FIXED |
| 🟡 MED | `DATABASE_READ_URL` pinned to secret version 8 (should be latest) | NOT FIXED |
| 🟡 LOW | Reddit scout returns 0 results (403 without OAuth) | NOT FIXED — needs TigerClaw-branded Reddit app |

---

## 16. Reliability Audit Findings Tracker

Full report: `specs/RELIABILITY_AUDIT.md`

| # | Finding | Status |
|---|---------|--------|
| 1 | Cron excluded 'onboarding' tenants | ✅ Fixed PR #67 |
| 2 | Stripe Redis idempotency failed open | ✅ Fixed PR #67 |
| 3 | LINE webhook errors swallowed silently | ✅ Fixed PR #67 |
| 4 | `resumeTenant()` ignored webhook response | ✅ Fixed PR #67 |
| 5 | setWebhook not called on onboarding → active | ✅ Fixed PR #67 |
| 6 | ICP validation missing before phase=complete | ✅ Fixed PR #67 |
| 7 | ICP confirmation empty profile guard | ✅ Fixed PR #67 |
| 8 | Telegram enqueue failure not alerted | ✅ Fixed PR #67 |
| 9 | Email webhook processes unknown senders | ✅ Fixed PR #67 |
| 10 | Status negation → explicit allowlist | ✅ Fixed PR #67 |
| 11 | SOUL.md written with — placeholders | ✅ Blocked by ICP guard (PR #67) |

---

*Last updated: 2026-03-29 23:45 UTC (Phases 1-3 complete; Phase 5 Task #13/#14 complete; Critical Item #3 fixed). Proceed.*
