# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp:** 2026-03-25 (updated 11:45 PM)
**Infrastructure Status:** LIVE. 374/374 tests green. PRs #30–#46 all merged (PR #46 open, pending merge).

---

## MANDATORY DIRECTIVE TO ALL AI AGENTS

This is the single source of truth for the Tiger Claw repository.

1. **NO RAG.** Mini-RAG has been physically removed. It does not exist.
2. **NO OPENCLAW.** No per-tenant Docker containers. OpenClaw is dead.
3. **NO CANARIES.** The canary group concept is deprecated.
4. **NO FREE TRIAL.** Card is charged at checkout via Stan Store. 7-day money-back guarantee. `trialExpired` code paths removed. Do not restore them.
5. **ARCHITECTURE:** Stateless Google Cloud Run API, Gemini 2.0 Flash (locked — 2.5 Flash has a GCP function-calling bug), 18 Native Function Calling Tools (`api/src/tools/`), shared PostgreSQL.
6. **NO REWRITES:** The 18 core tools compile cleanly and are backed by 374 passing tests. Do not rewrite architecture.
7. **10 FLAVORS ONLY:** network-marketer, real-estate, health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger. Doctor was removed — compliance risk. Do not re-add it.
8. **PROTOCOL:** Read `CLAUDE.md` before writing any code.

---

## GIT PROTOCOL — NON-NEGOTIABLE

- NEVER push directly to main. main is branch-protected.
- ALL work goes on a feature branch: `feat/`, `fix/`, `chore/`
- When work is complete and tests pass: open a PR.

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
- **Cache/Queue:** Cloud Redis HA + BullMQ (7 queues: provision, telegram, line, email-support, fact-extraction, ai-routines, global-cron)
- **AI:** Gemini 2.0 Flash via `@google/generative-ai` SDK (locked — do not change)
- **Frontend (wizard):** Next.js on Vercel (`wizard.tigerclaw.io`) — part of this repo, `web-onboarding/` subdirectory
- **Frontend (website):** Static HTML on Vercel (`tigerclaw.io`) — `tiger-bot-website/` subdirectory
- **Payments:** Stan Store (purchase gating + checkout)
- **Email (outbound):** Resend — `hello@tigerclaw.io`, `support@tigerclaw.io`. Domain `tigerclaw.io` added, DNS pending propagation.
- **Email (inbound):** Postmark — `support@tigerclaw.io` → AI support agent via `POST /webhooks/email`
- **Bot Pool:** 63 available Telegram bot tokens, AES-256-GCM encrypted
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

### PRs Merged (all of them)
- **PRs #20–#24:** Memory Architecture V4.1
- **PR #26:** Value-gap cron
- **PR #27:** Removed `tiger_knowledge`
- **PR #28:** Simplified `tiger_keys`
- **PR #29:** Fixed `buildSystemPrompt`
- **PR #30:** Flavor cleanup — doctor dropped
- **PRs #31–#36:** Doc sync, customer fixes, error handling, botpool fix, ops cleanup, fleet dashboard
- **PRs #37–#39:** Launch readiness docs, Vercel build fix
- **PR #40:** Session wrap docs
- **PR #41:** Beta hardening — ADMIN_TOKEN rotated, Telegram webhook secret, dead code removed
- **PR #42:** Telegram webhook secret wired into all setWebhook calls
- **PR #43:** fix-all-webhooks — JOIN bot_pool for V4 encrypted tokens
- **PR #44:** fix-all-webhooks — include 'live' status
- **PR #45:** Email support agent — Postmark inbound → BullMQ → AI → Resend reply

### Tenant Roster

| Slug | Email | Status | Notes |
|---|---|---|---|
| `debbie-cameron` | justagreatdirector@outlook.com | live | Paying customer. Magic link sent 2026-03-25 |
| `john-thailand` | vijohn@hotmail.com | live | Paying customer (John and Noon). Magic link sent 2026-03-25 |
| `chana-loha` | chana.loh@gmail.com | live | Paying customer (Chana Lohasaptawee). Magic link sent 2026-03-25 |

All three are V3-era records — `user_id` null, `containerName` is legacy artifact. Onboarding completes when they click magic link and connect an AI key.

**john-noon** deprovisioned 2026-03-25 — webhook conflict tombstone, token recycled to pool.

**7 past customers** preserved for post-Zoom outreach (paid, never received service). See memory for contact details.

### Open Issues / Next Actions

- **Fire test: BOT CONFIRMED LIVE** — Telegram bot responding in character (network-marketer, "Sales Scout"). Message delivery end-to-end working.
- **Wizard bugs fixed (deployed)** — niche selection now required, doctor removed from UI, "Get your key" links fixed (window.open), magic link URL corrected (was `/wizard?email=`, now `/?email=`), email pre-fills wizard and auto-opens it.
- **Resend DNS propagation** — DKIM + SPF records on Porkbun pending. Will complete automatically.
- **Post-Zoom:** personal outreach to 7 past customers with complimentary access offer.
- **Sprint 2:** rate limiting on webhooks, HMAC-signed magic links, Reflexion Loop on Mac cluster, bot pool replenishment.

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

*Locked. Proceed.*
