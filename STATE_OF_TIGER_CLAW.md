# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp:** 2026-03-27 (post-Zoom full SWOT sprint — all PRs merged, CI green)
**Infrastructure Status:** LIVE. Multi-region. All tests passing. No open PRs.

---

## MANDATORY DIRECTIVE TO ALL AI AGENTS

This is the single source of truth for the Tiger Claw repository.

1. **NO RAG.** Mini-RAG physically removed. Does not exist.
2. **NO OPENCLAW.** No per-tenant Docker containers. Dead.
3. **NO CANARIES.** Deprecated.
4. **NO FREE TRIAL.** Card charged at Stan Store checkout. 7-day MBG. `trialExpired` removed.
5. **ARCHITECTURE:** Stateless Cloud Run, Gemini 2.0 Flash (locked), 18 tools, shared PostgreSQL.
6. **NO REWRITES:** All tests pass. Do not rewrite architecture.
7. **13 FLAVORS:** network-marketer, real-estate, health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger, dorm-design, mortgage-broker, personal-trainer. Doctor removed.
8. **PROTOCOL:** Read `CLAUDE.md` before writing any code.
9. **AI PROVIDERS:** Google, OpenAI, Grok, OpenRouter, Kimi. Anthropic absent — Sprint 2.
10. **5-INSTANCE CAP:** Until ~2026-04-03. Do not bulk-activate more tenants.
11. **NO OPEN PRS:** All PRs #47–#55 merged and deployed.

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
| Cache/Queue | Cloud Redis HA + BullMQ (7 queues) |
| AI | Gemini 2.0 Flash via `@google/generative-ai` (locked) |
| Wizard | `wizard.tigerclaw.io` — Next.js Vercel `web-onboarding/` |
| Website | `tigerclaw.io` — static Vercel `tiger-bot-website/` |
| Email out | Resend `hello@tigerclaw.io` `support@tigerclaw.io` |
| Email in | Postmark `support@tigerclaw.io` → `/webhooks/email` |
| Bot Pool | ~63 tokens available, AES-256-GCM encrypted |
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

### v5 Data Refinery (PR #52 — deployed)

**Pipeline:** Birdie (every 6h) → `GET /flavors` → Reddit search per scoutQuery → `POST /mining/refine` → Gemini extraction → `market_intelligence` table

- `GET /flavors` — returns all flavor keys + scoutQueries (no auth)
- `POST /mining/refine` — deduplication via `isAlreadyMined(sourceUrl)`, then fact extraction
- `market_intelligence` table — migration 017 (PR #48), 120-day fact decay

**Birdie LaunchAgents:**
- `com.birdie.scout` — every 6h — `/Users/birdie/logs/scout.log`
- `com.birdie.heartbeat` — midnight daily — `/Users/birdie/.openclaw/logs/heartbeat.log`
- **SSH:** `ssh -i ~/.ssh/trashcan birdie@192.168.0.136`

### Flavor System (13 Customer-Facing)

All 13 have full field set: `key`, `displayName`, `description`, `professionLabel`, `defaultKeywords`, `scoutQueries`, `conversion`, `objectionBuckets`, `patternInterrupts`, `onboarding`, `soul`, `discovery`, `nurtureTemplates`.

New in PR #51: `dorm-design`, `mortgage-broker`, `personal-trainer`.
scoutQueries added in PR #52: health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger.
FlavorConfig type (`api/src/config/types.ts`) fully updated.

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
| #54 | ✅ | TypeScript fixes post-merge (types.ts, ai.ts, market_intel.ts, tiger_objection.ts, etc.) |
| #55 | ✅ | Missing fields in network-marketer.ts and real-estate.ts |

### Tenant Roster

| Slug | Email | Status |
|---|---|---|
| `debbie-cameron` | justagreatdirector@outlook.com | live |
| `john-thailand` | vijohn@hotmail.com | live |
| `chana-loha` | chana.loh@gmail.com | live |

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

*Locked. Proceed.*
