# STATE OF THE TIGER — PATH FORWARD

**Timestamp:** 2026-03-29 ~02:00 local (post-Phase 3 purchase auth session)
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

## STRATEGIC DECISION: PURCHASE-BASED AUTH (SHIPPED PR #79 — 2026-03-29)

### Magic Link Flow Is Dead

The magic link email flow has been **permanently removed.** The new auth flow is:

1. Customer buys on Stan Store → receipt email (configured in Stan rich text editor): "Set up your agent at wizard.tigerclaw.io"
2. Customer goes to wizard landing page, enters purchase email → `POST /auth/verify-purchase`
3. Backend checks for `pending_setup` subscription within 72 hours → returns signed HMAC session token + botId
4. Wizard opens with email + botId pre-loaded
5. Customer completes steps → hatch → `activateSubscription(botId)` → subscription goes `active`, bot goes live

### Stan Store Integration (Current Architecture)

- **Zapier bridge:** Stan Store "New Customer" → Zapier → `POST /webhooks/stan-store` → creates user + `pending_setup` subscription
- **Auth:** `POST /auth/verify-purchase` — HMAC-SHA256 session token, no JWT package needed
- **Root cause confirmed:** Stan Store uses proprietary managed Stripe account. Direct Stripe webhooks are impossible. Zapier bridge is the permanent interim solution.

### What Was Removed

- `GET /wizard/auth` endpoint — gone
- `generateMagicToken()` / `verifyMagicToken()` calls in wizard.ts — gone
- URL param magic link parsing in `web-onboarding/src/app/page.tsx` — gone
- `magicToken` / `magicExpires` props in StepIdentity — gone

Do not restore any of this. If auth is broken, debug `POST /auth/verify-purchase` and `lookupPurchaseByEmail()`.

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

**Phase 2 hardening (all CRITICAL + HIGH + MED findings — PR #67 ✅):**

| Finding | Severity | Status |
|---|---|---|
| Stripe Redis idempotency fails open | CRITICAL | ✅ |
| LINE webhook error swallowed | HIGH | ✅ |
| Cron/value-gap exclude 'onboarding' | CRITICAL | ✅ |
| setWebhook gap on activation | CRITICAL | ✅ |
| resumeTenant webhook validation + secret | HIGH | ✅ |
| ICP validation before phase=complete | CRITICAL | ✅ |
| ICP confirmation empty profile guard | HIGH | ✅ |
| Telegram enqueue failure not alerted | HIGH | ✅ |
| Email webhook unknown sender processed | HIGH | ✅ |
| Status negation → explicit allowlist | MED | ✅ |
| SOUL.md with — placeholders | MED | ✅ |

---

### PHASE 3: THE BYOB PIVOT — COMPLETE ✅ (2026-03-29)

| # | Task | Status | PR | Completed |
|---|------|--------|----|-----------|
| 8 | Remove bot pool from provisioning path | ✅ Done | #68 | 2026-03-29 |
| 9 | Add Telegram BYOB to wizard (4-step flow, getMe validation) | ✅ Done | #68 | 2026-03-29 |
| — | Admin pool token export (`GET /admin/pool/tokens`) | ✅ Done | #68 | 2026-03-29 |
| — | Admin bulk retire (`POST /admin/pool/retire-batch`) | ✅ Done | #68 | 2026-03-29 |
| — | Website content audit — CTAs, provider lists, legal docs | ✅ Done | #69 | 2026-03-29 |
| — | Stan Store Zapier bridge (`POST /webhooks/stan-store`) | ✅ Done | #76 | 2026-03-29 |
| — | Purchase-based auth — replace magic link flow | ✅ Done | #79 | 2026-03-29 |
| — | Mine quality audit — 7,872 facts, 65% quality | ✅ Done | #72 | 2026-03-29 |
| — | ScoutQueries tightened — subreddit-scoped on all 15 flavors | ✅ Done | #73 | 2026-03-29 |
| — | Multi-region deploy — asia-southeast1 + Global LB | ✅ Done | #53 | 2026-03-29 |
| — | v5 Data Refinery autonomous — 313 facts on first run | ✅ Done | #56/#57 | 2026-03-27 |

---

### PHASE 4: FIRE TEST + ACTIVATION — 🔥 IMMEDIATE NEXT

#### #1 PRIORITY ON WAKE-UP: The Fire Test

**Two purchases on Stan Store:**
1. Tiger-Claw Pro (Telegram + LINE)
2. Industry Agent

**Then:** go to `wizard.tigerclaw.io`, enter `bbryson@me.com`, verify purchase, complete wizard, confirm live bot.

**What to watch:**
- `POST /auth/verify-purchase` returns `{ ok: true, sessionToken, botId }`
- Wizard opens with email + botId pre-loaded
- Hatch completes → subscription goes `active`
- Bot is live on Telegram

**If verify-purchase returns 404:** Stan Store webhook (Zapier) didn't create the `pending_setup` subscription. Check Cloud Run logs for `[stan-store-webhook]` entries.

| # | Task | Agent | Status | Notes |
|---|------|-------|--------|-------|
| F1 | Fire test — purchase → wizard → live bot | BRENT | 🔥 FIRST THING MORNING | `bbryson@me.com` on Stan Store |
| 10 | Activate John & Noon (LINE) | BRENT | 🔄 In progress | Brent contacting 2026-03-29 |
| 11 | Activate Toon (LINE) | BRENT | 🔄 In progress | Brent contacting 2026-03-29 |
| 12 | Activate Debbie (Telegram BYOB) | BRENT | ⏳ After fire test | Acid test for full BYOB wizard |

---

### PHASE 5: HARDENING FOR 50-SEAT RELEASE — IN PROGRESS

| # | Task | Agent | Status | PR | Notes |
|---|------|-------|--------|-----|-------|
| 13 | Model-level circuit breaker (Gemini 429/5xx → OpenRouter fallover) | GEMINI | ⚠️ PR #70 open | — | CI needs rerun against latest HEAD |
| 14 | Gemini unit economics (API calls per message, cost per tenant/month) | GEMINI | ⚠️ PR #70 open | — | Bundled with #13 |
| 15 | Gemini rate limit hardening — semaphore + exponential backoff | CLAUDE | ✅ Done | #71 | Merged |
| 16 | Relevance gate for Data Refinery — filter junk facts at extraction | CLAUDE | ✅ PR #74 green | #74 | Ready to merge |
| 17 | Write activation playbook | BRENT + CLAUDE | ⬜ Next | — | First message → first hunt → first lead → first conversion |

**PR #70 note:** CI ran against stale commit at end of last session. Before merging, push an empty commit to `feat/gemini-circuit-breaker` or rerun CI on the latest HEAD. Do not merge if CI is red.

**PR #74 note:** Green. Safe to merge after fire test.

**PR #75 note:** Touches `ai.ts` — review for conflicts with `main` before merging.

---

### PHASE 6: GROWTH

| # | Task | Agent | Effort |
|---|------|-------|--------|
| 18 | Outreach to 7 past customers — complimentary re-activation | BRENT | Few hours |
| 19 | Tiered pricing structure for BYOB/BYOK model | BRENT + CLAUDE | 1 day |
| 20 | Web chat interface — design phase (foundation for white label) | CLAUDE | 1-2 days |
| 21 | White-label architecture design — org-level multi-tenancy | CLAUDE | 1-2 days |
| 22 | Hive signal conversion tracking — tenants mark leads as converted | CLAUDE | 2-3 days |
| 23 | Anthropic SDK integration — wire @anthropic-ai/sdk in ai.ts | CLAUDE | 2-3 days |
| 24 | Enterprise readiness assessment — gap analysis for Nu Skin corporate | CLAUDE + BRENT | 1 day |

---

## KNOWN ISSUES (AS OF 2026-03-29 ~02:00 LOCAL)

| Priority | Issue | Status |
|---|---|---|
| 🔴 HIGH | Fire test not done — end-to-end purchase → wizard → live bot | DO FIRST THING MORNING |
| 🟡 MED | PR #70 CI stale — needs rerun against latest HEAD | Before merging |
| 🟡 MED | PR #75 touches ai.ts — needs conflict review | Before merging |
| 🟡 MED | `DATABASE_READ_URL` pinned to secret version 8 (should be latest) | Not fixed |
| 🟡 LOW | Reddit scout returns 0 results (403 without OAuth) | Needs TigerClaw-branded Reddit app |
| 🟡 LOW | `WIZARD_SESSION_SECRET` not set separately in Cloud Run | Falls back to MAGIC_LINK_SECRET — functional but not ideal |

---

## AGENT ASSIGNMENT SUMMARY

### Claude (Terminal) — Application Code & Architecture
Primary tasks: #16, #17, #20, #21, #22, #23, #24

### Gemini (Terminal) — Infrastructure & GCP
Primary tasks: #6, #13, #14

### Brent — Strategy, Humans & Activation
Primary tasks: F1 🔥, #10 🔄, #11 🔄, #12 ⏳, #17, #18, #19, #24

---

## GIT PROTOCOL REMINDER

```
git checkout -b feat/your-description
# make changes, run tests (npm test)
git push origin feat/your-description
gh pr create --title "feat: description" --body "what and why"
```

Never push directly to `main`. Cloud Run deploys automatically on merge via GitHub Actions (both regions).

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

*Last updated: 2026-03-29 ~02:00 local. PRs #69–#79 all merged and live. Purchase-based auth shipped — magic link flow dead. Fire test is first priority on wake-up. 396 tests passing. Proceed.*
