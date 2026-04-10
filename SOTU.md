# Tiger Claw — State of the Union

**Last updated:** 2026-04-09 (Session 18 — in progress)
**This is the single source of truth. Read nothing else until you finish this file.**
**No lying. No assuming. No guessing. Every fact here is verified against the live system.**

---

## Ground Truth — Right Now

| Fact | Value |
|------|-------|
| Cloud Run revision | `tiger-claw-api-00442-tjd` |
| Health | postgres OK, redis OK, disk OK, workers OK |
| Tests | 456/456 passing, 44 test files |
| Active bots | **0** — all tenants terminated this session |
| Pending tenant | `justagreatdirector-mne9xtna` (non-Brent account, unknown status) |
| Open PR | #278 — agent context fix (ai.ts, provisioner.ts) — **not yet merged** |
| Wizard | `wizard.tigerclaw.io` — Vercel, auto-deploy working |
| Repo | `github.com/bbrysonelite-max/tiger-claw-v4-core` |

---

## What Tiger Claw Is

AI sales agent SaaS. Operator brings their own Telegram bot token (BYOB — from BotFather) and their own Gemini API key (BYOK). One-page signup. Bot hatches knowing its ICP. The agent prospects while the operator sleeps.

- **API:** `https://api.tigerclaw.io` — Cloud Run, project `hybrid-matrix-472500-k5`, `us-central1`
- **Admin dashboard:** `wizard.tigerclaw.io/admin/dashboard`
- **Admin token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **DB:** Cloud SQL proxy port **5433** locally (NOT 5432), user `botcraft`, DB `tiger_claw_shared`
- **No AI agent pushes to main.** All changes via `feat/` or `fix/` branch + PR.

---

## Session 18 — What Was Done (2026-04-09)

### PRs Merged to Main

| PR | What |
|----|------|
| #274 | Remove bot pool — 5,559 lines deleted. All `bot_pool` DB functions, `/admin/pool/*` routes, ops scripts, docs gone. `pool.ts` is crypto/Telegram utilities only. Eliminated the silent fallback chain (missing BYOK → platform key → 429 → OpenRouter) that burned $100. |
| #275 | Post-#274 collateral fix — `updateTenantChannelConfig` accidentally deleted from `db.ts`. `/admin/fix-pool-orphans` route still referenced deleted function. Deploy was failing; this unblocked it. |
| #276 | Session docs update — SOTU.md, STATE_OF_THE_TIGER_PATH_FORWARD.md updated for PRs #274–#275. |
| #277 | Repo cleanup — `api/cloud-sql-proxy` (32 MB binary) untracked from git. 37 loose scripts moved from `api/` root → `api/scripts/`. 4 stale audit markdown files → `docs/archive/`. `specs/legacy/` → `docs/archive/specs/`. `.claude/worktrees/` added to `.gitignore`. Nothing deleted. |

### PR Open (not yet merged)

| PR | What |
|----|------|
| #278 | Agent context fix — `buildSystemPrompt` empty identity fields no longer render as blank lines. `hasOnboarding` requires real identity data, not just `phase=complete`. `displayOperatorName` fallback in prospect phrases. Provisioner writes `phase="identity"` when no product provided at hatch. |

### Also Done This Session

- Context audit: discovered bot Tigeralldaytest had empty identity (`productOrOpportunity`, `biggestWin`, `differentiator` all blank). Bot was giving feature-list responses to "what can you do for me" because Gemini had nothing real to anchor on.
- Tigeralldaytest (3bf45773) terminated.
- Full codebase audit — every route, service, tool, worker, migration verified against live code.
- All documents rewritten from ground truth (this update).
- Documentation protocol established as Rule 16 in RULES.md.

---

## What Is Broken / Open

| Item | Impact | Status |
|------|--------|--------|
| PR #278 not merged | Agent context fix not deployed | Merge next |
| No active bot | Nothing to test | Provision correctly after #278 merged |
| Paddle product/price | No checkout URL — payment path unproven | Create in Paddle dashboard |
| Admin alert markdown bug | Alerts with underscores fail silently | Fix when convenient |
| Payment gate open (C4) | Anyone can access wizard without paying | Fix after Paddle loop proven |
| Reddit 403 from Cloud Run | Mine uses Oxylabs + Serper fallback (working) | Awaiting Reddit API or proxy |

---

## Platform State (Verified)

### Infrastructure
- Cloud Run: healthy, revision `tiger-claw-api-00442-tjd`
- Postgres, Redis, all 6 workers: OK
- Telegram webhook delivery: wired, `TELEGRAM_WEBHOOK_SECRET` in deploy
- Serper keys (×3): round-robin active
- Oxylabs: live, 684 facts on last manual run
- Resend email: confirmed working
- Vercel auto-deploy: confirmed working
- Paddle webhook: live (`POST /webhooks/paddle`)

### Codebase (Verified by Session 18 Audit)
- **Routes:** 22 route files, ~82 endpoints
- **Services:** 24 service files
- **Tools registered in toolsMap:** 26
- **Workers:** 6 active BullMQ workers, 10 queues defined (4 queues have no worker)
- **Migrations:** 25 applied
- **Flavors:** 16 in registry
- **Tests:** 456/456 passing, 44 files

### BYOB / BYOK
- Every operator provides their own bot token from BotFather. No pool. Ever.
- Every operator provides their own Gemini API key.
- Circuit breaker: Gemini errors → OpenRouter fallback (active).

---

## Session 17 — What Was Done (2026-04-08/09)

| PR | Fix |
|----|-----|
| #263 | Orchestrator Redis SETNX dedup — Reporting Agent was firing 5× per mine run. |
| #264 | Strike harvest root cause — `verbatim` column missing. First successful run: 20 links, admin alert delivered. |
| #265 | Rule 13 — update docs after every merge. |
| #267 | Dashboard contrast fix. |
| #269 | Provisioner botName top-level fix — Gemini was seeing "Bot name: —" and entering confused self-onboarding loop. |
| #270 | Prospect engagement mode — WHO YOU ARE TALKING TO block, dream injection, covenant opening. |
| #271 | Bot description + /start message fixed. Tiger Claw brand removed from public-facing text. |
| #272 | No tool names in responses — all tiger_* variants blocked. |

---

## Session 16 — What Was Done (2026-04-06/08)

| PR | Fix |
|----|-----|
| #255 | ICP hard-wire — bot wakes calibrated, no interview. |
| #261 | 4-language /start + language matching + Strike pipeline wired. |
| #252 | Duplicate tenant bug fixed. |
| #260 | `tiger_book_zoom` built (Cal.com). Inactive pending architecture decision. |

---

## Tech Debt

| Item | Priority |
|------|----------|
| 4 BullMQ queues with no worker (global-cron, market-mining, market-intelligence-batch, stan-store-onboarding) | MEDIUM |
| Admin alert markdown bug (underscores break Telegram parser) | MEDIUM |
| serperKeyIndex + serperCallsThisRun are module-level globals — broken under concurrency | HIGH |
| Payment gate open (C4) | HIGH — after Paddle loop proven |
| Telegram message dedup missing | MEDIUM |
| Stan Store / Stripe dead code | LOW |

---

## Infrastructure Reference

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1 primary) |
| Cloud SQL | proxy port 5433 locally, instance `tiger-claw-postgres-ha`, user `botcraft`, DB `tiger_claw_shared` |
| Admin | `wizard.tigerclaw.io/admin` |
| Deploys (API) | `GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh` |
| Deploys (Wizard) | Vercel auto-deploy — push to main |
| Post-deploy | `POST /admin/fix-all-webhooks` (idempotent) |
