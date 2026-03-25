# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp:** 2026-03-25
**Infrastructure Status:** LIVE. 382/382 tests green. Flavor review complete. PR #30 pending merge.

---

## MANDATORY DIRECTIVE TO ALL AI AGENTS

This is the single source of truth for the Tiger Claw repository.

1. **NO RAG.** Mini-RAG has been physically removed. It does not exist.
2. **NO OPENCLAW.** No per-tenant Docker containers. OpenClaw is dead.
3. **NO CANARIES.** The canary group concept is deprecated.
4. **NO FREE TRIAL.** Card is charged at checkout via Stan Store. 7-day money-back guarantee. `trialExpired` code paths removed. Do not restore them.
5. **ARCHITECTURE:** Stateless Google Cloud Run API, Gemini 2.0 Flash (locked — 2.5 Flash has a GCP function-calling bug), 18 Native Function Calling Tools (`api/src/tools/`), shared PostgreSQL.
6. **NO REWRITES:** The 18 core tools compile cleanly and are backed by 382 passing tests. Do not rewrite architecture.
7. **10 FLAVORS ONLY:** network-marketer, real-estate, health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger. Doctor was removed — compliance risk. Do not re-add it.
8. **PROTOCOL:** Read `CLAUDE.md` before writing any code.

---

## GIT PROTOCOL — NON-NEGOTIABLE

- NEVER push directly to main. main is branch-protected.
- ALL work goes on a feature branch: `feat/`, `fix/`, `chore/`
- When work is complete and tests pass: open a PR.
- **PR #30** (`fix/flavor-cleanup-drop-doctor`) is currently open. Merge it next.

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

## Current State (2026-03-25)

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

### Product (as of 2026-03-25)
- **Tiger-Claw Pro (Pre-Flavored):** $147/mo — Telegram + LINE, pre-trained for sales and network marketing.
- **Industry Agent:** $197/mo — domain pre-trained for a specific vertical.
- "Standard Agent" naming is DEAD. It is now "Industry Agent."
- **No free trial.** Card upfront. 7-day money-back guarantee, no questions asked.

### Business Model
- Customers purchase on Stan Store. Stan Store webhook provisions their tenant and emails a magic link.
- Wizard flow: StepIdentity → StepAIConnection → StepReviewPayment → PostPaymentSuccess
- Keys: Primary + Backup. All 6 providers: Google, OpenAI, Anthropic, Grok, OpenRouter, Kimi.
- Key auto-detection on paste: `AIza→google`, `sk-ant-→anthropic`, `xai-→grok`, `sk-or-→openrouter`, `sk-→openai`.
- Server validates each key on INSTALL click. Fail-fast, not fail-silent.

### Recent Work Completed (This Session)
- **PRs #20–#24 (merged):** Memory Architecture V4.1 — async buildSystemPrompt, Sawtooth compression, fact anchors, focus primitives, CLAUDE.md philosophy
- **PR #26 (merged):** Value-gap cron — 9 AM UTC daily, 3-day lead check, diagnostic message to operator
- **PR #27 (merged):** Removed `tiger_knowledge` — dead Mini-RAG tool
- **PR #28 (merged):** Simplified `tiger_keys` — 4-layer → Primary + Backup, all 6 providers
- **PR #29 (merged):** Fixed `buildSystemPrompt` — tool count 19→18, `httpStatus` parameter name
- **PR #30 (pending):** Flavor review complete
  - Doctor flavor dropped (healthcare outcome claims — compliance risk)
  - Loose language tightened: real-estate, health-wellness, plumber, lawyer, gig-economy, candle-maker, baker
  - Flavor count: 11 → 10 in all code, tests, and website copy
- **Business model pivot:** No free trial. Card upfront. 7-day MBG. All trial code removed.
- **Key strategy rewrite:** 6 providers, Primary + Backup, auto-detect, server validation on INSTALL.
- **Website:** OG/Twitter Card tags, claw graphic (1200×675), 7-day MBG banner, 10 flavors.

### Open Issues

1. **PR #30 — merge when ready.** `fix/flavor-cleanup-drop-doctor`. 382/382 tests green.

2. **Mac cluster Reflexion Loop tooling.** Offline batch job for `fact_anchors` / `chat_memory` analysis. Not a production blocker.

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
