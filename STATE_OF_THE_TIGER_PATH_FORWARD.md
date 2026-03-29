# STATE OF THE TIGER — PATH FORWARD

**Timestamp:** 2026-03-29 01:45 UTC (post-Phase 3 BYOB pivot session)
**Status:** ACTIVE DIRECTIVES. All agents must comply.
**Supersedes:** Any prior sprint plans or roadmaps not in the repo.

---

## MANDATORY DIRECTIVE TO ALL AI AGENTS

Read this file AFTER reading START_HERE.md, STATE_OF_TIGER_CLAW.md, and CLAUDE.md.

This document contains the strategic decisions and priority execution list. These are not suggestions. These are directives. If a directive in this file conflicts with an assumption from a prior session, this file wins.

---

## STRATEGIC DECISION: BYOB PIVOT (SHIPPED 2026-03-29)

### The Bot Pool Is Dead

The Telegram bot pool is **permanently removed from the provisioning path.** No new tenant will ever be assigned a pool token. PR #68 merged. Live in production.

Reasons:
1. The pool requires physical SIM cards and BotFather interactions to replenish — it does not scale.
2. Under BYOB + BYOK, the marginal cost per tenant approaches zero.
3. The pool was the single constraint on growth. Removing it removes the ceiling.
4. The white-label play (Max Steingard) and corporate play (Nu Skin via Craig Bryson) both require BYOB.

### What BYOB Means (As Shipped)

- **Telegram tenants** paste their @BotFather token into wizard step 2. Tiger Claw validates via `getMe` (real-time, 700ms debounce), calls `setWebhook`, encrypts and stores.
- **LINE tenants** — always BYOB, unchanged.
- **AI keys** — BYOK, all 5 providers. Google Gemini, OpenAI, Grok, OpenRouter, Kimi.
- **Tiger Claw's value** is the intelligence layer: 18 tools, memory architecture, hive signals, market intelligence. Not the bot. Not the key.

### Pool Token Status (2026-03-29)

~61 tokens remain in `bot_pool`. These are Brent's personal fleet for Nu Skin rebuild and prospecting agents. Retrieve via `GET /admin/pool/tokens`. Bulk retire unused ones via `POST /admin/pool/retire-batch`. `pool.ts` retained for AES-256-GCM encryption.

---

## CRITICAL CONTEXT: DEMAND LANDSCAPE

### Ring 1 — John & Noon's Distribution Network

John and Noon have direct influence over 21,000+ active distributors across Bangkok (8,000+), Vietnam (6,000), and Malaysia (7,000). Wave demand scenario: hundreds of signups simultaneously. Platform must handle it — Gemini rate limit hardening shipped (PR #71).

### Ring 2 — Nu Skin Corporate (Craig Bryson)

Craig Bryson = Nu Skin corporate. 2.9M+ independent distributors globally. Corporate deal = white-label BYOB (agents look like Nu Skin, not Tiger Claw). Phase 6.

### Ring 3 — Max Steingard's White-Label Interest

Max runs his own distribution network and wants a white-labeled Tiger Claw instance. BYOB is the prerequisite — now shipped.

---

## PRIORITY EXECUTION LIST

### PHASE 1: FOUNDATION — COMPLETE ✅ (2026-03-27)

| # | Task | Status | Completed |
|---|------|--------|-----------|
| 1 | GCP Secret Manager audit — verify all secrets mounted | ✅ Done | 2026-03-27 |
| 2 | Wizard auth end-to-end test | ✅ Done (PR #62) | 2026-03-27 |
| 3 | Founding member activation | ✅ Done (4 live tenants) | 2026-03-27 |

---

### PHASE 2: RELIABILITY + INTELLIGENCE — COMPLETE ✅ (2026-03-29)

| # | Task | Status | PR | Completed |
|---|------|--------|----|-----------|
| 4 | Conversation counter — admin dashboard | ✅ Done | #66 | 2026-03-29 |
| 5 | Reliability audit — application layer | ✅ Done | specs/RELIABILITY_AUDIT.md | 2026-03-29 |
| 6 | Reliability audit — infrastructure layer | GEMINI task | — | — |
| 7 | Fix feedback loop P1 — LINE tenants | ✅ Done | #66 | 2026-03-29 |

**Phase 2 hardening (all CRITICAL + HIGH + MED findings):**

| Finding | Severity | PR | Status | Completed |
|---|---|---|---|---|
| Stripe Redis idempotency fails open | CRITICAL | #67 | ✅ | 2026-03-29 |
| LINE webhook error swallowed | HIGH | #67 | ✅ | 2026-03-29 |
| Cron/value-gap exclude 'onboarding' | CRITICAL | #67 | ✅ | 2026-03-29 |
| setWebhook gap on activation | CRITICAL | #67 | ✅ | 2026-03-29 |
| resumeTenant webhook validation + secret | HIGH | #67 | ✅ | 2026-03-29 |
| ICP validation before phase=complete | CRITICAL | #67 | ✅ | 2026-03-29 |
| ICP confirmation empty profile guard | HIGH | #67 | ✅ | 2026-03-29 |
| Telegram enqueue failure not alerted | HIGH | #67 | ✅ | 2026-03-29 |
| Email webhook unknown sender processed | HIGH | #67 | ✅ | 2026-03-29 |
| Status negation → explicit allowlist | MED | #67 | ✅ | 2026-03-29 |
| SOUL.md with — placeholders | MED | #67 | ✅ | 2026-03-29 |

---

### PHASE 3: THE BYOB PIVOT — COMPLETE ✅ (2026-03-29)

| # | Task | Status | PR | Completed |
|---|------|--------|----|-----------|
| 8 | Remove bot pool from provisioning path | ✅ Done | #68 | 2026-03-29 03:40 UTC |
| 9 | Add Telegram BYOB to wizard (4-step flow, getMe validation) | ✅ Done | #68 | 2026-03-29 03:40 UTC |
| — | Admin pool token export (`GET /admin/pool/tokens`) | ✅ Done | #68 | 2026-03-29 |
| — | Admin bulk retire (`POST /admin/pool/retire-batch`) | ✅ Done | #68 | 2026-03-29 |
| — | Website content audit — CTAs, provider lists, legal docs | ✅ Done | #69/#70 | 2026-03-29 |

---

### PHASE 4: ACTIVATION — IN PROGRESS (2026-03-29)

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| 10 | Activate John & Noon (LINE) | BRENT | 🔄 In progress | Brent contacting 2026-03-29 |
| 11 | Activate Toon (LINE) | BRENT | 🔄 In progress | Brent contacting 2026-03-29 |
| 12 | Activate Debbie (Telegram BYOB) — acid test for BYOB wizard | BRENT | ⏳ Tomorrow | Debbie in Spain, asleep 2026-03-29 |

**Fire test required before Debbie:** Full wizard flow using a pool token from `GET /admin/pool/tokens` → magic link → 4-step wizard → live bot.

---

### PHASE 5: HARDENING FOR 50-SEAT RELEASE — IN PROGRESS

| # | Task | Agent | Status | PR | Notes |
|---|------|-------|--------|-----|-------|
| 13 | Model-level circuit breaker (Gemini 429/5xx → OpenRouter fallover) | GEMINI | ⬜ Not started | — | Already partially exists in ai.ts — needs Gemini agent |
| 14 | Gemini unit economics (API calls per message, cost per tenant/month) | GEMINI | ⬜ Not started | — | Instrumentation in place, needs analysis |
| 15 | Gemini rate limit hardening — semaphore + exponential backoff | CLAUDE | ✅ Done | #71 | 2026-03-29 22:57 UTC — 396 tests |
| 16 | Write activation playbook | BRENT + CLAUDE | ⬜ Next | — | First message → first hunt → first lead → first conversion |

---

### PHASE 6: GROWTH

| # | Task | Agent | Effort |
|---|------|-------|--------|
| 17 | Outreach to 7 past customers — complimentary re-activation | BRENT | Few hours |
| 18 | Mine quality audit — 20 random facts from market_intelligence | GEMINI | 1-2 hours |
| 19 | Tiered pricing structure for BYOB/BYOK model | BRENT + CLAUDE | 1 day |
| 20 | Web chat interface — design phase (foundation for white label) | CLAUDE | 1-2 days |
| 21 | White-label architecture design — org-level multi-tenancy | CLAUDE | 1-2 days |
| 22 | Hive signal conversion tracking — tenants mark leads as converted | CLAUDE | 2-3 days |
| 23 | Anthropic SDK integration — wire @anthropic-ai/sdk in ai.ts | CLAUDE | 2-3 days |
| 24 | Enterprise readiness assessment — gap analysis for Nu Skin corporate | CLAUDE + BRENT | 1 day |

---

## AGENT ASSIGNMENT SUMMARY

### Claude (Terminal) — Application Code & Architecture
Primary tasks: #15 ✅, #16, #20, #21, #22, #23, #24

### Gemini (Terminal) — Infrastructure & GCP
Primary tasks: #6, #13, #14, #18

### Brent — Strategy, Humans & Activation
Primary tasks: #10 🔄, #11 🔄, #12 ⏳, #16, #17, #19, #24

---

## GIT PROTOCOL REMINDER

```
git checkout -b feat/your-description
# make changes, run tests (npm test)
git push origin feat/your-description
gh pr create --title "feat: description" --body "what and why"
```

Never push directly to main. Cloud Run deploys automatically on merge via GitHub Actions (both regions).

---

## DOCUMENTS TO READ ON SESSION START

Every new agent session must read these files in this order:

1. `START_HERE.md` — resurrection briefing, infrastructure state
2. `STATE_OF_TIGER_CLAW.md` — architecture, PR history, tenant roster
3. `STATE_OF_THE_TIGER_PATH_FORWARD.md` — this file: strategic decisions, priority list, agent assignments
4. `CLAUDE.md` — product philosophy, engineering constraints
5. `FITFO.md` — operating protocol

Do not trust base-model memory. Trust the repo.

---

*Last updated: 2026-03-29 23:00 UTC. Phases 1–3 complete. Phase 4 activation in progress (John/Noon/Toon/Brent contacting; Debbie tomorrow). Phase 5 #15 done (PR #71 pending merge). 396 tests passing. Proceed.*
