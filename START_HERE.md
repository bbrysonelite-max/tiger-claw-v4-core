# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
Stop what you are doing. Read this entire document and `CLAUDE.md`. These are your injected directives. Do not ask Brent to repeat himself. Do not rely on hallucinated history.

---

## 1. The Current State of the Universe

**Tiger Claw is LIVE and fully deployed. CI is green. PRs #62–#67 merged. PRs #68 & #70 open.**
- **Timestamp:** 2026-03-29 23:45 UTC
- **API:** `https://api.tigerclaw.io` — Cloud Run `tiger-claw-api`, multi-region (us-central1 + asia-southeast1)
- **Load Balancer:** Global HTTPS LB at `34.54.146.69` — both regions behind Anycast IP
- **Architecture:** V4 Stateless Serverless — one API process, all tenants, context resolved per-request
- **Database:** PostgreSQL HA via Cloud SQL Proxy (`tiger_claw_shared`)
- **Cache/Queue:** Redis HA + BullMQ (8 queues)
- **AI Engine:** Gemini 2.0 Flash (LOCKED — `gemini-2.5-flash` has a GCP function-calling bug, do not use it)
- **Tests:** 396 passing (Verified on main and PR #70)
- **Flavors:** 15 customer-facing industry flavors, all with full field set including scoutQueries
- **Min-instances:** 1 — no cold start
- **Data Refinery:** v5 pipeline FULLY AUTONOMOUS — fires nightly at 2 AM UTC via BullMQ.
- **Circuit Breaker:** LIVE — auto-failover to OpenRouter after 3 Gemini failures.
- **Economics:** INSTRUMENTED — per-tenant API call tracking live in Redis.

**Strict Rule 1:** OpenClaw, Mini-RAG, and per-tenant Docker containers are DEAD. Do not reference or restore them.

**Strict Rule 2:** `main` is branch-protected. NEVER push directly. Always use `feat/` branches and `gh pr create`.

**Strict Rule 3:** Read `CLAUDE.md` before writing any code. Non-negotiable product and engineering directives.

**Strict Rule 4:** Anthropic is NOT wired. Do not add it back without implementing the full `@anthropic-ai/sdk` code path in `api/src/services/ai.ts`. Deferred to Sprint 2.

**Strict Rule 5:** 5-instance cap in effect until ~2026-04-03. Do not bulk-activate the founding member cohort before that date.

**Strict Rule 6:** BYOB PIVOT is in effect. Bot pool is removed from the provisioning path. Telegram tenants bring their own token. See `STATE_OF_THE_TIGER_PATH_FORWARD.md`.

---

## 2. What Has Been Accomplished (Full History)

1. **V4 Stateless Architecture** — Cloud Run API, shared PostgreSQL, Redis, BullMQ.
2. **18 Native Function Calling Tools** — `api/src/tools/`. All tests passing.
3. **Business Model: Card Upfront** — No free trial. Stan Store checkout. 7-day MBG.
4. **Multi-Provider AI** — Google, OpenAI, Grok, OpenRouter, Kimi. Anthropic deferred to Sprint 2.
5. **Memory Architecture V4.1** — `buildSystemPrompt()` is async. Sawtooth compression, fact anchors, hive signals, focus primitives. PRs #20–#24, merged.
6. **Value-Gap Detection Cron** — 9 AM UTC daily. Active/onboarding tenant, zero leads in 3 days → diagnostic message to operator. PR #26.
7. **Email Infrastructure** — Resend (outbound), Postmark (inbound support). `hello@tigerclaw.io`, `support@tigerclaw.io` live.
8. **Email Support Agent** — PR #45: Postmark → BullMQ → AI → Resend reply.
9. **Admin Dashboard** — `wizard.tigerclaw.io/admin/dashboard`. Bearer token auth. Fleet management, bot pool health.
10. **Beta Hardening** — ADMIN_TOKEN rotated, Telegram webhook secret, dead trial code removed. PRs #41–#44.
11. **Stan Store Webhook** — `POST /webhooks/stripe` provisions user + pending bot + sends magic link email. Idempotent via Redis.
12. **Zoom Call 2026-03-27** — Went well. Post-call: 5-instance cap, 7-day observation window.
13. **SWOT Analysis completed** — 6 weaknesses identified, all 6 fixed.
14. **15 Flavors** — 3 new niches added (dorm-design, mortgage-broker, personal-trainer). scoutQueries added to all 15.
15. **Multi-Region Deploy** — asia-southeast1 added. Global HTTPS LB at 34.54.146.69. SSL cert ACTIVE. PR #53.
16. **v5 Data Refinery ACTIVATED** — `tiger_refine.ts` replaced mock with real Gemini extraction. PR #56.
17. **Autonomous Mining Cron** — `miningQueue` + `miningWorker` + `market_miner.ts`. Fires 2 AM UTC daily. PR #57.
18. **Webhook Rate Limiting** — 60 req/min per tenant, 20/min per IP email. PR #49.
19. **HMAC Magic Links** — `MAGIC_LINK_SECRET`-signed, 72h TTL. PR #50.
20. **CI Type Fixes** — All TypeScript errors post-merge resolved (types.ts, 9 files). PRs #54, #55.
21. **ICP Null Guard** — `tiger_scout.ts` crash on `idealPerson` undefined fixed. PR #60.
22. **Double JSON.parse Fix** — `queue.ts` and `ai.ts` were wrapping already-parsed JSONB. PR #61.
23. **Tiger Strike Tools** — `tiger_strike_draft/engage/harvest.ts` committed (were missing, blocked CI).
24. **First-Lead Email** — `sendFirstLeadNotification()` in email.ts; tiger_scout sends email to tenant when first leads arrive.
25. **Wizard Auth Fix** — Magic link `token`/`expires` now flow through `page.tsx` → `OnboardingModal` → `StepIdentity` → `/wizard/auth`. PR #62.
26. **Safe Gemini Text Extraction + KeyState Fix** — PR #63.
27. **Conversation Counter** — `GET /admin/conversations` endpoint. Per-tenant 24h + today message counts via Redis `msg_count:{tenantId}:{YYYYMMDD}` keys. Dashboard stat card + expanded row detail. PR #66.
28. **Feedback Loop LINE Fix** — `processSystemRoutine()` now delivers `weekly_checkin`, `feedback_reminder`, `feedback_pause` to LINE tenants via LINE push API. `getTenantLineUserIds()` extracts non-integer Redis key suffixes. PR #66.
29. **Reliability Audit** — `specs/RELIABILITY_AUDIT.md` — 4 CRITICAL, 7 HIGH, 3 MED findings. PR #66.
30. **Reliability Hardening** — 5 critical/high findings fixed: cron 'onboarding' status gap, Stripe Redis fail-closed, LINE webhook alert, resumeTenant response check, setWebhook on activation. PR #67.
31. **BYOB Pivot (Task #8 & #9)** — Bot pool stripped from provisioning path. Telegram BYOB wizard step added with real-time validation. PR #68.
32. **GCP Infrastructure Audit** — Verified multi-region health, SSL certs, Gemini quotas, and identified Redis persistence/eviction risks.
33. **MAGIC_LINK_SECRET Secured** — Created in GCP Secret Manager and mounted in both Cloud Run regions. Verified end-to-end.
34. **Gemini Circuit Breaker (Task #13)** — 3 consecutive 429/5xx errors trigger 1-hour failover to OpenRouter. PR #70.
35. **AI Unit Economics (Task #14)** — Instrumented tool loop to track per-tenant and platform-wide API call counts in Redis. PR #70.
36. **Secret Pinning Fix** — Unpinned DATABASE_READ_URL from version 8; now uses latest in all regions.

---

## 3. SWOT Weakness Fix Status (ALL RESOLVED)

| # | Weakness | Status | PR |
|---|---|---|---|
| 1 | No rate limiting on webhooks | ✅ Fixed | #49 |
| 2 | Magic links unsigned | ✅ Fixed | #50 |
| 3 | Birdie cron not running | ✅ Fixed | Mine now runs in Cloud Run (no Birdie dependency) |
| 4 | 3 missing flavor niches | ✅ Fixed | #51 |
| 5 | Thin data volume / Refinery undeployed | ✅ Fixed | #52, #56, #57 — 313 facts on first run |
| 6 | Single-region (us-central1 only) | ✅ Fixed | #53 |

---

## 4. Open PRs (Pending Review/Merge)

| PR | Branch | Description |
|----|--------|-------------|
| #66 | `feat/reliability-hardening` | Conversation counter + feedback loop LINE fix + reliability audit |
| #67 | `feat/reliability-fixes-p2` | 4 CRITICAL + 2 HIGH reliability fixes from audit |

**Wizard Auth is FIXED (PR #62 merged).** The full magic link flow (page.tsx → OnboardingModal → StepIdentity → `/wizard/auth`) is working. Verify `MAGIC_LINK_SECRET` exists in GCP Secret Manager and do a full fire test before demo.

**Two pending manual steps:**

1. Verify `MAGIC_LINK_SECRET` exists in GCP Secret Manager AND is mounted in Cloud Run:
```bash
gcloud secrets describe tiger-claw-magic-link-secret --project hybrid-matrix-472500-k5
```

2. **Fire test required** — Walk the full Stan Store → magic link → wizard → live bot flow as a real paying customer before any more customers are sent to the platform.

---

## 5. Multi-Region Architecture

| Component | Detail |
|---|---|
| Primary region | `us-central1` |
| Secondary region | `asia-southeast1` (Singapore) — for Thai customers |
| Load Balancer IP | `34.54.146.69` (Anycast) |
| DNS | `api.tigerclaw.io A → 34.54.146.69` (Porkbun) |
| SSL cert | `tiger-claw-lb-cert` — managed, ACTIVE |
| VPC | `tiger-claw-vpc` — BGP routing GLOBAL (cross-region Redis/SQL access) |
| VPC connector SEA | `tiger-claw-connector-sea` (10.8.1.0/28) |
| CI variable | `MULTI_REGION_READY=true` — deploys both regions on every merge to main |
| Setup script | `ops/setup-multi-region.sh` — run once, already done |

asia-southeast1 health confirmed 2026-03-27: uptime 12h, PostgreSQL/Redis/pool all green, 22ms response time.

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
| `chat_history:{tenantId}:{chatId}` | Raw turn history (Telegram integer chatId or LINE string userId) | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Sawtooth compressed summaries | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending | 24 hours |
| `msg_count:{tenantId}:{YYYYMMDD}` | Per-tenant daily message exchange counter | 48 hours |

---

## 7. v5 Data Refinery (Fully Autonomous)

**Pipeline:** BullMQ `miningWorker` (2 AM UTC) → `market_miner.ts` → Reddit JSON API → `POST /mining/refine` → Gemini 2.0 Flash extraction → `market_intelligence` table (120-day decay)

**Key files:**
- `api/src/services/market_miner.ts` — mining orchestration, walks all 15 flavors
- `api/src/tools/tiger_refine.ts` — Gemini extraction engine (real, not mock)
- `api/src/routes/mining.ts` — `POST /mining/refine` endpoint
- `api/src/services/market_intel.ts` — DB schema, `saveMarketFact()`, `isAlreadyMined()`
- `api/scripts/reddit_scout.mjs` — standalone script (for manual runs or Cheese Grater backup)

**Schedules:**
| Scheduler | Time | Role |
|---|---|---|
| BullMQ `miningWorker` in Cloud Run | 2 AM UTC | Primary — autonomous, no hardware dependency |
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

---

## 9. Tenant Roster (Active)

| Slug | Email | Status | Notes |
|---|---|---|---|
| `debbie-cameron` | justagreatdirector@outlook.com | live | Founding member |
| `john-thailand` | vijohn@hotmail.com | live | Founding member — John + Noon (Thailand) |
| `chana-loha` | chana.loh@gmail.com | live | Founding member — Chana |
| `phaitoon` | phaitoon2010@gmail.com | live | Founding member — Toon (Thailand); scout functional, 23h cooldown |

Cron heartbeat confirms 11 total active tenants (includes additional members not listed above by slug). All processing clean on revision 00115 as of 2026-03-28.

**5-instance cap active until ~2026-04-03.** Do not activate more tenants before then.

**7 past customers** (paid, never received service) — preserved for complimentary re-activation outreach ~2026-04-03.

---

## 10. BYOB Pivot (In Effect)

**Telegram pool is removed from the provisioning path.** No new tenant will be assigned a pool token.

- Telegram tenants: create their own bot via @BotFather, paste token in wizard → Tiger Claw calls `getMe`, `setWebhook`, encrypts and stores.
- LINE tenants: already BYOB. Pattern exists in `StepChannelSetup.tsx`.
- BYOK AI keys: all tenants bring their own (already built).

**Phase 3 tasks (next):**
- Task #8 — Remove pool assignment from Stan Store webhook and provisioning flow (`pool.ts` kept for token storage)
- Task #9 — Add Telegram BYOB to wizard (mirror LINE pattern in `StepChannelSetup.tsx`)

**Current founding members** are being migrated to BYOB personally by Brent.

---

## 11. Infrastructure

### Cloud
| Service | Detail |
|---|---|
| API | `https://api.tigerclaw.io` — Cloud Run multi-region behind Global HTTPS LB |
| DB | Cloud SQL PostgreSQL HA `tiger_claw_shared` |
| GCP Project | `hybrid-matrix-472500-k5` |
| Wizard | `wizard.tigerclaw.io` — Next.js, Vercel, `web-onboarding/` |
| Website | `tigerclaw.io` — static, Vercel, `tiger-bot-website/` |
| Email outbound | Resend — `hello@tigerclaw.io`, `support@tigerclaw.io` |
| Email inbound | Postmark — `support@tigerclaw.io` → `/webhooks/email` |

### Local Mac Cluster
| Machine | IP | Role |
|---|---|---|
| Cheese Grater | 192.168.0.2 | Primary dev — offline Reflexion Loop tool + backup mine at 3 AM |
| Birdie | 192.168.0.136 | Available — mining now runs in Cloud Run, Birdie is standby |
| Monica | 192.168.0.138 | Compute node (standby) |
| iMac | 192.168.0.116 | — |
| MacBook Air | 192.168.0.237 | brents-2020-air.local |

**Mac cluster is an OFFLINE ops tool.** Never called by Cloud Run.

### Cheese Grater LaunchAgents
| Label | Schedule | Log |
|---|---|---|
| `io.tigerclaw.market-miner` | Daily 3 AM local | `/Users/brentbryson/Tigerclaw-Anti_Gravity/tiger-claw/logs/market_mining.log` |

---

## 12. Key Secrets (GCP Secret Manager — never commit)

| Secret | Notes |
|---|---|
| `ADMIN_TOKEN` | `b1cb78d33181c705ec838cdfec06912922808a423ebabad056c39450ae84e69e` |
| `MAGIC_LINK_SECRET` | ⚠️ Verify it exists in GCP Secret Manager and is mounted in Cloud Run |
| `RESEND_API_KEY` | Outbound email |
| `STRIPE_SECRET_KEY` | Stan Store webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature |
| `TELEGRAM_WEBHOOK_SECRET` | Inbound webhook auth |
| `POSTMARK_WEBHOOK_TOKEN` | Inbound email auth |

---

## 13. Sprint 2 / Phase 3 (Starting ~2026-04-03)

### Immediate (Phase 3 — BYOB Pivot)
1. **Task #8** — Remove bot pool from provisioning path (strip pool assignment from Stan Store webhook + provisioner; keep `pool.ts` for token storage)
2. **Task #9** — Add Telegram BYOB to wizard (mirror LINE pattern; `getMe` validation, AES-256-GCM storage, `setWebhook` call)

### Sprint 2 (Starting ~2026-04-03)
1. **Anthropic SDK** — wire `@anthropic-ai/sdk` in `api/src/services/ai.ts`
2. **Reflexion Loop** — offline Cheese Grater tool for self-improvement
3. **Bot pool replenishment** — needs physical SIMs + BotFather (hardware-limited)
4. **Outreach to 7 past customers** — complimentary re-activation offer (~2026-04-03)
5. **Feedback loop fix (P1)** — ✅ DONE (PR #66) — LINE tenants now receive feedback routines
6. **Reddit OAuth2** — TigerClaw-branded Reddit app credentials needed for scout (403 without OAuth); NOT personal credentials. Paused pending app registration.

---

## 14. Known Issues

| Priority | Issue | File | Status |
|---|---|---|---|
| 🔴 CRITICAL | `MAGIC_LINK_SECRET` not confirmed in Cloud Run env | GCP Secret Manager | UNVERIFIED |
| 🔴 HIGH | Fire test not done — full Stan Store→bot flow untested | — | NOT DONE |
| 🟡 MED | Welcome email says "bot in 60 seconds" — false promise | `email.ts:sendStanStoreWelcome` | NOT FIXED |
| 🟡 MED | Wizard shows spinner then timeout when provisioning stalls — no real error message | `OnboardingModal.tsx` | NOT FIXED |
| 🟡 MED | `DATABASE_READ_URL` pinned to secret version 8 (should be latest) | GCP Secret Manager | NOT FIXED |
| 🟡 LOW | Reddit scout returns 0 results (403 without OAuth) | `tiger_scout.ts` | NOT FIXED |
| 🟡 MED | ICP validation missing before `phase="complete"` in onboarding | `tiger_onboard.ts:794` | NOT FIXED — Phase 3 |

---

## 15. Reliability Audit Findings Tracker

Full report: `specs/RELIABILITY_AUDIT.md`

| # | Finding | Status |
|---|---------|--------|
| 1 | Cron excluded 'onboarding' tenants | ✅ Fixed PR #67 |
| 2 | Stripe Redis idempotency failed open | ✅ Fixed PR #67 |
| 3 | LINE webhook errors swallowed silently | ✅ Fixed PR #67 |
| 4 | `resumeTenant()` ignored webhook response | ✅ Fixed PR #67 |
| 5 | setWebhook not called on onboarding → active | ✅ Fixed PR #67 |
| 6 | ICP validation missing before phase=complete | 🔴 Open — Phase 3 |
| 7 | Webhook status negation vs allowlist | 🟡 Open — cosmetic |
| 8+ | Other MED findings | 🟡 Open — Sprint 2 |

---

*Last updated: 2026-03-29 23:45 UTC (Phase 1-3 complete; Phase 5 Task #13/#14 complete — PR #70). Proceed.*
<!-- CI refresh -->
