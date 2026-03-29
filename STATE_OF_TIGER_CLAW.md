# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp:** 2026-03-29 (post-Circuit Breaker implementation — revision 00115)
**Infrastructure Status:** LIVE. Multi-region. Cron clean. PRs #66 + #67 merged. PRs #68 + #70 open.
**⚠️ See open PRs section below before starting any new work.**

---

## MANDATORY DIRECTIVE TO ALL AI AGENTS

This is the single source of truth for the Tiger Claw repository.

1. **NO RAG.** Mini-RAG physically removed. Does not exist.
2. **NO OPENCLAW.** No per-tenant Docker containers. Dead.
3. **NO CANARIES.** Deprecated.
4. **NO FREE TRIAL.** Card charged at Stan Store checkout. 7-day MBG. `trialExpired` removed.
5. **ARCHITECTURE:** Stateless Cloud Run, Gemini 2.0 Flash (locked), 18 tools, shared PostgreSQL.
6. **NO REWRITES:** All tests pass. Do not rewrite architecture.
7. **15 FLAVORS:** network-marketer, real-estate, health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger, researcher, interior-designer, dorm-design, mortgage-broker, personal-trainer. Doctor removed.
8. **PROTOCOL:** Read `CLAUDE.md` before writing any code.
9. **AI PROVIDERS:** Google, OpenAI, Grok, OpenRouter, Kimi. Anthropic absent — Phase 5.
10. **5-INSTANCE CAP:** Until ~2026-04-03. Do not bulk-activate more tenants.
11. **BYOB PIVOT:** Bot pool removed from provisioning path. All new Telegram tenants bring their own token via wizard. `pool.ts` retained for encryption only.
12. **OPEN PRs:** PRs #68 and #70 are pending review. Do not re-implement their changes. PR #66 and #67 are merged.
13. **HARDENING:** Model-level circuit breaker for Gemini + AI unit economics tracking implemented and verified (PR #70). Unpinned DATABASE_URL (Task #3 fixed).

---

## GIT PROTOCOL — NON-NEGOTIABLE

Never push directly to main. Always `feat/` branch + `gh pr create`.

```bash
git checkout -b feat/your-description
# make changes, run tests (npm test)
git push origin feat/your-description
gh pr create --title "feat: description" --body "what and why"
```

Cloud Run deploys automatically on merge to main via GitHub Actions (both regions).

---

## Current State (2026-03-29)

### Core Infrastructure
| Service | Detail |
|---|---|
| API | Cloud Run `tiger-claw-api` multi-region → `https://api.tigerclaw.io` |
| Regions | us-central1 (primary) + asia-southeast1 (Singapore) |
| Load Balancer | Global HTTPS LB — Anycast IP `34.54.146.69` |
| DNS | `api.tigerclaw.io A → 34.54.146.69` (Porkbun) |
| SSL | `tiger-claw-lb-cert` — managed, ACTIVE |
| DB | Cloud SQL PostgreSQL HA `tiger_claw_shared` |
| Cache/Queue | Cloud Redis HA + BullMQ (8 queues) |
| AI | Gemini 2.0 Flash via `@google/generative-ai` (locked) |
| Wizard | `wizard.tigerclaw.io` — Next.js Vercel `web-onboarding/` |
| Website | `tigerclaw.io` — static Vercel `tiger-bot-website/` |
| Email out | Resend `hello@tigerclaw.io` `support@tigerclaw.io` |
| Email in | Postmark `support@tigerclaw.io` → `/webhooks/email` |
| GCP Project | `hybrid-matrix-472500-k5` |

### Multi-Region Setup
| Component | Detail |
|---|---|
| VPC | `tiger-claw-vpc` BGP routing GLOBAL |
| Subnet SEA | `tiger-claw-subnet-sea` (10.10.1.0/24) |
| Connector SEA | `tiger-claw-connector-sea` (10.8.1.0/28) |
| NEGs | `tiger-claw-api-neg-us` + `tiger-claw-api-neg-sea` |
| Backend | `tiger-claw-lb-backend` (EXTERNAL_MANAGED) |
| CI Activation | `MULTI_REGION_READY=true` GitHub Actions variable |
| Setup script | `ops/setup-multi-region.sh` — run once, done |
| Deploy script | `ops/deploy-cloudrun.sh` — loops over both regions |

SEA health confirmed 2026-03-27: revision `tiger-claw-api-00004-294`, uptime 12h, all checks green, 22ms response.

### HMAC Magic Links (PR #50 — deployed)
- `generateMagicToken(email)` — HMAC-SHA256(`MAGIC_LINK_SECRET`, `email:expires`), 72h TTL
- `verifyMagicToken(email, token, expires)` — `timingSafeEqual`, checks expiry first
- `GET /wizard/auth` — requires `?email=&token=&expires=` — 401 if missing/expired
- `GET /admin/magic-link?email=` — admin generates signed links
- ⚠️ **Verify `MAGIC_LINK_SECRET` exists in GCP Secret Manager and is mounted in Cloud Run**

### Rate Limiting (PR #49 — deployed)
- Telegram/LINE: 60 req/min per tenantId (not per-IP)
- Email webhook: 20 req/min per IP
- Stripe: skipped (HMAC signature verification sufficient)

### v5 Data Refinery (PRs #52, #56, #57 — FULLY AUTONOMOUS)

**Pipeline:** BullMQ `miningWorker` (2 AM UTC daily) → `market_miner.ts` → Reddit JSON API → `POST /mining/refine` → Gemini 2.0 Flash extraction → `market_intelligence` table (120-day decay)

**Schedules:**
| Scheduler | Time | Role |
|---|---|---|
| BullMQ `miningWorker` in Cloud Run | 2 AM UTC | Primary |
| Cheese Grater launchd `io.tigerclaw.market-miner` | 3 AM local | Backup |

**First run (2026-03-27):** 313 facts saved, 14 flavors, dedup working.

### Flavor System (15 Customer-Facing)

All 15 have full field set including `scoutQueries`. Doctor removed (healthcare compliance).
New in PR #51: `dorm-design`, `mortgage-broker`, `personal-trainer`. scoutQueries added in PR #52.

### Redis Key Inventory
| Key | TTL | Purpose |
|---|---|---|
| `chat_history:{tenantId}:{chatId}` | 7 days | Conversation history (Telegram int chatId OR LINE string userId) |
| `chat_memory:{tenantId}:{chatId}` | 30 days | Compressed memory |
| `focus_state:{tenantId}:{chatId}` | 24 hours | Active focus session |
| `msg_count:{tenantId}:{YYYYMMDD}` | 48 hours | Per-tenant daily message counter |
| `stripe:processed:{sessionId}` | 24 hours | Stripe idempotency guard |

### PR Ledger

| PR | Status | Description |
|---|---|---|
| #20–#24 | ✅ merged | Memory Architecture V4.1 |
| #26 | ✅ merged | Value-gap cron |
| #27–#36 | ✅ merged | Dead code, flavor cleanup, fleet dashboard, customer fixes |
| #37–#40 | ✅ merged | Launch readiness, session docs |
| #41–#44 | ✅ merged | Beta hardening |
| #45 | ✅ merged | Email support agent |
| #46 | ✅ merged | Multi-provider AI, wizard hardening |
| #47 | ✅ merged | next.config.ts build fix (admin dashboard 404) |
| #48 | ✅ merged | Migration 017 — market_intelligence table |
| #49 | ✅ merged | Webhook rate limiting |
| #50 | ✅ merged | HMAC magic links |
| #51 | ✅ merged | 3 new flavors (dorm-design, mortgage-broker, personal-trainer) |
| #52 | ✅ merged | Data Refinery pipeline (/flavors + /mining/refine) |
| #53 | ✅ merged | Multi-region asia-southeast1 + Global HTTPS LB |
| #54 | ✅ merged | TypeScript fixes post-merge |
| #55 | ✅ merged | Missing fields in network-marketer.ts and real-estate.ts |
| #56 | ✅ merged | tiger_refine — real Gemini extraction replaces mock |
| #57 | ✅ merged | BullMQ daily mining cron + reddit_scout Reddit fixes |
| #60 | ✅ merged | ICP null guard — tiger_scout crash on idealPerson undefined |
| #61 | ✅ merged | Double JSON.parse fix — queue.ts + ai.ts SyntaxError every cron minute |
| #62 | ✅ merged | Wizard magic link auth — pass token+expires through to API |
| #63 | ✅ merged | Safe Gemini text extraction + KeyState defensive merge |
| #64 | ✅ merged | Update test mocks to match post-PR61 getBotState behavior |
| #65 | ✅ merged | State of the Tiger — Path Forward doc |
| #66 | ✅ merged | Conversation counter (#4), feedback loop LINE fix (#7), reliability audit (#5) |
| #67 | ✅ merged | Reliability hardening — 4 CRITICAL + 3 HIGH + 2 MED findings from audit |
| #68 | 🔄 pending | Phase 3 BYOB pivot — remove bot pool + Telegram BYOB wizard |
| #70 | 🔄 pending | Phase 5 Task #13/#14: Gemini circuit breaker + AI economics |
| direct | ✅ | tiger_strike_draft/engage/harvest.ts committed (were missing, blocked all CI) |

### Tenant Roster

| Slug | Email | Status | Notes |
|---|---|---|---|
| `debbie-cameron` | justagreatdirector@outlook.com | live | Founding member |
| `john-thailand` | vijohn@hotmail.com | live | Founding member — John + Noon (Thailand) |
| `chana-loha` | chana.loh@gmail.com | live | Founding member |
| `phaitoon` | phaitoon2010@gmail.com | live | Founding member — Toon |

Cron heartbeat shows 11 total active tenants. 5-instance cap. ~2026-04-03 outreach window.
Terminated: walkthrough-test-5, john-browser, sales-scout-demo (2026-03-27).

---

## Memory Architecture (V4.1 — Complete)

### tenant_states Keys
| state_key | Purpose |
|---|---|
| `onboard_state` | Onboarding answers |
| `fact_anchors` | Extracted business facts |
| `SOUL.md` | System prompt source |

### Phases
- [x] Phase 1: Dynamic prompt enrichment — PR #20
- [x] Phase 2: Sawtooth compression — PR #21
- [x] Phase 3: Fact anchor extraction — PR #22
- [x] Phase 4: startFocus / completeFocus — PR #23

---

## Critical Items (Before Phase 3 Launch)

| Priority | Fix | Status |
|---|---|---|
| ✅ 1 | Verify `MAGIC_LINK_SECRET` in Cloud Run (not just Secret Manager) | ✅ Verified and Mounted |
| 🔴 2 | Fire test: full Stan Store → magic link → wizard → bot as paying customer | Manual — Brent's lane |
| ✅ 3 | `DATABASE_READ_URL` secret — unpin from version 8, use latest | ✅ Unpinned and Deployed |
| 🟡 4 | Reddit OAuth2 credentials for scout (TigerClaw-branded app, not personal) | `tiger_scout.ts` |

## Reliability Audit Findings (specs/RELIABILITY_AUDIT.md)

| Finding | Severity | Status |
|---|---|---|
| Stripe Redis idempotency fails open | CRITICAL | ✅ Fixed PR #67 |
| LINE webhook error swallowed | HIGH | ✅ Fixed PR #67 |
| Cron excludes 'onboarding' tenants | CRITICAL | ✅ Fixed PR #67 |
| Value-gap query excludes 'onboarding' | HIGH | ✅ Fixed PR #67 |
| setWebhook gap on activation | CRITICAL | ✅ Fixed PR #67 |
| resumeTenant webhook validation | HIGH | ✅ Fixed PR #67 |
| Feedback loop LINE/Telegram split | HIGH | ✅ Fixed PR #66 |
| ICP validation before phase=complete | CRITICAL | ✅ Fixed PR #67 |
| ICP confirmation empty guard | HIGH | ✅ Fixed PR #67 |
| Telegram enqueue failure not alerted | HIGH | ✅ Fixed PR #67 |
| Email webhook processes unknown senders | HIGH | ✅ Fixed PR #67 |
| Status negation not allowlist | MED | ✅ Fixed PR #67 |
| SOUL.md written with — placeholders | MED | ✅ Blocked by ICP guard (PR #67) |
| Webhook idempotency check on activation | MED | ⬜ Deferred — low risk |

## Incidents

See `specs/INCIDENT_LOG.md` — INC-001 through INC-004 documented.
- INC-001: tiger_scout idealPerson TypeError (Toon's bot) — RESOLVED PR #60
- INC-002: SyntaxError double JSON.parse hitting all tenants every cron minute — RESOLVED PR #61
- INC-003: Missing tiger_strike files blocking all CI builds — RESOLVED (direct commit to main)
- INC-004: Wizard magic link auth 401 for all Stan Store customers — RESOLVED PR #62

## Phase 3 (BYOB Pivot — Task #8/#9 COMPLETED)

1. **Remove bot pool from provisioning path** — ✅ DONE (PR #68)
2. **Add Telegram BYOB to wizard** — ✅ DONE (PR #68)
3. **Activate founding members** — John & Noon (LINE), Toon (LINE), Debbie (Telegram BYOB).
4. **Outreach to 7 past customers** — complimentary re-activation offer.

---

*Last updated: 2026-03-29. PRs #66 + #67 merged. PRs #68 + #70 open. Proceed.*
