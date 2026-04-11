# Tiger Claw — State of the Union

**Last updated:** 2026-04-11 (Session 20 CLOSED — PRs #292–#297 merged, mine audit complete, SSDI flavor spec ready)
**This is the single source of truth. Read nothing else until you finish this file.**
**No lying. No assuming. No guessing. Every fact here is verified against the live system.**

---

## Session 20 — Ground Truth Reconciliation (2026-04-11)

### PRs merged since SOTU was last written

| PR | What |
|----|------|
| #292 | Session 19 late-night docs reconcile — NEXT_SESSION.md full rewrite (stale priorities replaced), CLAUDE.md session state patched, STATE_OF_THE_TIGER_PATH_FORWARD.md updated. SOTU intentionally not touched (already current via PR #291). |
| #293 | DAILY_CHECKS.md created — three daily operational checks. NEXT_SESSION.md items 6 (admin dashboard dependency monitoring) and 7 (mine health panel) added. |
| #294 | Admin dashboard zombie pool code deleted — `/admin/pool/health` fetch (404ing since PR #274), `PoolHealth` type, pool state, pool alarms, Bot Pool stats card, pool action hint all removed. Grid 5→4 columns. Vercel auto-deployed. |
| #295 | Mine content pollution finding logged + `/admin/pipeline/health` mischaracterization corrected in DAILY_CHECKS.md and NEXT_SESSION.md. |

### Session 20 — Additional PRs merged

| PR | What |
|----|------|
| #296 | SOTU reconciliation — Session 20 open state written, Stripe decision recorded, mine pollution corrections applied. |
| #297 | NEXT_SESSION item 2 closed — Gemini key validator audited and confirmed already in place at `wizard.ts:190`. Nothing to build. |

### Decisions made this session

**Stripe replaces Paddle.** Brent dropped Paddle — not waiting any longer. All payment work targets Stripe from this point forward. Paddle webhook code on the backend still exists and must be replaced.

**SSDI Ticket to Work — new $20K/month lead gen contract.** Partner: Pat Solano (founder of ACT! CRM, 1984). Client wants leads for the SSA Ticket to Work program — disabled people aged 18–64 who don't know the program exists. Health-wellness flavor chosen as base to repurpose. Full spec written and approved this session. Build not yet executed — first task next session.

### Mine audit — live findings (2026-04-11)

Live query against `market_intelligence` (8,440 total facts, 708 Network Marketer):
- **3 self-referential rows confirmed** — OpenClaw Mastered pricing copy at conf=100. IDs: `67cb7c2a`, `07d6e010`, `1550c182`. Delete before next mine run.
- **Root cause of classifier drift:** one bad scout query (`"subreddit:Entrepreneur OR subreddit:WorkFromHome network marketing direct sales home business"`) pulling NM discussions into the Network Marketer domain. Fix: remove query, add replacement targeting pain signals.
- **Source noise:** `r/u_adam20141977` (OpenClaw review account) and `r/u_softtechhubus` (content farm) appearing repeatedly. Add to blocklist.
- **Fix is surgical.** No architectural changes. Remove 1 query, add blocklist, delete 3 rows. Do NOT run the mine until this is done.
- **Two-oar model confirmed in code.** `defaultBuilderICP` and `icpProspect`/`icpProduct` onboarding questions already exist in `network-marketer.ts` from prior sessions. The 35-year knowledge moat is already encoded.

### ICP architecture — clarified this session

Network Marketer flavor has TWO distinct oars:
- **Builder oar** — opportunity prospects: people with pain signals (job stuck, want extra income, want time freedom). Mine hunts r/sidehustle, r/antiwork, r/personalfinance for these signals. NOT network marketers — people who haven't yet found their way out.
- **Customer oar** — product customers: people with health/wellness pain signals who want Nu Skin products.

Every other flavor has a single oar (one ICP type). The two-oar model is unique to network-marketer and is the correct design.

### Corrections to prior SOTU

**`/admin/pipeline/health` is NOT a dependency health endpoint.** Prior SOTU and DAILY_CHECKS.md described it as checking Serper×3, Gemini platform keys, and Resend. That was wrong. It is a **mine statistics endpoint** — returns `totalFacts`, `factsLast24h`, `byVertical`, `byRegion`, `byCapturedBy`, and a single `healthy` boolean computed from "did any fact land in the last 24h AND newest fact within 48h". **No real dependency health endpoint exists anywhere on the backend.**

**Mine data is polluted and NOT usable for Strike drafts.** The mine shows `healthy: true` (8,051 facts, 388 in last 24h) but the data quality is bad. Confirmed findings from a 2026-04-10 sample of the Network Marketer flavor:
- Self-referential rows at conf=100: old OpenClaw Mastered pricing copy ingested as prospect intelligence
- Classifier drift at conf=95–100: student housing budgets, a $175K tech salary (triggered by the word "Network"), personal savings — all tagged as Network Marketer signal
- No `verbatim` column exists on `market_intelligence` — it's `fact_summary` (LLM paraphrase in third person). The mine does not store real prospect language anywhere.
- This is a paid-customer blocker: Strike draft generation reads `market_intelligence` directly. Bad facts → bad drafts → churn.

---

## Session 19 late-night addendum — 2026-04-10 00:49 UTC

LOBOTOMY ROOT CAUSE IDENTIFIED AND FIXED.

Symptom across four rebuilds: bots appeared to respond but had no real intelligence. Covenant opening fired (hardcoded), then every subsequent turn produced the same wooden response or the bot fell back into commander onboarding mode. The soul was missing.

Diagnosis: brents-tiger-01-mns7wcqk onboard_state.json was written at 2026-04-10 02:41:46 UTC (19:41 PDT) using the OLD field names icpBuilder/icpCustomer (from fdfc803 admin hatch route at 18:12), 18 minutes AFTER PR #281 renamed them to icpProspect/icpProduct at 19:06. The admin hatch client sent stale field names. The record also had phase="identity" with questionIndex=2 (stuck mid tiger_onboard interview), no productOrOpportunity, no biggestWin, no yearsInProfession. hasIdentity evaluated false. hasOnboarding evaluated false. Bot woke in commander onboarding mode on every turn.

Fix: Option 1 in-place record update. Claude Code wrote a single scoped UPDATE to t_a15eb1a2_93e6_4197_9534_025985c8aa11.bot_states where state_key='onboard_state.json'. Set phase=complete, questionIndex=0, identity.name="Brent", identity.productOrOpportunity populated with Nu Skin opportunity block, yearsInProfession=35 years, biggestWin=$20 Million Circle member 20 years at that pin, differentiator written without Tiger Proof AI mention, icpProspect and icpProduct populated with new field names. All code gates verified: phase===complete, hasIdentity true, hasOnboarding true, displayOperatorName="Brent", new field names present, old field names dropped, questionIndex unstuck. No code touched. No services restarted. No other tenants affected.

Verified live: fresh prospect message "I'm tired of my job" at 00:49 UTC. Bot responded with empathy, acknowledged the feeling, asked qualifying questions, referenced network marketing context correctly. First time in project history that a bot has responded to a prospect with real intelligence rather than a canned fallback.

Remaining problems (not fixed tonight, scoped for tomorrow):
1. Voice layer is still generic "helpful assistant" tone, not Brent's actual voice. System prompt needs voice examples that show how Brent talks to a transition-stage prospect. This is prompt engineering, not architecture.
2. Wizard does not validate Gemini keys at hatch time. Key tester was removed in one-page rewrite and never restored. Every bot hatched since that rewrite could have a dead key and no one would know. MUST go back in before any paid customer hatches.
3. The mine may not have its own dedicated key. Suspected during tonight's diagnosis but not confirmed. Requires trace of the mine's intelligence path tomorrow.
4. Admin hatch route fdfc803 was using icpBuilder/icpCustomer at 18:12 even though PR #281 rename landed at 19:06. Need to verify that current admin hatch code uses the new field names and that no other callers are still sending the old schema.
5. Possible Gemini model cache on Cloud Run at ai.ts:1350 (getGeminiModelWithCache) could hold stale system prompts. Not a problem tonight — fresh chatId triggered new build — but flag for future debugging if stale behavior appears.

First move tomorrow morning: write voice examples for the Network Marketer flavor system prompt. Brent writes the examples in his own voice. Claude Code wires them in. Test again with "I'm tired of my job" and compare.

Closing note: tonight's fix was surgical — one UPDATE, one row, zero code changes. The architecture has been working the whole time. The data was wrong. That changes what "broken" means in this project and suggests that future debugging should start with "what does the state actually look like" before "what does the code actually do."

---

## Ground Truth — Right Now

| Fact | Value |
|------|-------|
| Cloud Run revision | `tiger-claw-api-00456-9rb` — deployed 2026-04-10, health confirmed |
| Health | postgres OK, redis OK, disk OK, workers OK |
| Tests | 456/456 passing, 44 test files |
| Active bots | 1 — `brents-tiger-01-mns7wcqk` (Tiger Proof, Nu Skin) — webhook fixed, onboard_state corrected via surgical UPDATE, **verified live from fresh chatId at 2026-04-10 00:49 UTC** (first real-intelligence prospect response in project history) |
| Open PRs | None |
| Wizard | `wizard.tigerclaw.io` — Vercel, auto-deploy working (PR #294 deployed — zombie pool card gone) |
| Payment provider | **Stripe** — Paddle dropped 2026-04-11. Paddle webhook code still on backend, must be replaced. |
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

## Session 19 — What Was Done (2026-04-10)

| PR | What |
|----|------|
| #286 | StepReviewPayment TS fix — removed `customerProfile` from hatch payload (field deleted in PR #282; TypeScript build error blocking Vercel deploy). |
| #287 | Wizard hatch pre-seed fix — `wizard.ts` hatch route now always writes `onboard_state.json` to DB before provisioner runs. The `if (customerProfile)` guard was the root cause: every wizard-hatched bot was waking in operator onboarding mode and firing `tiger_onboard` at prospects instead of prospecting. Writes `phase=complete` + identity + ICP from flavor defaults. Provisioner sees `phase=complete` and skips its own write. |
| #288 | Remove dead `hasWizardIcp`/`resolvedOnboardingComplete` — these variables depended on `customerProfile` which no longer exists. Always evaluated to false, silently masking the real `hasOnboarding` check. Removed. `buildFirstMessageText` now receives `onboardingComplete` directly — single source of truth. |

**Deployed: `tiger-claw-api-00456-9rb`. Health confirmed.**

---

## Session 18 — What Was Done (2026-04-09)

### PRs Merged to Main

| PR | What |
|----|------|
| #274 | Remove bot pool — 5,559 lines deleted. All `bot_pool` DB functions, `/admin/pool/*` routes, ops scripts, docs gone. `pool.ts` is crypto/Telegram utilities only. Eliminated the silent fallback chain (missing BYOK → platform key → 429 → OpenRouter) that burned $100. |
| #275 | Post-#274 collateral fix — `updateTenantChannelConfig` accidentally deleted from `db.ts`. `/admin/fix-pool-orphans` route still referenced deleted function. Deploy was failing; this unblocked it. |
| #276 | Session docs update — SOTU.md, STATE_OF_THE_TIGER_PATH_FORWARD.md updated for PRs #274–#275. |
| #277 | Repo cleanup — `api/cloud-sql-proxy` (32 MB binary) untracked from git. 37 loose scripts moved from `api/` root → `api/scripts/`. 4 stale audit markdown files → `docs/archive/`. `.claude/worktrees/` added to `.gitignore`. |
| #278 | Agent context fix — `buildSystemPrompt` empty identity fields no longer render as blank lines. `hasOnboarding` requires real identity data, not just `phase=complete`. `displayOperatorName` fallback in prospect phrases. Provisioner writes `phase="identity"` when no product provided at hatch. |
| #279 | Ground-truth doc rewrite — all documents rewritten from codebase audit. Documentation protocol established as Rule 16. |
| #280 | Admin hatch custom ICP — `/admin/hatch` now accepts `icpProspect` and `icpProduct`. Bot wakes with operator's exact ICP, not just flavor defaults. |
| #281 | ICP field rename — `icpBuilder` → `icpProspect`, `icpCustomer` → `icpProduct` everywhere: TypeScript interfaces, DB reads/writes, system prompts, tools, tests, docs. String rename only — no schema changes. |
| #282 | Commander-language cleanup — wizard UI: ICP step removed (4-step flow), `sales-tiger` flavor removed from signup, internal terms replaced (ICP/hatch/flavor/pipeline). `StepCustomerProfile.tsx` deleted. Dashboard shows "Tiger Agent" not flavor string. |

### Also Done This Session (not in PRs)

- 18 stale tenant records deleted from DB — only `brents-tiger-01-mns7wcqk` (Tiger Proof) remains.
- `onboard_state.json` written directly to DB for `brents-tiger-01-mns7wcqk`. **⚠️ This claim was incorrect — see Session 19 late-night addendum above. The record was actually written with OLD field names (`icpBuilder`/`icpCustomer`) and stuck at `phase="identity"`, `questionIndex=2`. Corrected via surgical UPDATE 2026-04-10 00:49 UTC.**
- Documentation protocol established: done = tested, debugged, merged, and deployed. No exceptions.

---

## What Is Broken / Open

| Item | Impact | Status |
|------|--------|--------|
| **SSDI flavor build** | Health-wellness flavor repurposed for SSDI Ticket to Work. Full spec ready. Build not yet executed. $20K/month contract. | First task next session |
| **Mine surgery required** | 3 self-referential rows + 1 bad scout query + source blocklist needed. Do NOT run the mine until fixed. | Execute before next mine run |
| **No dependency health endpoint** | Flying blind — Postgres, Redis, workers, Serper, Gemini keys, Oxylabs, OpenRouter all unmonitored. `/admin/pipeline/health` is mine stats only, not dependency checks. | Build `GET /admin/dependencies/health` + wire dashboard |
| **Stripe integration** | No checkout URL. Paddle dropped. Stripe not yet integrated. Payment path completely unproven. | Integrate Stripe — product, price, webhook handler, checkout flow |
| Voice layer generic | Bot responds intelligently but not in Brent's voice | Write voice examples, wire into network-marketer flavor system prompt |
| Wizard Gemini key validation missing | Key tester removed in one-page rewrite, never restored — dead keys won't be caught at hatch | MUST restore before first paid customer |
| Payment gate open (C4) | Anyone can access wizard without paying | Fix after Stripe loop proven |
| Admin hatch stale field-name risk | fdfc803 route sent `icpBuilder`/`icpCustomer` after PR #281 rename; current caller status unverified | Verify admin hatch + all callers use new field names |
| Mine dedicated Gemini key status unknown | Mine may be borrowing a tenant's key — billing leak + silent failure risk | Trace mine intelligence path |
| Reddit 403 from Cloud Run | Mine uses Oxylabs + Serper fallback (working) | Awaiting Reddit API or proxy |
| Admin alert markdown bug | Alerts with underscores fail silently | Fix when convenient |
| Gemini model cache staleness (potential) | `getGeminiModelWithCache` at ai.ts:1350 may hold stale prompt between deploys | Monitor only |

---

## Platform State (Verified)

### Infrastructure
- Cloud Run: healthy, revision `tiger-claw-api-00456-9rb`
- Postgres, Redis, all 6 workers: OK
- Telegram webhook delivery: wired, `TELEGRAM_WEBHOOK_SECRET` in deploy
- Serper keys (×3): round-robin active
- Oxylabs: live, 684 facts on last manual run
- Resend email: confirmed working
- Vercel auto-deploy: confirmed working
- Paddle webhook: live (`POST /webhooks/paddle`)

### Key Docs
- `SOTU.md` — this file. Single source of truth. Read first every session.
- `NEXT_SESSION.md` — ordered priority list for the next working session.
- `DAILY_CHECKS.md` — recurring operational checklist. Run at every session open before any other work.
- `START_HERE.md` — fast orientation.
- `STATE_OF_THE_TIGER_PATH_FORWARD.md` — roadmap and merged PR history.

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

---

## Housekeeping

**Branch cleanup — 2026-04-10 late-night.** Deleted 135 stale remote branches (196 → 61):
- 64 already-merged branches pruned
- 14 architecturally dead (LINE, bot pool, Stan/Lemon, customerProfile)
- 17 stale docs/session-wrap branches
- 40 superseded fix/PR branches (old numbered PR work, duplicate "rebased" branches, reworked fix attempts)

Preserved: `feat/soul-voice-enforcement`, `feat/tiger-voice-overhaul`, `fix/tenant-voice-nm-cliches` (voice-related, feeds into tomorrow's priorities) and ~50 feature branches flagged as "likely-shipped / needs user review". No code touched. `main` untouched.
