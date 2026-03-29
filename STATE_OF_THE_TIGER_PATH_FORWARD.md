# STATE OF THE TIGER — PATH FORWARD

**Timestamp:** 2026-03-29 (post-reliability-hardening session)
**Status:** ACTIVE DIRECTIVES. All agents must comply.
**Supersedes:** Any prior sprint plans or roadmaps not in the repo.

---

## MANDATORY DIRECTIVE TO ALL AI AGENTS

Read this file AFTER reading START_HERE.md, STATE_OF_TIGER_CLAW.md, and CLAUDE.md.

This document contains the strategic decisions and priority execution list resulting from the 2026-03-28 planning session and subsequent work. These are not suggestions. These are directives. If a directive in this file conflicts with an assumption from a prior session, this file wins.

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

## PRIORITY EXECUTION LIST

### PHASE 1: FOUNDATION (Complete ✅)

| # | Task | Status |
|---|------|--------|
| 1 | GCP Secret Manager audit — verify all secrets mounted | ✅ Done |
| 2 | Wizard auth end-to-end test | ✅ Done (PR #62) |
| 3 | Founding member activation | ✅ Done (4 live tenants) |

### PHASE 2: RELIABILITY + INTELLIGENCE (Complete ✅)

| # | Task | Status |
|---|------|--------|
| 4 | **Conversation counter — admin dashboard.** Total messages 24h, per-tenant breakdown, last message timestamp. | ✅ Done (PR #66) |
| 5 | **Reliability audit — application layer.** Catch blocks, status filtering, ICP validation, queue retry, webhook registration. | ✅ Done (specs/RELIABILITY_AUDIT.md) |
| 6 | **Reliability audit — infrastructure layer.** Redis AOF, maxmemory, Cloud Run scaling, Gemini quota. | GEMINI task |
| 7 | **Fix feedback loop P1.** `processSystemRoutine()` handles `weekly_checkin`, `feedback_reminder`, `feedback_pause` for both Telegram and LINE tenants. | ✅ Done (PR #66) |

**Phase 2 reliability hardening (all audit CRITICAL + HIGH + MED findings):**

| Finding | Severity | PR | Status |
|---|---|---|---|
| Stripe Redis idempotency fails open | CRITICAL | #67 | ✅ |
| LINE webhook error swallowed | HIGH | #67 | ✅ |
| Cron/value-gap exclude 'onboarding' | CRITICAL | #67 | ✅ |
| setWebhook gap on activation | CRITICAL | #67 | ✅ |
| resumeTenant webhook validation + secret | HIGH | #67 | ✅ |
| ICP validation before phase=complete | CRITICAL | #67 | ✅ |
| ICP confirmation empty profile guard | HIGH | #67 | ✅ |
| Telegram enqueue failure not alerted | HIGH | #67 | ✅ |
| Email webhook unknown sender processed | HIGH | #67 | ✅ |
| Status negation → explicit allowlist | MED | #67 | ✅ |
| SOUL.md with — placeholders | MED | #67 | ✅ (blocked by ICP guard) |

---

### PHASE 3: THE BYOB PIVOT

| # | Task | Agent | Effort |
|---|------|-------|--------|
| 8 | **Remove bot pool from provisioning path.** Strip pool assignment from Stan Store webhook and provisioning flow. Do NOT delete pool.ts — tokens are being repurposed. Open PR. | CLAUDE | 1 day |
| 9 | **Add Telegram BYOB to wizard.** Mirror LINE pattern in `StepChannelSetup.tsx`. Paste field for BotFather token, visual walkthrough, real-time validation via `getMe`, AES-256-GCM storage. Must be simple enough for a non-technical network marketer. Open PR. | CLAUDE | 1-2 days |

---

### PHASE 4: ACTIVATION (Only After Phases 1-3)

| # | Task | Agent | Effort |
|---|------|-------|--------|
| 10 | Activate John & Noon (LINE) | BRENT | 1 hour |
| 11 | Activate Toon (LINE) — double duty as wizard UX rehearsal | BRENT | 30 min |
| 12 | Activate Debbie (Telegram BYOB) — acid test for wizard UX | BRENT | 1 hour |

---

### PHASE 5: HARDENING FOR 50-SEAT RELEASE

| # | Task | Agent | Effort |
|---|------|-------|--------|
| 13 | **Model-level circuit breaker.** Gemini 429/5xx three times → flip to secondary provider (OpenRouter). Log every trip. | GEMINI | 1-2 days |
| 14 | **Model Gemini unit economics.** Instrument tool loop. Count API calls per message. Calculate cost per tenant per month. | GEMINI | Half day + 1 week data |
| 15 | **Gemini rate limit hardening.** Semaphore on concurrent Gemini calls. Exponential backoff on 429s. | CLAUDE | 1-2 days |
| 16 | **Write activation playbook.** First message, first hunt, first lead, first conversion. Last wizard screen + handout for downline. | BRENT + CLAUDE | Half day |

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

Primary tasks: #8, #9, #15, #16, #20, #21, #22, #23, #24

Claude handles all TypeScript code changes, Next.js wizard work, new feature implementation, test writing, reliability fixes in application code, and architecture design.

### Gemini (Terminal) — Infrastructure & GCP

Primary tasks: #6, #13, #14, #18

Gemini handles all GCP verification (Secret Manager, Cloud Run, Redis, Memorystore), infrastructure reliability auditing, Gemini API-specific work (circuit breaker, unit economics), and evaluation of its own extraction output in the mine.

### Brent — Strategy, Humans & Activation

Primary tasks: #10, #11, #12, #16, #17, #19, #24

Brent handles all human contact (founding member activation, past customer outreach), pricing decisions, and activation playbook authorship.

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

*Last updated: 2026-03-29. Phase 2 complete. Phase 3 (BYOB pivot) is next. PRs #66 + #67 pending review. Proceed.*
