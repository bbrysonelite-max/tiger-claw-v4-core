# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
Stop what you are doing. Read this entire document and `CLAUDE.md`. These are your injected directives. Do not ask Brent to repeat himself. Do not rely on hallucinated history.

---

## 1. The Current State of the Universe

**Tiger Claw is LIVE and fully deployed. CI is green. All PRs merged.**
- **API:** `https://api.tigerclaw.io` — Cloud Run `tiger-claw-api`, multi-region (us-central1 + asia-southeast1)
- **Load Balancer:** Global HTTPS LB at `34.54.146.69` — both regions behind Anycast IP
- **Architecture:** V4 Stateless Serverless — one API process, all tenants, context resolved per-request
- **Database:** PostgreSQL HA via Cloud SQL Proxy (`tiger_claw_shared`)
- **Cache/Queue:** Redis HA + BullMQ (8 queues)
- **AI Engine:** Gemini 2.0 Flash (LOCKED — `gemini-2.5-flash` has a GCP function-calling bug, do not use it)
- **Tests:** All passing (CI green as of 2026-03-27)
- **Flavors:** 15 customer-facing industry flavors, all with full field set including scoutQueries
- **Min-instances:** 1 — no cold start
- **Data Refinery:** v5 pipeline FULLY AUTONOMOUS — fires nightly at 2 AM UTC via BullMQ. First run: 313 facts saved across 14 flavors.

**Strict Rule 1:** OpenClaw, Mini-RAG, and per-tenant Docker containers are DEAD. Do not reference or restore them.

**Strict Rule 2:** `main` is branch-protected. NEVER push directly. Always use `feat/` branches and `gh pr create`.

**Strict Rule 3:** Read `CLAUDE.md` before writing any code. Non-negotiable product and engineering directives.

**Strict Rule 4:** Anthropic is NOT wired. Do not add it back without implementing the full `@anthropic-ai/sdk` code path in `api/src/services/ai.ts`. Deferred to Sprint 2.

**Strict Rule 5:** 5-instance cap in effect until ~2026-04-03. Do not bulk-activate the founding member cohort before that date.

---

## 2. What Has Been Accomplished (Full History)

1. **V4 Stateless Architecture** — Cloud Run API, shared PostgreSQL, Redis, BullMQ.
2. **18 Native Function Calling Tools** — `api/src/tools/`. All tests passing.
3. **Business Model: Card Upfront** — No free trial. Stan Store checkout. 7-day MBG.
4. **Multi-Provider AI** — Google, OpenAI, Grok, OpenRouter, Kimi. Anthropic deferred to Sprint 2.
5. **Memory Architecture V4.1** — `buildSystemPrompt()` is async. Sawtooth compression, fact anchors, hive signals, focus primitives. PRs #20–#24, merged.
6. **Value-Gap Detection Cron** — 9 AM UTC daily. Active tenant, zero leads in 3 days → diagnostic message to operator. PR #26.
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
22. **Double JSON.parse Fix** — `queue.ts` and `ai.ts` were wrapping already-parsed JSONB with `JSON.parse()` → `SyntaxError: "[object Object]" is not valid JSON` every cron minute for all tenants. Fixed. PR #61.
23. **Tiger Strike Tools** — `tiger_strike_draft.ts`, `tiger_strike_engage.ts`, `tiger_strike_harvest.ts` committed directly (were imported by ai.ts but absent from repo → blocked all CI builds).
24. **First-Lead Email** — `sendFirstLeadNotification()` in email.ts; tiger_scout sends email to tenant when first qualified leads arrive.
25. **Incident Log** — `specs/INCIDENT_LOG.md` created, INC-001 through INC-004 documented.

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

## 4. Open PRs

**None.** All PRs through #61 merged. `main` is clean and deployed. Current revision: `00115`.

**⚠️ CRITICAL UNFINISHED FIX — Wizard Magic Link Auth (BLOCKING every paying customer):**

`page.tsx` was discarding `token` and `expires` from magic link URL params. API `/wizard/auth` requires all three and returns 401 without them — blocking Stan Store customers from reaching their bots. **Fix is partially complete:**
- ✅ `web-onboarding/src/app/page.tsx` — now extracts and passes `magicToken`/`magicExpires` to OnboardingModal
- ❌ `web-onboarding/src/components/OnboardingModal.tsx` — NOT YET updated to accept+pass props
- ❌ `web-onboarding/src/components/wizard/StepIdentity.tsx` — NOT YET updated to include token/expires in `/wizard/auth` request

**This must be the first thing fixed in the next session before any customer-facing work.**

**Two pending manual steps:**

1. Verify `MAGIC_LINK_SECRET` exists in GCP Secret Manager AND is mounted in Cloud Run:
```bash
gcloud secrets describe tiger-claw-magic-link-secret --project hybrid-matrix-472500-k5
# If missing:
echo -n "$(openssl rand -hex 32)" | gcloud secrets create tiger-claw-magic-link-secret \
  --data-file=- --project hybrid-matrix-472500-k5
# Then add to SECRETS in ops/deploy-cloudrun.sh and redeploy
```

2. **Fire test required** — Walk the full Stan Store → magic link → wizard → live bot flow as a real paying customer before any more customers are sent to the platform. The 2026-03-28 demo with hundreds of people failed completely (wizard auth 401, Stan Store flow untested). Do not send anyone to the platform until this passes.

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
| `chat_history:{tenantId}:{chatId}` | Raw turn history | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Sawtooth compressed summaries | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending | 24 hours |

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

**Manual run:**
```bash
TIGER_CLAW_API_URL=https://api.tigerclaw.io node api/scripts/reddit_scout.mjs
```

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
| `phaitoon` | phaitoon2010@gmail.com | live | Founding member — Toon (Thailand); scout functional, 23h cooldown; first-lead email will fire when leads arrive |

Cron heartbeat confirms 11 total active tenants (includes additional members not listed above by slug). All processing clean on revision 00115 as of 2026-03-28.

**5-instance cap active until ~2026-04-03.** Do not activate more tenants before then.

**7 past customers** (paid, never received service) — preserved for complimentary re-activation outreach ~2026-04-03.

---

## 10. Infrastructure

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

## 11. Key Secrets (GCP Secret Manager — never commit)

| Secret | Notes |
|---|---|
| `ADMIN_TOKEN` | `b1cb78d33181c705ec838cdfec06912922808a423ebabad056c39450ae84e69e` |
| `MAGIC_LINK_SECRET` | ⚠️ Verify it exists in GCP Secret Manager (see Section 4) |
| `RESEND_API_KEY` | Outbound email |
| `STRIPE_SECRET_KEY` | Stan Store webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature |
| `TELEGRAM_WEBHOOK_SECRET` | Inbound webhook auth |
| `POSTMARK_WEBHOOK_TOKEN` | Inbound email auth |

---

## 12. Sprint 2 (Starting ~2026-04-03)

1. **Anthropic SDK** — wire `@anthropic-ai/sdk` in `api/src/services/ai.ts`
2. **Reflexion Loop** — offline Cheese Grater tool for self-improvement
3. **Bot pool replenishment** — needs physical SIMs + BotFather (hardware-limited)
4. **Outreach to 7 past customers** — complimentary re-activation offer (~2026-04-03)
5. **Feedback loop fix (P1)** — `processSystemRoutine()` doesn't handle `weekly_checkin`, `feedback_reminder`, `feedback_pause` — silent failure
6. **Reddit OAuth2** — TigerClaw-branded Reddit app credentials needed for scout (403 without OAuth); NOT personal credentials. Paused pending app registration.

---

## 13. Known Issues (Must Fix Before Next Demo)

| Priority | Issue | File | Status |
|---|---|---|---|
| 🔴 CRITICAL | Wizard auth broken — token/expires not passed to API | `OnboardingModal.tsx`, `StepIdentity.tsx` | PARTIAL (page.tsx done, modal+step NOT done) |
| 🔴 CRITICAL | `MAGIC_LINK_SECRET` not confirmed in Cloud Run env | GCP Secret Manager | UNVERIFIED |
| 🔴 HIGH | Fire test not done — full Stan Store→bot flow untested | — | NOT DONE |
| 🟡 MED | Welcome email says "bot in 60 seconds" — false promise | `email.ts:sendStanStoreWelcome` | NOT FIXED |
| 🟡 MED | Wizard shows spinner then timeout when provisioning stalls — no real error message | `OnboardingModal.tsx` | NOT FIXED |
| 🟡 MED | `DATABASE_READ_URL` pinned to secret version 8 (should be latest) | GCP Secret Manager | NOT FIXED |
| 🟡 LOW | Reddit scout returns 0 results (403 without OAuth) | `tiger_scout.ts` | NOT FIXED |

---

*Last updated: 2026-03-28 (post-demo incident audit — PRs #58-#61 merged, wizard auth bug discovered, 11 tenants clean on revision 00115). CRITICAL WORK REQUIRED BEFORE NEXT DEMO. Proceed.*
