# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
Stop what you are doing. Read this entire document and `CLAUDE.md`. These are your injected directives. Do not ask Brent to repeat himself. Do not rely on hallucinated history.

---

## 1. The Current State of the Universe

**Tiger Claw is LIVE on Google Cloud Run (`https://api.tigerclaw.io`).**

- **Architecture:** V4 Stateless Serverless — one API process, all tenants, context resolved per-request
- **Database:** PostgreSQL HA via Cloud SQL Proxy (`tiger_claw_shared`)
- **Cache/Queue:** Redis HA + BullMQ (7 queues: provision, telegram, line, email-support, fact-extraction, ai-routines, global-cron)
- **AI Engine:** Gemini 2.0 Flash (LOCKED — `gemini-2.5-flash` has a GCP function-calling bug, do not use it)
- **Tests:** 374/374 passing
- **Flavors:** 10 customer-facing industry flavors (doctor was removed — healthcare compliance risk)
- **Min-instances:** 1 — no cold start

**Strict Rule 1:** OpenClaw, Mini-RAG, and per-tenant Docker containers are DEAD. Their folders have been physically eradicated. Do not reference or restore them.

**Strict Rule 2:** `main` is branch-protected. NEVER push directly. Always use `feat/` branches and `gh pr create`.

**Strict Rule 3:** Read `CLAUDE.md` before writing any code. It contains non-negotiable product and engineering directives.

---

## 2. What Has Been Accomplished

1. **V4 Stateless Architecture** — Cloud Run API, shared PostgreSQL, Redis, BullMQ. No Docker containers per tenant.
2. **18 Native Function Calling Tools** — All in `api/src/tools/`. Backed by 374 passing tests.
3. **Business Model: Card Upfront** — No free trial. Card charged at checkout via Stan Store. 7-day money-back guarantee, no questions asked. The `trialExpired` code path is dead and removed.
4. **Key Strategy: Primary + Backup, 6 Providers** — Wizard supports all 6 AI providers (Google, OpenAI, Anthropic, Grok, OpenRouter, Kimi). Auto-detects provider from key prefix on paste. Server validates on INSTALL.
5. **Memory Architecture V4.1 (All 4 Phases)** — `buildSystemPrompt()` is async. Injects ICP, hive signals, pipeline stats, and fact anchors on every request. Sawtooth compression, fact anchor extraction, and focus primitives all shipped (PRs #20–#24, merged).
6. **Value-Gap Detection Cron** — 9 AM UTC daily: active tenant with zero leads in 3 days fires a diagnostic message to the operator. Per CLAUDE.md mandate. Merged PR #26.
7. **Dead Code Removal** — `tiger_knowledge` (dead Mini-RAG tool) removed PR #27. `tiger_keys` simplified from 4-layer to Primary+Backup PR #28. `resolveGoogleKey` removed PR #41.
8. **System Prompt Fixes** — Tool count corrected (18), `tiger_keys` telemetry parameter fixed (`httpStatus` not `error`). Merged PR #29.
9. **Flavor File Review & Cleanup — COMPLETE** — All 10 remaining flavors reviewed. Doctor dropped (compliance risk). Language tightened. PR #30 merged.
10. **Integrity First Product Philosophy** — Baked into `CLAUDE.md`. Non-negotiable for all future code.
11. **Website + OG Tags** — `tigerclaw.io` updated with product naming, Stan Store links, 7-day MBG banner, OG/Twitter Card meta tags.
12. **Hive Intelligence (V4 Analytics)** — Universal Prior, Founding Member Program, ICP signal mapping. Migrations 005a-009.
13. **PRs #30–#45 all merged.** Admin dashboard live. Email support agent live.
14. **Beta Hardening (PRs #41–#44)** — ADMIN_TOKEN rotated, Telegram webhook secret wired, dead trial code removed, fix-all-webhooks corrected for V4 encrypted tokens.
15. **Email Infrastructure** — Resend wired (RESEND_API_KEY in GCP Secrets), `tigerclaw.io` domain added (pending DNS verification). FROM_EMAIL corrected to `hello@tigerclaw.io`.
16. **Email Support Agent (PR #45)** — `POST /webhooks/email` inbound Postmark webhook. AI generates replies using platform key. Sends from `support@tigerclaw.io` via Resend. Postmark MX live on Porkbun.

---

## 3. Memory Architecture (V4.1 — Fully Shipped)

`buildSystemPrompt()` is **async**. On every request it injects four live signals:
- **Operator profile** — from `onboard_state` in `tenant_states` (name, product, ICP, top result)
- **Network intelligence** — top 3 `hive_signals` rows for this tenant's vertical/region
- **Pipeline stats** — live lead counts from `tenant_leads`
- **Fact anchors** — extracted business facts from `tenant_states.fact_anchors`

All loaded in `Promise.all()` — DB unreachable = static prompt, no crash.

**Redis key inventory:**
| Key | Purpose | TTL |
|---|---|---|
| `chat_history:{tenantId}:{chatId}` | Raw turn history | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Sawtooth compressed summaries | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending | 24 hours |

**Memory phases — all complete (merged to main):**
- [x] Phase 1: Dynamic prompt enrichment (ICP + hive + pipeline) — merged PR #20
- [x] Phase 2: Sawtooth context compression (`chat_memory`) — merged PR #21
- [x] Phase 3: Fact anchor extraction (`tenant_states.fact_anchors`) — merged PR #22
- [x] Phase 4: `startFocus` / `completeFocus` primitives — merged PR #23

**Mac cluster (192.168.0.2) is an OFFLINE ops tool.** It reads Cloud SQL via Auth Proxy for Reflexion Loop analysis. It is NOT called by Cloud Run and cannot break production.

---

## 4. Product (as of 2026-03-25)

| Product | Price | Stan Store URL |
|---|---|---|
| Tiger-Claw Pro (Pre-Flavored) | $147/mo | `stan.store/brentbryson/p/tired-of-manually-searching-for-leads-` |
| Industry Agent | $197/mo | `stan.store/brentbryson/p/custom-agent-flavor` |

- Tiger-Claw Pro = pre-trained for sales and network marketing. Ships ready. No configuration.
- Industry Agent = domain pre-trained for a specific vertical. Custom flavor injection.
- "Standard Agent" is a dead name. It is "Industry Agent."
- **No free trial.** Card upfront. 7-day money-back guarantee.

**10 Customer-Facing Flavors:** network-marketer, real-estate, health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger.
**Removed:** doctor (healthcare outcome claims in templates — compliance risk).

---

## 5. Tenant Roster

| Slug | Status | Email | Notes |
|---|---|---|---|
| `debbie-cameron` | live | justagreatdirector@outlook.com | Paying customer. Magic link sent 2026-03-25. Bot: @tiger10000000003_bot |
| `john-thailand` | live | vijohn@hotmail.com | Paying customer (John and Noon). Magic link sent 2026-03-25. Bot: @tc_62g6al77_bot |
| `chana-loha` | live | chana.loh@gmail.com | Paying customer (Chana Lohasaptawee). Magic link sent 2026-03-25 |

**Note:** All three are V3-era records — `user_id` is null, `containerName` is a legacy artifact. They have bot tokens assigned and are live. Onboarding completes when they click their magic link and connect an AI key.

**john-noon** was deprovisioned (2026-03-25) — tombstone recycled back to pool.

**7 past customers** (paid, never received service) have been preserved. Personal outreach planned post-Zoom. See memory file for emails and draft message.

---

## 6. Email Infrastructure

| Address | Purpose | Status |
|---|---|---|
| `hello@tigerclaw.io` | Transactional outbound (magic links, receipts) | ✅ Sending via Resend |
| `support@tigerclaw.io` | AI-handled customer support (inbound via Postmark) | ✅ Live |
| `noreply@tigerclaw.io` | System alerts | Planned |
| `brent@tigerclaw.io` | Personal | Planned |

**Resend domain:** `tigerclaw.io` added, DNS records on Porkbun — pending propagation (DKIM + SPF).
**Postmark inbound:** MX record live. Webhook URL `https://api.tigerclaw.io/webhooks/email` configured. Token in GCP Secrets as `tiger-claw-postmark-webhook-token`.

---

## 7. Bot Pool

- **Available:** 63 tokens
- **Assigned:** 13 tokens (real customers + internal/sandbox)
- **Status:** Healthy
- 21 demo/tombstone tenants were deprovisioned 2026-03-25 — tokens recycled

---

## 8. What Was Done This Session (2026-03-25)

- **Damage assessment** — all PRs #40–#44 clean, no breakage
- **Both P1s confirmed already resolved** — min-instances=1, feedback loop handlers exist
- **Pool cleanup** — 21 demo/tombstone tenants deprovisioned, pool 42→63
- **Admin dashboard** — Vercel was pinned to stale deployment; redeployed, now live at `wizard.tigerclaw.io/admin/dashboard`
- **RESEND_API_KEY** wired into Cloud Run — emails now actually send (were mock-only before)
- **FROM_EMAIL** corrected to `hello@tigerclaw.io`
- **tigerclaw.io domain** added to Resend, DNS records added on Porkbun
- **Email support agent** built and deployed (PR #45) — Postmark inbound → BullMQ → AI → Resend reply
- **Customer emails updated** in DB — john-thailand → vijohn@hotmail.com, chana-loha → chana.loh@gmail.com
- **Magic links sent** to all 3 paying customers
- **Past customer outreach** drafted and saved to memory (7 people, post-Zoom)

---

## FINAL REMINDER

`CLAUDE.md` contains the non-negotiable product philosophy and engineering constraints. Read it before writing any code.

**Zoom call:** Thursday 2026-03-27, 7 PM Pacific. Platform is GO. See `LAUNCH_READINESS.md` for smoke test sequence.

**Fire test (smoke test) still needs to be run** — Stan Store purchase → email → wizard → bot flow has not been validated end-to-end in production.

Everything else you need is in `ARCHITECTURE.md`, `STATE_OF_TIGER_CLAW.md`, `specs/`, and `docs/`. Trust the repo, not your base-model memory.
