# Tiger Claw — Module Assessment (April 2026)

**Purpose:** Ground-truth assessment of what was built vs. what the foundation documents specify. Conducted against the Swarm Blueprint (architecture only — not the data intelligence business model), the Cognitive Architecture spec, the Heartbeat spec, and the Essential Root Documentation spec.

**Product definition (confirmed):** Stateless agent hatchery for network marketing recruiting agents. BYOB (bring your own Telegram token from BotFather). BYOK (bring your own Gemini key). One-page signup. Agents that prospect and qualify leads. Hive gets smarter with every run.

---

## Module 1: Scout

**What it should do:** Find high-intent prospects on Reddit, Facebook Groups, Telegram, and other platforms. Delta scan — only new content since last run. Pre-classify before scoring to avoid wasting tokens.

**What was built:**
- `api/src/tools/tiger_scout.ts` (1,455 lines) — full ICP keyword extraction, INTENT_PATTERNS array, lead scoring with decay, SCORE_THRESHOLD=80
- Sources: Reddit, Telegram (stubbed), Facebook Groups (Serper fallback), LINE OpenChat (stubbed)
- `ScoutState` tracks lastScheduledScan, burstCountToday, totalLeadsDiscovered
- `api/src/services/market_miner.ts` (166 lines) — iterates FLAVOR_REGISTRY, fetches Reddit → falls back to Serper

**What's broken:**
1. **Reddit returns 403** on every run. No auth, no OAuth, no residential proxy. Falls back to Serper for all Reddit queries — burning paid API calls on what should be free scraping.
2. **No delta scan.** No timestamp comparison against last run. Every scan re-processes the same content.
3. **Serper globals** (`serperKeyIndex`, `serperCallsThisRun`) are module-level — shared across all tenants. One heavy tenant can exhaust the quota for all others.
4. **Facebook Groups** — Serper only (surface-level). No deep group access.
5. **No relevance pre-classification.** Every post goes through full scoring before being filtered.

**Fatal?** No. Degrades gracefully to Serper. Agents can prospect today. Quality and cost are degraded.

**Fix path:** Oxylabs residential proxies for Reddit auth. Delta scan via stored timestamp in `bot_states`. Per-tenant Serper quota tracking.

---

## Module 2: Hive (Market Intelligence)

**What it should do:** Global shared intelligence layer. Every agent's activity feeds back into the Hive. Nightly mining run populates `market_intelligence` table. Agents query it for high-confidence facts before scouting. Moat grows over time.

**What was built:**
- `market_intelligence` table — `017_market_intelligence.sql`
- `api/src/services/market_miner.ts` — autonomous nightly mining via BullMQ (`market-mining` queue), 2 AM UTC + Cheese Grater 3 AM backup
- `api/src/tools/tiger_refine.ts` — Gemini 2.0 Flash fact extraction, RefinedFact types (objection, claim, sentiment, pricing, gap, intent_signal), 120-day fact expiry
- `api/src/tools/tiger_hive.ts` — agent-facing tool for querying hive intelligence
- `hive_signals` table + `hive_benchmarks` — injected into `buildSystemPrompt()` via `getHiveSignalWithFallback()` and `queryHivePatterns()`
- `saveMarketFact()` now normalizes URLs before storage (PR #210 fix — dedup was broken before this)

**What's missing:**
- Reddit 403s mean mining falls back to Serper — same quality degradation as Module 1
- No Oxylabs integration yet

**Fatal?** No. Mining runs. Facts accumulate. 313 facts on first autonomous run. Dedup fixed.

---

## Module 3: Cognitive Architecture (Self-Improvement)

**What it should do:** Identity Layer (SOUL.md, AGENTS.md, TOOLS.md, HEARTBEAT.md), Memory Layer (MEMORY.md, daily logs, heartbeat-state.json), Self-Improvement Layer (LEARNINGS.md, Ralph Wiggum Loop), Skills Layer (lazy SKILL.md files).

**What was built:**
- `api/src/services/self-improvement.ts` — substantial service:
  - `draftSkillFromFailure()` — on tool failure, extracts the failure context and saves a prompt-based skill to the `skills` table
  - `loadApprovedSkills(tenantId, flavor)` — loads approved skills into `buildSystemPrompt()` as MASTER STRATEGIC DIRECTIVES
  - `analyzePatterns()` — finds tools with 2+ failures in 7 days
  - `logLearning()` — legacy API, logs to admin_events
  - FITFO Protocol: one failure = one draft, no threshold, no waiting
- `api/migrations/013_skills.sql` + `014_skills_draft_dedup.sql` — skills table exists in DB
- `api/.learnings/LEARNINGS.md` — exists but empty (just a heading)
- `api/.learnings/ERRORS.md` — has Telegram webhook errors from March, no analysis written

**What's missing:**
- No `AGENTS.md` file (operational rules)
- No `TOOLS.md` file (tool inventory / endpoints)
- No `HEARTBEAT.md` file
- No `activeContext.md` or `progress.md`
- `LEARNINGS.md` is empty — self-improvement.ts writes to DB, not to the file
- Ralph Wiggum Loop not wired into `runToolLoop()` in `ai.ts`

**Fatal?** No. The backend engine exists and runs. File layer is cosmetic for Cloud Run. DB-backed skills are the real implementation.

---

## Module 4: Hatchery (Signup → Provision → Live)

**What it should do:** One-page signup. BYOB + BYOK. 60 seconds from payment to bot live. Agent hatches with ICP pre-loaded — never re-asks what it already knows.

**What was built:**
- `web-onboarding/src/app/signup/page.tsx` — one-page signup live at `wizard.tigerclaw.io/signup` (200 OK)
  - 5 sections: flavor picker, agent name, ICP (3 fields), Telegram token with live validation, Gemini key
  - EmailGate component: verifies purchase email, auto-verifies from URL param
  - SuccessState: "Your agent is live. [Name] is ready to hunt."
- `api/src/routes/wizard.ts` — `POST /wizard/hatch`:
  - Validates botId, checks pending subscription
  - Validates and installs Gemini key inline if provided
  - Writes `customerProfile` + `icpSingle` to `onboard_state.json` BEFORE provisioning
  - Enqueues to `provisionQueue` with `jobId: provision-${botId}` (dedup guard)
- `api/src/services/provisioner.ts`:
  - Activates subscription atomically inside the job
  - BYOB enforced — no botToken = no Telegram webhook = no hatch
  - Sets webhook → rebrands bot name/description → registers slash commands → sets status `onboarding`
  - Founding member eligibility check (fire-and-forget)
- ICP data stored in `bot_states` table (DB-backed, not filesystem — correct for Cloud Run)
- `buildSystemPrompt()` reads `icpSingle` from `onboard_state.json` on every message

**Fixed (PR #221):**
1. **Proactive first message** — `sendProvisioningReceipt` now sends a personalized hatch email immediately after provisioning. Subject: "[AgentName] is live. Let's hunt." Body references agent name, flavor, ICP. Sends even when botUsername is null. Dead `triggerProactiveInitiation` admin-only block removed. ✅
2. **Vercel auto-deploy** — root directory misconfiguration fixed in Session 12. Auto-deploy now works. ✅

**Fatal?** No. Flow is solid end-to-end.

---

## Module 5: Orchestration / Heartbeat

**What it should do:** Periodic background pulse. Checks what's overdue, runs exactly that, stays silent when nothing to report. Batches multiple checks into one agent turn to save tokens.

**What was built:**
- `global-cron` BullMQ queue, singleton `global_heartbeat_cron` job, fires every minute
- `cronWorker` iterates all active tenants, dispatches to `routineQueue` with date-stamped jobIds (dedup = equivalent of heartbeat-state.json)
- `routineWorker` calls `processSystemRoutine(tenantId, routineType)` with concurrency: 20
- `processSystemRoutine()` in `ai.ts` has strong prompts:
  - `daily_scout` at 7 AM UTC — waterfall (scout → search → data mine → draft cold outreach) + morning report in agent's voice
  - `nurture_check` every cron cycle — surfaces leads due for follow-up
  - `value_gap_checkin` at 9 AM if no lead in 3 days — genuine diagnostic, not retention push
  - Feedback loop Mon/Wed/Fri 8 AM UTC

**What's missing / imperfect:**
1. **No HEARTBEAT.md file** — logic is hardcoded in queue.ts. Acceptable for Cloud Run. BullMQ IS the heartbeat implementation.
2. ~~**No HEARTBEAT_OK suppression**~~ — **Fixed (PR #215):** `nurture_check` now pre-checks `tenant_leads` count and skips the LLM entirely when zero leads exist. Token burn eliminated. ✅
3. **`onboardComplete` guard** — skips tenants where `phase !== 'complete'`. But one-page signup bots have `phase` undefined (never set). So new bots get scheduled for routines immediately after hatch, before first conversation. May be intentional.

**Fatal?** No. Daily scout fires. Morning reports send. Value gap check runs.

---

## Module 6: Skills Layer

**What it should do:** Self-contained skill directories loaded lazily. Agent declares only the tools it needs for the current task. System prompt stays lean.

**What was built:**
- 25 TypeScript tools registered in `toolsMap` in `ai.ts`
- All 25 declared to Gemini via `geminiTools` on every single request
- `loadApprovedSkills()` injects DB-backed dynamic skills into system prompt as MASTER STRATEGIC DIRECTIVES
- Tool inventory covers full pipeline: scout → score → lead → nurture → convert → operator management

**What's missing:**
1. **No lazy loading.** All 25 tool declarations sent to Gemini every turn. Significant token overhead.
2. **No `skills/` directory.** Spec called for file-based SKILL.md definitions. Everything is TypeScript.
3. `tiger_gmail_send` and `tiger_postiz` intentionally excluded (CLAUDE.md mandate — correct).

**Fatal?** No. All tools work and are tested. Token overhead is a cost issue, not correctness.

**Optimization path (two options):**
1. **Context caching (immediate)** — Gemini native feature. Cache static tool declarations + system prompt. Near-zero token cost after first request. One afternoon of work.
2. **Routine-aware tool sets (Phase 2)** — Pass only relevant tools per routineType. `daily_scout` gets 5 tools. `nurture_check` gets 4 tools. Conversational turns get full set or intent-classified subset.

---

## Module 7: Memory Layer

**What it should do:** Short-term (session history), long-term per-agent (learns operator's business over time), global Hive (platform-wide intelligence). Agent never re-asks what it already knows. Compounds every week.

**What was built:**
- **Short-term (Redis)** — `chat_history:tenantId:chatId`, capped at 20 turns (MAX_HISTORY_TURNS). Loaded on every message. ✅
- **Global Hive** — `hive_signals` + `market_intelligence` tables. `buildSystemPrompt()` calls `getHiveSignalWithFallback()` and `queryHivePatterns()`. Injected into every agent's context. ✅
- **fact_anchors write pipeline** — `factExtractionQueue` fires after every conversation. `extractFactAnchors()` reads last 10 history entries, runs Gemini to extract structured facts (products, ICP updates, objections, hot leads, preferences), saves to `tenant_states` as `fact_anchors`. ✅

**Fixed (PR #212):**
- `buildSystemPrompt()` now reads `fact_anchors` back from `tenant_states` and injects them after the ICP block. Agents compound over time. ✅

---

## Module 8: Payment Pipeline, Dashboards, and SOUL

### Payment Pipeline

**Current flow:**
1. Customer buys on Stan Store
2. Stan Store sends a confirmation email containing a link: `wizard.tigerclaw.io/signup?email=customer@email.com`
3. Customer clicks link → email auto-populates in the EmailGate field
4. `POST /auth/verify-purchase` receives the email → finds no prior DB record → creates user + bot + subscription on-demand → issues session token
5. Customer proceeds through one-page signup → hatch

**The gap: no payment gate exists.** `verify-purchase` creates records for any email with no verification against Stan Store or any payment processor. The only barrier is that paying customers receive the confirmation email with the link — but anyone who navigates directly to `wizard.tigerclaw.io/signup` and types any email gets a free bot.

The Zapier webhook at `POST /webhooks/stan-store` is legacy code — it was built for an earlier flow and is no longer part of the current path. The `stan_store_self_serve_*` subscription IDs being generated are not fake — they're real records — but they're created without proof of payment.

**Fix path — Paddle (application submitted 2026-04-05):**
Lemon Squeezy was rejected ("services fulfilled outside Lemon Squeezy"). Webhook code is dormant in the repo. `LEMONSQUEEZY_SIGNING_SECRET` is in GCP Secret Manager but NOT active in Cloud Run.

Paddle is the replacement. Application submitted 2026-04-05. Domains approved. Business name had typos — operator cannot locate the correction path in the portal. Everything else approved; token likely available but deferred pending final approval.

When Paddle approves: build `/webhooks/paddle` using the existing Lemon Squeezy handler as the template (HMAC signature verification, same pattern). Paddle fires a signed webhook on purchase → creates the DB record → `verify-purchase` finds it → gate is real.

---

### Customer-Facing Dashboard

**What was built:** A full dashboard at `wizard.tigerclaw.io/dashboard?slug=your-slug`. Shows bot status with live indicator, Telegram link, API key health (with inline key replacement form), channels, subscription status, and a leads table with scores and profile links. Well-designed and functional UI.

**Fixed (PR #213):** Session token is now stored in localStorage after signup and sent as `Authorization: Bearer <token>` on all dashboard fetch calls. Both `GET /dashboard/:slug` and `POST /dashboard/:slug/update-key` return proper responses. Dashboard is functional for authenticated customers.

---

### Admin Dashboard

**What was built:** A full fleet management dashboard at `/admin/dashboard`. Properly authenticated via Bearer token. Shows:
- Pool health (now empty/irrelevant since BYOB, but shows status)
- All tenants with status, flavor, region, last activity
- Conversation stats (messages last 24h, today, by tenant)
- Alarms: suspended tenants, waitlisted tenants, stuck-in-onboarding >48h
- Per-tenant actions: suspend, resume, fix webhook
- Tenant expand/collapse for detail view

This is functional. The alarms for stuck onboarding >48h are directly useful for the current three customers. The conversation stats show whether agents are actually having conversations.

**One stale reference:** Admin dashboard still shows "pool health" which is meaningless now that BYOB removed the pool. Low priority cleanup.

---

### SOUL

**Solid. No action needed.**

SOUL.md is loaded via `loadSoul()` in `ai.ts` and injected into `buildSystemPrompt()` first — before ICP, before tools, before everything. Contains:
- Tiger's full voice and personality ("Pebo in your pocket")
- The Voice Test ("Does this feel like Pebo just smiled?")
- The Dream Injection Principle
- The Three Daily Magic Moments (Morning Hunt Report, Midday Pulse, Evening Win)
- The Language of Hope table (what Tiger never says vs. always says)
- The Craig Principle, The Fear Reframe, The Opening Sequence in 6 languages
- Design Principles

"Pebo" being the agent's voice benchmark is intentional and correct — it's the human warmth anchor. The books and voice work that went into this document shows. This is the strongest single artifact in the entire codebase.

**Note:** The SOUL is the same for every tenant. Every operator's agent has the same voice — Tiger's voice. Operators provide the ICP and identity data, but the personality is Tiger. That is by design and correct.

---

## Module 8 Summary

| Area | Status | Fatal? |
|---|---|---|
| Payment gate | Open — any email gets a free bot | Yes for revenue integrity |
| Customer dashboard | Auth fixed ✅ PR #213 — works for authenticated customers | No |
| Admin dashboard | Works, properly authenticated, useful alarms | No |
| SOUL | Solid — loaded first, voice is strong, no changes needed | No |
| Payment gate (C4) | Open — any email gets a free bot. Paddle application pending. | Yes for revenue integrity |

---

## Priority Fix List

### Critical — blocks correct operation

| # | Fix | File(s) | Status |
|---|---|---|---|
| C1 | Customer dashboard sends no auth token — 401 for all customers | `web-onboarding/src/app/dashboard/page.tsx` | ✅ Fixed PR #213 |
| C2 | `fact_anchors` are extracted but never read back into system prompt | `api/src/services/ai.ts` | ✅ Fixed PR #212 |
| C3 | No proactive first message on hatch | `api/src/services/email.ts`, `queue.ts` | ✅ Fixed PR #221 — personalized hatch email, Tiger's voice (needs deploy) |
| C4 | Payment gate is open — any email gets a free bot | `api/src/routes/auth.ts` + new Paddle webhook | Open — Paddle application in progress; domains approved, business name typo pending |

### High — degrades product quality

| # | Fix | File(s) | Status |
|---|---|---|---|
| H1 | `nurture_check` fires LLM even with zero leads | `api/src/services/queue.ts` | ✅ Fixed PR #215 |
| H2 | Reddit returns 403 on every scout run | `api/src/services/market_miner.ts` | Open — Oxylabs account needed |
| H3 | No delta scan — rescans same content every run | `api/src/tools/tiger_scout.ts` | ✅ Fixed PR #214 |

### Medium — cost and efficiency

| # | Fix | File(s) | Status |
|---|---|---|---|
| M1 | All 25 tools declared to Gemini on every request | `api/src/services/ai.ts` | ✅ Fixed PR #219 (context caching) |
| M2 | Serper quota is global, not per-tenant | `api/src/services/market_miner.ts`, `tiger_scout.ts` | ✅ Fixed PR #222 — per-invocation counter + key rotation (needs deploy) |
| M3 | Vercel auto-deploy broken for `web-onboarding/` | CI config | ✅ Fixed (root directory misconfiguration resolved) |

### Next session priorities

1. **Deploy** — run Cloud Run deploy to ship PRs #221/#222. Verify health endpoint 200 after.
2. **Agent behavior review** — operator flagged conversational quality as a "broken window." Review `runToolLoop()` in `ai.ts`, SOUL injection order in `buildSystemPrompt()`, and test a live agent conversation before onboarding any customer.
3. **C4** — Build `/webhooks/paddle` once Paddle approves. Use existing LS webhook handler as template (HMAC signature verification, same pattern).
4. **H2** — Oxylabs proxy for Reddit. Deferred until account exists.
5. **R2-P1-6** — Stan Store Zapier race condition on `stripe_subscription_id` UNIQUE constraint. Buildable now.

---

*Assessment conducted: April 2026. All 8 modules assessed against foundation documents.*
*Next action: dispatch sub-agents for C1–C3, H1, H3 in parallel.*
