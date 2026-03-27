# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
Stop what you are doing. Read this entire document and `CLAUDE.md`. These are your injected directives. Do not ask Brent to repeat himself. Do not rely on hallucinated history.

---

## 1. The Current State of the Universe

**Tiger Claw is LIVE on Google Cloud Run (`https://api.tigerclaw.io`).**

- **Architecture:** V4 Stateless Serverless — one API process, all tenants, context resolved per-request
- **Database:** PostgreSQL HA via Cloud SQL Proxy (`tiger_claw_shared`)
- **Cache/Queue:** Redis HA + BullMQ (7 queues: provision, telegram, line, email-support, fact-extraction, ai-routines, global-cron)
- **AI Engine:** Gemini 2.0 Flash (LOCKED — `gemini-2.5-flash` has a GCP function-calling bug, do not use it)
- **Tests:** 377/377 passing
- **Flavors:** 13 customer-facing industry flavors
- **Min-instances:** 1 — no cold start
- **Data Refinery:** v5 pipeline live on Birdie — scout runs every 6h

**Strict Rule 1:** OpenClaw, Mini-RAG, and per-tenant Docker containers are DEAD. Do not reference or restore them.

**Strict Rule 2:** `main` is branch-protected. NEVER push directly. Always use `feat/` branches and `gh pr create`.

**Strict Rule 3:** Read `CLAUDE.md` before writing any code. Non-negotiable product and engineering directives.

**Strict Rule 4:** Anthropic is NOT wired. Do not add it back without implementing the full `@anthropic-ai/sdk` code path in `api/src/services/ai.ts`. Deferred to Sprint 2.

**Strict Rule 5:** 5-instance cap in effect until ~2026-04-03. Do not bulk-activate the founding member cohort before that date.

---

## 2. What Has Been Accomplished (Full History)

1. **V4 Stateless Architecture** — Cloud Run API, shared PostgreSQL, Redis, BullMQ.
2. **18 Native Function Calling Tools** — `api/src/tools/`. 377 passing tests.
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
13. **SWOT Analysis completed** — 6 weaknesses identified. 5 of 6 fixed in post-Zoom sprint.
14. **Birdie Scout Node** — LaunchAgent installed. Runs `reddit_scout.mjs` every 6h against production API.
15. **13 Flavors** — 3 new niches added (dorm-design, mortgage-broker, personal-trainer). scoutQueries added to all 13.

---

## 3. SWOT Weakness Fix Status (Post-Zoom Sprint)

| # | Weakness | Status | PR |
|---|---|---|---|
| 1 | No rate limiting on webhooks | ✅ Fixed | #49 (open — merge) |
| 2 | Magic links unsigned | ✅ Fixed | #50 (open — merge) |
| 3 | Birdie cron not running | ✅ Fixed | LaunchAgent on Birdie (live) |
| 4 | 3 missing flavor niches | ✅ Fixed | #51 (open — merge) |
| 5 | Thin data volume / Refinery undeployed | ✅ Fixed | #52 (open — merge after #48) |
| 6 | Single-region (us-central1 only) | 🔲 Pending | — |

---

## 4. Open PRs — Merge in This Order

| PR | Branch | What | Notes |
|---|---|---|---|
| **#48** | `feat/migration-017-market-intel` | Migration 017 — `market_intelligence` table | **Merge first** |
| **#49** | `feat/webhook-rate-limiting` | Webhook rate limits 60/min tenant, 20/min email | After #48 |
| **#50** | `feat/hmac-magic-links` | HMAC magic links 72h TTL, `GET /admin/magic-link` | After #48 |
| **#51** | `feat/three-new-flavors` | dorm-design, mortgage-broker, personal-trainer | After #48 |
| **#52** | `feat/data-refinery-pipeline` | `/flavors` + `/mining/refine` + scoutQueries all flavors | After #48 |

After merging #50: add `MAGIC_LINK_SECRET` to GCP Secret Manager.

---

## 5. Memory Architecture (V4.1 — Fully Shipped)

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

## 6. Product

| Product | Price |
|---|---|
| Tiger-Claw Pro (Pre-Flavored) | $147/mo |
| Industry Agent | $197/mo |

**13 Customer-Facing Flavors:** network-marketer, real-estate, health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger, dorm-design, mortgage-broker, personal-trainer.

Doctor removed — healthcare compliance risk. Do not re-add it.

---

## 7. Tenant Roster (Active)

| Slug | Email | Status | Notes |
|---|---|---|---|
| `debbie-cameron` | justagreatdirector@outlook.com | live | Founding member |
| `john-thailand` | vijohn@hotmail.com | live | Founding member — John + Noon (Thailand) |
| `chana-loha` | chana.loh@gmail.com | live | Founding member — Chana |

**5-instance cap active until ~2026-04-03.** Do not activate more tenants before then.

**7 past customers** (paid, never received service) — preserved for post-observation-window complimentary outreach.

---

## 8. Infrastructure

### Cloud
| Service | Detail |
|---|---|
| API | `https://api.tigerclaw.io` — Cloud Run `tiger-claw-api` `us-central1` |
| DB | Cloud SQL PostgreSQL HA `tiger_claw_shared` |
| GCP Project | `hybrid-matrix-472500-k5` |
| Wizard | `wizard.tigerclaw.io` — Next.js, Vercel, `web-onboarding/` |
| Website | `tigerclaw.io` — static, Vercel, `tiger-bot-website/` |
| Email outbound | Resend — `hello@tigerclaw.io`, `support@tigerclaw.io` |
| Email inbound | Postmark — `support@tigerclaw.io` → `/webhooks/email` |

### Local Mac Cluster
| Machine | IP | Role |
|---|---|---|
| Cheese Grater | 192.168.0.2 | Primary dev — offline Reflexion Loop tool |
| Birdie | 192.168.0.136 | Scout node — reddit_scout every 6h |
| Monica | 192.168.0.138 | Compute node (standby) |
| iMac | 192.168.0.116 | — |
| MacBook Air | 192.168.0.237 | brents-2020-air.local |

**Birdie SSH:** `ssh -i ~/.ssh/trashcan birdie@192.168.0.136`

**Mac cluster is an OFFLINE ops tool.** Never called by Cloud Run.

### Birdie LaunchAgents
| Label | Schedule | Log |
|---|---|---|
| `com.birdie.heartbeat` | Daily midnight | `/Users/birdie/.openclaw/logs/heartbeat.log` |
| `com.birdie.scout` | Every 6 hours | `/Users/birdie/logs/scout.log` |

---

## 9. Key Secrets (GCP Secret Manager — never commit)

| Secret | Notes |
|---|---|
| `ADMIN_TOKEN` | `b1cb78d33181c705ec838cdfec06912922808a423ebabad056c39450ae84e69e` |
| `MAGIC_LINK_SECRET` | Set separately — needed after PR #50 merges |
| `RESEND_API_KEY` | Outbound email |
| `STRIPE_SECRET_KEY` | Stan Store webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature |
| `TELEGRAM_WEBHOOK_SECRET` | Inbound webhook auth |
| `POSTMARK_WEBHOOK_TOKEN` | Inbound email auth |

---

## 10. Remaining Work

### Immediate
1. Merge #48 → #49, #50, #51, #52 (in order)
2. Set `MAGIC_LINK_SECRET` in GCP Secret Manager after #50 deploys
3. Verify `/Users/birdie/logs/scout.log` shows `✅ Purified facts` after #52 deploys

### Weakness #6 (next session)
- Add `asia-southeast1` region to Cloud Run for Thai customers

### Sprint 2
- Anthropic SDK support
- Reflexion Loop on Cheese Grater
- Bot pool replenishment (needs physical SIMs + BotFather)
- Post-observation-window outreach to 7 past customers (~2026-04-03)

---

*Last updated: 2026-03-27 (post-Zoom sprint). Locked. Proceed.*
