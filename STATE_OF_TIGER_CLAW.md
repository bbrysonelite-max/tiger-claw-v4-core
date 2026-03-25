# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp:** 2026-03-24
**Infrastructure Status:** LIVE. 383/383 tests green. Memory Architecture V4.1 fully merged. Value-gap cron shipped (PR #26 pending merge).

---

## MANDATORY DIRECTIVE TO ALL AI AGENTS

This is the single source of truth for the Tiger Claw repository.

1. **NO RAG.** Mini-RAG has been physically removed. It does not exist.
2. **NO OPENCLAW.** No per-tenant Docker containers. OpenClaw is dead.
3. **NO CANARIES.** The canary group concept is deprecated. All tenants are treated equally until scale justifies it.
4. **NO FREE TRIAL.** The free trial model is dead. Card is charged at checkout via Stan Store. 7-day money-back guarantee, no questions asked. `trialExpired` code paths have been removed. Do not restore them.
5. **ARCHITECTURE:** Stateless Google Cloud Run API, Gemini 2.0 Flash (locked — 2.5 Flash has a GCP function-calling bug), 19 Native Function Calling Tools (`api/src/tools/`), shared PostgreSQL.
6. **NO REWRITES:** The 19 core tools compile cleanly and are backed by 383 passing tests. Do not rewrite architecture.
7. **PROTOCOL:** Read `CLAUDE.md` before writing any code.

---

## GIT PROTOCOL — NON-NEGOTIABLE

- NEVER push directly to main. main is branch-protected.
- ALL work goes on a feature branch: `feat/`, `fix/`, `chore/`
- When work is complete and tests pass: open a PR.
- **PR #26** (`feat/value-gap-cron`) is currently open. Merge it next.

**Deploy sequence:**
```bash
git checkout -b feat/your-description
# make changes, run tests
git push origin feat/your-description
gh pr create --title "feat: your description" --body "What changed and why"
gh pr merge --auto --squash
```

Deployments to Cloud Run are handled by GitHub Actions on merge to main. Do not run deploy scripts locally.

---

## Current State (2026-03-24)

### Architecture
- **API:** Cloud Run, Node.js/Express, port 4000, `https://api.tigerclaw.io`
- **DB:** Cloud SQL PostgreSQL HA (`tiger_claw_shared`)
- **Cache/Queue:** Cloud Redis HA + BullMQ (6 queues: provision, telegram, line, fact-extraction, ai-routines, global-cron)
- **AI:** Gemini 2.0 Flash via `@google/generative-ai` SDK (locked — do not change)
- **Frontend (wizard):** Next.js on Vercel (`wizard.tigerclaw.io`) — part of this repo, `web-onboarding/` subdirectory
- **Frontend (website):** Static HTML on Vercel (`tigerclaw.io`) — `tiger-bot-website/` subdirectory
- **Payments:** Stan Store (purchase gating + checkout)
- **Email:** Resend
- **Bot Pool:** 42 available Telegram bot tokens, AES-256-GCM encrypted
- **GCP Project:** `hybrid-matrix-472500-k5`
- **Cloud Run Service:** `tiger-claw-api`, region `us-central1`

### Product (as of 2026-03-24)
- **Tiger-Claw Pro (Pre-Flavored):** $147/mo — Telegram + LINE, pre-trained for sales and network marketing. Stan Store: `stan.store/brentbryson/p/tired-of-manually-searching-for-leads-`
- **Industry Agent:** $197/mo — domain pre-trained for a specific vertical. Stan Store: `stan.store/brentbryson/p/custom-agent-flavor`
- "Standard Agent" naming is DEAD. It is now "Industry Agent."
- **No free trial.** Card upfront. 7-day money-back guarantee, no questions asked.

### Business Model
- Customers purchase on Stan Store. Stan Store webhook provisions their tenant and emails a magic link.
- Wizard flow: StepIdentity → StepAIConnection → StepReviewPayment → PostPaymentSuccess
- Keys: Primary + Backup. All 6 providers supported: Google, OpenAI, Anthropic, Grok, OpenRouter, Kimi.
- Key auto-detection on paste: `AIza→google`, `sk-ant-→anthropic`, `xai-→grok`, `sk-or-→openrouter`, `sk-→openai`.
- Server validates each key on INSTALL click before saving. Fail-fast, not fail-silent.

### Recent Work Completed (This Session)
- **Business model pivot:** Removed free trial entirely. Card upfront. 7-day MBG. `trialExpired` code path and Layer 4 auto-resume dead and removed from all wizard components.
- **Key strategy rewrite:** 4-layer system → Primary + Backup. Restored all 6 providers. Auto-detect from prefix. Server validation on INSTALL. Hand-holding wizard UX.
- **Memory Architecture V4.1 (PRs #20–#24, all merged):**
  - PR #20: Phase 1 — `buildSystemPrompt()` async, ICP + hive + pipeline injection
  - PR #21: Phase 2 — Sawtooth context compression (`chat_memory` Redis key)
  - PR #22: Phase 3 — Fact anchor extraction (async BullMQ → `tenant_states.fact_anchors`)
  - PR #23: Phase 4 — `startFocus` / `completeFocus` / `incrementFocusToolCalls`
  - PR #24: CLAUDE.md product philosophy + doc rewrites
- **Value-gap detection cron (PR #26 — pending merge):**
  - 9 AM UTC daily check: active tenant with zero leads in 3 days triggers `value_gap_checkin` job
  - Dedup via `value_gap_{tenantId}_{YYYY-MM-DD}` jobId
  - Fires plain-language diagnostic message to operator via their bot
  - 3-day window (per CLAUDE.md mandate, tightened from initial 7-day spec)
- **Website + OG tags:** `tigerclaw.io` updated — OG/Twitter Card meta tags, Tiger Claw Agent claw OG image (1200×675), 7-day MBG banner, corrected Stan Store links.

### Open Issues

1. **PR #26 — merge when ready.** `feat/value-gap-cron`. 383/383 tests green.

2. **`tiger_knowledge` tool references dead Mini-RAG.** The vector DB it queries no longer exists. Must be rewired or removed before any customer-facing launch.

3. **`tiger_keys` tool uses old 4-layer naming.** Layer 1 "Platform Onboarding Key" concept is dead. Tool code and any documentation should reflect Primary + Backup model.

4. **Agent flavor file quality review.** The 13 flavor files and core system constitution have not been line-reviewed. Network Marketer flavor is highest priority before launch.

5. **Mac cluster Reflexion Loop tooling.** Offline batch job for `fact_anchors` / `chat_memory` analysis not yet built. Not a production blocker.

---

## Memory Architecture (V4.1 — FULLY SHIPPED, ALL MERGED)

**Design:** Hybrid Cognitive Architecture — Cloud Run executes stateless, Redis/PostgreSQL hold all persistent memory.

### Redis Keys
| Key | Purpose | TTL |
|---|---|---|
| `chat_history:{tenantId}:{chatId}` | Raw turn history | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Sawtooth compressed summaries | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending | 24 hours |

### `tenant_states` Keys
| `state_key` | Purpose |
|---|---|
| `onboard_state` | Onboarding interview answers |
| `fact_anchors` | Extracted business facts from live conversations |

### Phase Status
- [x] Phase 1: Dynamic prompt enrichment — merged PR #20
- [x] Phase 2: Sawtooth context compression — merged PR #21
- [x] Phase 3: Fact anchor extraction — merged PR #22
- [x] Phase 4: `startFocus` / `completeFocus` primitives — merged PR #23

### Mac Cluster (192.168.0.2) — OFFLINE ONLY
The Cheese Grater is an **offline Reflexion Loop tool**. It reads Cloud SQL via Auth Proxy, analyzes `fact_anchors` and `chat_memory` across tenants, and proposes system prompt improvements for Brent to review. It is **NOT** called by Cloud Run and cannot break production if offline.

---

## Tenant Roster (Notable)

| Slug | Status | Notes |
|---|---|---|
| `john-thailand` | onboarding | Fresh provision 2026-03-24. Bot: @tc_62g6al77_bot |
| `john-noon` | suspended | Webhook conflict. Left as tombstone. Superseded by john-thailand |

---

*Locked. Proceed.*
