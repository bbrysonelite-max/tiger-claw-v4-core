# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp:** 2026-03-28 (post-demo incident audit — revision 00115)
**Infrastructure Status:** LIVE. Multi-region. Cron clean. No open PRs.
**⚠️ WIZARD AUTH BROKEN — See critical issues below. Do NOT send customers to platform.**

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
9. **AI PROVIDERS:** Google, OpenAI, Grok, OpenRouter, Kimi. Anthropic absent — Sprint 2.
10. **5-INSTANCE CAP:** Until ~2026-04-03. Do not bulk-activate more tenants.
11. **NO OPEN PRS:** All PRs through #61 merged. Current Cloud Run revision: `00115`.
12. **WIZARD AUTH BROKEN (PARTIAL FIX ONLY):** Magic link `token`/`expires` not flowing through to `/wizard/auth` API call. `page.tsx` fixed. `OnboardingModal.tsx` and `StepIdentity.tsx` NOT YET FIXED. Every Stan Store customer gets 401. Fix these first.

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

## Current State (2026-03-27)

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
| Bot Pool | ~65 tokens available, AES-256-GCM encrypted |
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
- ⚠️ **Verify `MAGIC_LINK_SECRET` exists in GCP Secret Manager**

### Rate Limiting (PR #49 — deployed)
- Telegram/LINE: 60 req/min per tenantId (not per-IP)
- Email webhook: 20 req/min per IP
- Stripe: skipped (HMAC signature verification sufficient)

### v5 Data Refinery (PRs #52, #56, #57 — FULLY AUTONOMOUS)

**Pipeline:** BullMQ `miningWorker` (2 AM UTC daily) → `market_miner.ts` → Reddit JSON API → `POST /mining/refine` → Gemini 2.0 Flash extraction → `market_intelligence` table (120-day decay)

- `GET /flavors` — returns all flavor keys + scoutQueries (no auth)
- `POST /mining/refine` — dedup via `isAlreadyMined(sourceUrl)`, then Gemini extraction
- `market_intelligence` table — migration 017, 120-day `valid_until` decay
- `tiger_refine.ts` — real Gemini extraction (was mock, fixed PR #56)
- `market_miner.ts` — new service orchestrating the nightly run

**Schedules:**
| Scheduler | Time | Role |
|---|---|---|
| BullMQ `miningWorker` in Cloud Run | 2 AM UTC | Primary |
| Cheese Grater launchd `io.tigerclaw.market-miner` | 3 AM local | Backup |

**First run (2026-03-27):** 313 facts saved, 14 flavors, dedup working.

**Manual trigger:**
```bash
TIGER_CLAW_API_URL=https://api.tigerclaw.io node api/scripts/reddit_scout.mjs
```

### Flavor System (15 Customer-Facing)

All 15 have full field set including `scoutQueries`. Doctor removed (healthcare compliance).

New in PR #51: `dorm-design`, `mortgage-broker`, `personal-trainer`.
scoutQueries added in PR #52 for all flavors.

### PR Ledger

| PR | Status | Description |
|---|---|---|
| #20–#24 | ✅ | Memory Architecture V4.1 |
| #26 | ✅ | Value-gap cron |
| #27–#36 | ✅ | Dead code, flavor cleanup, fleet dashboard, customer fixes |
| #37–#40 | ✅ | Launch readiness, session docs |
| #41–#44 | ✅ | Beta hardening |
| #45 | ✅ | Email support agent |
| #46 | ✅ | Multi-provider AI, wizard hardening |
| #47 | ✅ | next.config.ts build fix (admin dashboard 404) |
| #48 | ✅ | Migration 017 — market_intelligence table |
| #49 | ✅ | Webhook rate limiting |
| #50 | ✅ | HMAC magic links |
| #51 | ✅ | 3 new flavors (dorm-design, mortgage-broker, personal-trainer) |
| #52 | ✅ | Data Refinery pipeline (/flavors + /mining/refine) |
| #53 | ✅ | Multi-region asia-southeast1 + Global HTTPS LB |
| #54 | ✅ | TypeScript fixes post-merge |
| #55 | ✅ | Missing fields in network-marketer.ts and real-estate.ts |
| #56 | ✅ | tiger_refine — real Gemini extraction replaces mock |
| #57 | ✅ | BullMQ daily mining cron + reddit_scout Reddit fixes |
| #60 | ✅ | ICP null guard — tiger_scout crash on idealPerson undefined |
| #61 | ✅ | Double JSON.parse fix — queue.ts + ai.ts SyntaxError every cron minute |
| direct | ✅ | tiger_strike_draft/engage/harvest.ts committed (were missing, blocked all CI) |

### Tenant Roster

| Slug | Email | Status | Notes |
|---|---|---|---|
| `debbie-cameron` | justagreatdirector@outlook.com | live | Founding member |
| `john-thailand` | vijohn@hotmail.com | live | Founding member — John + Noon (Thailand) |
| `chana-loha` | chana.loh@gmail.com | live | Founding member |
| `phaitoon` | phaitoon2010@gmail.com | live | Founding member — Toon; scout functional, in 23h cooldown; first-lead email will fire |

Cron heartbeat shows 11 total active tenants. All clean on revision 00115 as of 2026-03-28.
5-instance cap. 7 past customers in queue for ~2026-04-03 outreach.
Terminated: walkthrough-test-5, john-browser, sales-scout-demo (2026-03-27).

---

## Memory Architecture (V4.1 — Complete)

### Redis Keys
| Key | TTL |
|---|---|
| `chat_history:{tenantId}:{chatId}` | 7 days |
| `chat_memory:{tenantId}:{chatId}` | 30 days |
| `focus_state:{tenantId}:{chatId}` | 24 hours |

### tenant_states Keys
| state_key | Purpose |
|---|---|
| `onboard_state` | Onboarding answers |
| `fact_anchors` | Extracted business facts |

### Phases
- [x] Phase 1: Dynamic prompt enrichment — PR #20
- [x] Phase 2: Sawtooth compression — PR #21
- [x] Phase 3: Fact anchor extraction — PR #22
- [x] Phase 4: startFocus / completeFocus — PR #23

---

## Critical Fixes (Must Complete Before Next Demo)

| Priority | Fix | Files Involved |
|---|---|---|
| 🔴 1 | Complete wizard auth: pass token/expires through OnboardingModal → StepIdentity → `/wizard/auth` | `OnboardingModal.tsx`, `StepIdentity.tsx` |
| 🔴 2 | Confirm `MAGIC_LINK_SECRET` in Cloud Run (not just Secret Manager) | GCP console / deploy script |
| 🔴 3 | Fire test: full Stan Store → magic link → wizard → bot flow as paying customer | Manual |
| 🟡 4 | Fix welcome email false "bot in 60 seconds" promise | `email.ts:sendStanStoreWelcome` |
| 🟡 5 | Real error message when provisioning stalls (not just spinner timeout) | `OnboardingModal.tsx` |
| 🟡 6 | `DATABASE_READ_URL` secret — unpin from version 8, use latest | GCP Secret Manager |
| 🟡 7 | Reddit OAuth2 credentials for scout (TigerClaw-branded app, not personal) | `tiger_scout.ts` |

## Incidents

See `specs/INCIDENT_LOG.md` — INC-001 through INC-004 documented.
- INC-001: tiger_scout idealPerson TypeError (Toon's bot) — RESOLVED PR #60
- INC-002: SyntaxError double JSON.parse hitting all tenants every cron minute — RESOLVED PR #61
- INC-003: Missing tiger_strike files blocking all CI builds — RESOLVED (direct commit to main)
- INC-004: Wizard magic link auth 401 for all Stan Store customers — PARTIALLY RESOLVED (page.tsx fixed; modal + step identity NOT fixed)

## Sprint 2 (Starting ~2026-04-03)

1. **Feedback loop fix (P1)** — `processSystemRoutine()` silently ignores `weekly_checkin`, `feedback_reminder`, `feedback_pause`
2. **Anthropic SDK** — wire `@anthropic-ai/sdk` in `api/src/services/ai.ts`
3. **Reflexion Loop** — offline Cheese Grater tool for self-improvement
4. **Bot pool replenishment** — needs physical SIMs + BotFather (hardware-limited)
5. **Outreach to 7 past customers** — complimentary re-activation offer
6. **Reddit OAuth2** — register TigerClaw app at reddit.com/prefs/apps, add credentials to Cloud Run

---

*Last updated: 2026-03-28. WIZARD AUTH BROKEN. Fix before demo. Proceed.*
