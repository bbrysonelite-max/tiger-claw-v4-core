# STATE OF THE TIGER — PATH FORWARD

**Timestamp:** 2026-03-29 23:45 UTC (post-infrastructure hardening session)
**Status:** ACTIVE DIRECTIVES. All agents must comply.
**Supersedes:** Any prior sprint plans or roadmaps not in the repo.

---

## MANDATORY DIRECTIVE TO ALL AI AGENTS

Read this file AFTER reading START_HERE.md, STATE_OF_TIGER_CLAW.md, and CLAUDE.md.

This document contains the strategic decisions and priority execution list resulting from the 2026-03-28 planning session and subsequent implementation work. These are not suggestions. These are directives. If a directive in this file conflicts with an assumption from a prior session, this file wins.

---

## STRATEGIC DECISION: BYOB PIVOT (Effective Immediately)

### The Bot Pool Is Dead

The Telegram bot pool is **permanently removed from the provisioning path.** No new tenant will ever be assigned a pool token. The reasons:

1. The pool requires physical SIM cards and BotFather interactions to replenish — it does not scale.
2. Under BYOB (Bring Your Own Bot) + BYOK (Bring Your Own Key), the marginal cost per tenant approaches zero.
3. The pool was the single constraint on growth. Removing it removes the ceiling.
4. The white-label play (Max Steingard) and corporate play (Nu Skin via Craig Bryson) both require BYOB — partners need their own branded bots.

### What BYOB Means

- **Telegram tenants** create their own bot via @BotFather, paste the token in the wizard. Tiger Claw validates via `getMe`, calls `setWebhook`, encrypts and stores the token.
- **LINE tenants** already do this — LINE BYOB has been built and shipped. The wizard pattern exists in `StepChannelSetup.tsx`.
- **AI keys** — all tenants bring their own via BYOK (already built). Supported providers: Google Gemini, OpenAI, Grok, OpenRouter, Kimi.
- **Tiger Claw's value** is the intelligence layer: 18 tools, memory architecture, hive signals, market intelligence, the brain. Not the bot. Not the API key.

### What Happens to Existing Pool Tokens

The ~65 tokens currently in the pool are repurposed for Brent's personal agent fleet (Nu Skin rebuild, prospecting agents, internal tooling). They are NOT deleted. `pool.ts` continues to exist for token storage and encryption but is no longer called by the provisioning flow.

---

## CRITICAL CONTEXT: DEMAND LANDSCAPE

### Ring 1 — John & Noon's Distribution Network

John and Noon have direct influence over 21,000+ active distributors across Bangkok (8,000+), Vietnam (6,000), and Malaysia (7,000). If John endorses Tiger Claw, hundreds of people will want agents simultaneously. This is not linear SaaS growth — it is a distribution-network launch. The platform must be ready to handle wave demand.

### Ring 2 — Nu Skin Corporate (Craig Bryson)

Craig Bryson is Brent's contact at Nu Skin corporate. Nu Skin has 2.9M+ independent distributors globally. A corporate deal here means potential for thousands of enterprise tenants. This requires white-label BYOB (agents look like Nu Skin products, not Tiger Claw). Phase 5.

### Ring 3 — Max Steingard's White-Label Interest

Max runs his own distribution network and wants a white-labeled Tiger Claw instance. BYOB is the prerequisite.

---

## KNOWN RISKS (Updated 2026-03-29 23:45 UTC)

### Gemini Multiplier Problem (MITIGATED — PR #70)

A single user message triggers `runToolLoop()` which generates 5-12 Gemini API calls through the function-calling chain. 50 concurrent users = 250-600 API calls in a burst window. **Model-level circuit breaker is now deployed (PR #70)** — auto-failover to secondary provider (OpenRouter) after 3 consecutive Gemini failures. Unit economics instrumentation is live. **Remaining:** Task #15 (semaphore + exponential backoff) assigned to Claude.

### Unit Economics (INSTRUMENTED — PR #70)

Tool loop is now instrumented to count API calls per message and store per-tenant/per-day counts in Redis. Data collection is live. Need 1 week of production data before modeling zaključ conclusions.

### Silent Failure Pattern (HARDENED — PR #67)

INC-001 through INC-004 were all silent failures. **PR #67 landed 4 CRITICAL + 5 HIGH + 2 MED fixes:** cron error handling with alerting, fetch response validation, replacing empty catch blocks, status allowlist unification.

### Reddit API Credentials (BLOCKED — Awaiting Approval)

Reddit API access application submitted 2026-03-28. The data refinery mine (`reddit_scout.mjs`) hits rate-limit failures on unauthenticated JSON API. Once Reddit approves, plug REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET into GCP Secret Manager.

## BROKEN WINDOWS (Items requiring attention)

1. **Reddit OAuth2** — Awaiting approval from Reddit.
2. **Stan Store product descriptions** — Updated by Brent on 2026-03-28.
3. **DATABASE_URL secret pinning** — ✅ FIXED. Unpinned from version 8, now uses latest in all regions. (Gemini 2026-03-29).

---

## MASTER PRIORITY LIST (Status as of 2026-03-29 23:45 UTC)

**Attack in order. Do not skip ahead. Each phase gates the next.**

---

### PHASE 1: FOUNDATION (Complete ✅)

| # | Task | Status | Agent |
|---|------|--------|-------|
| 1 | **Verify LINE end-to-end message flow.** | ✅ Done | GEMINI |
| 2 | **Verify Telegram end-to-end message flow.** | ✅ Done | GEMINI |
| 3 | **Verify MAGIC_LINK_SECRET in GCP Secret Manager.** | ✅ Done | GEMINI |
| 4 | **Add conversation counter to admin dashboard.** | ✅ Done (PR #66) | CLAUDE |

---

### PHASE 2: RELIABILITY + INTELLIGENCE (Complete ✅)

| # | Task | Status | Agent |
|---|------|--------|-------|
| 5 | **Reliability audit — application layer.** | ✅ Done (PR #67) | CLAUDE |
| 6 | **Reliability audit — infrastructure layer.** | ✅ Done (Report produced) | GEMINI |
| 7 | **Fix feedback loop P1.** | ✅ Done (PR #66) | CLAUDE |

---

### PHASE 3: THE BYOB PIVOT (Complete ✅)

| # | Task | Status | Agent |
|---|------|--------|-------|
| 8 | **Remove bot pool from provisioning path.** | ✅ Done (PR #68) | CLAUDE + GEMINI |
| 9 | **Add Telegram BYOB to wizard.** | ✅ Done (PR #68) | CLAUDE + GEMINI |

---

### PHASE 4: ACTIVATION (Only After Phases 1-3)

*Brent is running fire tests (3 self-activations) before calling founding members.*

| # | Task | Agent | Effort |
|---|------|-------|--------|
| 10 | Activate John & Noon (LINE) — Brent calling tonight | BRENT | 1 hour |
| 11 | Activate Toon (LINE) — Brent calling today | BRENT | 30 min |
| 12 | Activate Debbie (Telegram BYOB) — acid test for wizard UX | BRENT | 1 hour |

---

### PHASE 5: HARDENING FOR 50-SEAT RELEASE

| # | Task | Agent | Status |
|---|------|-------|--------|
| 13 | **Model-level circuit breaker.** | GEMINI | ✅ Done (PR #70) |
| 14 | **Model Gemini unit economics.** | GEMINI | ✅ Done (Instrumented) |
| 15 | **Gemini rate limit hardening.** Semaphore + exp backoff. | CLAUDE | 🟡 Next |
| 16 | **Write activation playbook.** | BRENT + CLAUDE | 🟡 Next |

---

### PHASE 6: GROWTH (Sprint 2+)

| # | Task | Agent | Status |
|---|------|-------|--------|
| 17 | Outreach to 7 past customers — complimentary re-activation | BRENT | 🟡 Pending |
| 18 | Mine quality audit — 20 random facts from market_intelligence | GEMINI | 🟡 Pending |
| 19 | Tiered pricing structure for BYOB/BYOK model | BRENT + CLAUDE | 🟡 Pending |
| 20 | Web chat interface — design phase | CLAUDE | 🟡 Pending |
| 21 | White-label architecture design | CLAUDE | 🟡 Pending |
| 22 | Hive signal conversion tracking | CLAUDE | 🟡 Pending |
| 23 | Anthropic SDK integration | CLAUDE | 🟡 Pending |
| 24 | Enterprise readiness assessment | CLAUDE + BRENT | 🟡 Pending |

---

## AGENT ASSIGNMENT SUMMARY

### Claude (Terminal) — Application Code & Architecture
Handles Task #15, #16, #20, #21, #22, #23, #24. Focuses on TypeScript, Next.js, and product logic.

### Gemini (Terminal) — Infrastructure & GCP
Handles Task #1, #2, #3, #6, #13, #14, #18. Focuses on GCP, reliability auditing, and AI-specific hardening.

---

## GIT PROTOCOL (MANDATORY)

1. Never push without running `npm test` first.
2. Never push directly to main.
3. Always use `feat/` or `fix/` branches and `gh pr create`.

---

## DOCUMENTS TO READ ON SESSION START

1. `START_HERE.md`
2. `STATE_OF_TIGER_CLAW.md`
3. `STATE_OF_THE_TIGER_PATH_FORWARD.md` (this file)
4. `CLAUDE.md`
5. `FITFO.md`

---

*Last updated: 2026-03-29 23:45 UTC. Phase 1-3 Complete. Phase 5 Task #13/#14 Complete. Proceed.*
