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

**Strict Rule 4:** Anthropic is NOT wired. Do not add it back to the wizard without implementing the full `@anthropic-ai/sdk` code path in `api/src/services/ai.ts`. It is deferred to Sprint 2 intentionally.

---

## 2. What Has Been Accomplished

1. **V4 Stateless Architecture** — Cloud Run API, shared PostgreSQL, Redis, BullMQ. No Docker containers per tenant.
2. **18 Native Function Calling Tools** — All in `api/src/tools/`. Backed by 374 passing tests.
3. **Business Model: Card Upfront** — No free trial. Card charged at checkout via Stan Store. 7-day money-back guarantee. The `trialExpired` code path is dead and removed.
4. **Key Strategy: Primary + Backup, 5 Live Providers** — Google, OpenAI, Grok, OpenRouter, Kimi. Grok/OpenRouter/Kimi route through OpenAI SDK with custom `baseURL`. Anthropic deferred to Sprint 2.
5. **Memory Architecture V4.1 (All 4 Phases)** — `buildSystemPrompt()` is async. Injects ICP, hive signals, pipeline stats, and fact anchors on every request. Sawtooth compression, fact anchor extraction, and focus primitives all shipped (PRs #20–#24, merged).
6. **Value-Gap Detection Cron** — 9 AM UTC daily: active tenant with zero leads in 3 days fires a diagnostic message to the operator. Per CLAUDE.md mandate. Merged PR #26.
7. **Dead Code Removal** — `tiger_knowledge` removed PR #27. `tiger_keys` simplified PR #28. `resolveGoogleKey` removed PR #41.
8. **System Prompt Fixes** — Tool count corrected (18), telemetry param fixed. Merged PR #29.
9. **Flavor Cleanup** — All 10 remaining flavors reviewed. Doctor dropped (compliance risk). PR #30 merged.
10. **Integrity First Product Philosophy** — Baked into `CLAUDE.md`. Non-negotiable.
11. **Website + OG Tags** — `tigerclaw.io` updated with product naming, Stan Store links, 7-day MBG banner.
12. **Hive Intelligence (V4 Analytics)** — Universal Prior, Founding Member Program, ICP signal mapping.
13. **PRs #30–#45 merged. PR #46 open.** Admin dashboard live. Email support agent live.
14. **Beta Hardening (PRs #41–#44)** — ADMIN_TOKEN rotated, Telegram webhook secret wired, dead trial code removed, fix-all-webhooks corrected.
15. **Email Infrastructure** — Resend wired (RESEND_API_KEY in GCP Secrets), `tigerclaw.io` domain added (DNS propagating). FROM_EMAIL = `hello@tigerclaw.io`.
16. **Email Support Agent (PR #45)** — `POST /webhooks/email` inbound Postmark webhook. AI generates replies using platform key. Sends from `support@tigerclaw.io` via Resend.
17. **Wizard Hardening** — Magic link auto-opens wizard with email pre-filled. Niche required. Doctor removed from UI. Provider tiles open key page on click. Magic link URL fixed.
18. **Multi-Provider AI (PR #46)** — Kimi, Grok, OpenRouter wired as OpenAI-compatible. `OPENAI_COMPAT` base URL map in `ai.ts`. All 4 OpenAI client instantiations pass `baseURL` when set.
19. **FIRE TEST CONFIRMED** — Telegram bot responding in character (2026-03-26, midnight). End-to-end message delivery working.

---

## 3. Memory Architecture (V4.1 — Fully Shipped)

`buildSystemPrompt()` is **async**. On every request it injects four live signals:
- **Operator profile** — from `onboard_state` in `tenant_states`
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

**Memory phases — all complete:**
- [x] Phase 1: Dynamic prompt enrichment — merged PR #20
- [x] Phase 2: Sawtooth context compression — merged PR #21
- [x] Phase 3: Fact anchor extraction — merged PR #22
- [x] Phase 4: `startFocus` / `completeFocus` primitives — merged PR #23

**Mac cluster (192.168.0.2) is an OFFLINE ops tool.** Not called by Cloud Run. Cannot break production.

---

## 4. Product (as of 2026-03-26)

| Product | Price | Stan Store URL |
|---|---|---|
| Tiger-Claw Pro (Pre-Flavored) | $147/mo | `stan.store/brentbryson/p/tired-of-manually-searching-for-leads-` |
| Industry Agent | $197/mo | `stan.store/brentbryson/p/custom-agent-flavor` |

- Tiger-Claw Pro = pre-trained for sales and network marketing. Ships ready.
- Industry Agent = domain pre-trained for a specific vertical.
- "Standard Agent" is a dead name. It is "Industry Agent."
- **No free trial.** Card upfront. 7-day money-back guarantee.

**10 Customer-Facing Flavors:** network-marketer, real-estate, health-wellness, airbnb-host, baker, candle-maker, gig-economy, lawyer, plumber, sales-tiger.

---

## 5. Tenant Roster

| Slug | Status | Email | Notes |
|---|---|---|---|
| `debbie-cameron` | live | justagreatdirector@outlook.com | Paying customer. Magic link sent 2026-03-25 |
| `john-thailand` | live | vijohn@hotmail.com | Paying customer (John and Noon). Magic link sent 2026-03-25 |
| `chana-loha` | live | chana.loh@gmail.com | Paying customer (Chana Lohasaptawee). Magic link sent 2026-03-25 |

**7 past customers** (paid, never received service) preserved for post-Zoom outreach. See memory file for emails and draft message.

---

## 6. Email Infrastructure

| Address | Purpose | Status |
|---|---|---|
| `hello@tigerclaw.io` | Transactional outbound (magic links) | ✅ Sending via Resend |
| `support@tigerclaw.io` | AI-handled inbound support | ✅ Live via Postmark |
| `noreply@tigerclaw.io` | System alerts | Planned |
| `brent@tigerclaw.io` | Personal | Planned |

**Resend domain:** `tigerclaw.io` added, DNS records on Porkbun — pending propagation (DKIM + SPF).

---

## 7. Bot Pool

- **Available:** 63 tokens
- **Assigned:** 13 tokens (real customers + internal/sandbox)
- **Status:** Healthy

---

## 8. What Was Done This Session (2026-03-25 → 2026-03-26)

- **Fire test** — bot confirmed live and responding in character on Telegram
- **Email infra** — RESEND_API_KEY wired, FROM_EMAIL corrected, Resend domain added, Postmark inbound configured
- **Email support agent** — PR #45 merged: Postmark → BullMQ → AI → Resend
- **Bot pool cleanup** — 21 demo/tombstone tenants deprovisioned, pool 42 → 63
- **3 paying customers** — emails corrected in DB, magic links sent
- **Admin dashboard** — Vercel redeployed, now live
- **Wizard hardening** — magic link URL, auto-open, niche required, doctor removed, tile UX
- **Multi-provider AI** — Kimi, Grok, OpenRouter wired end-to-end; Anthropic deferred
- **Docs** — START_HERE.md, STATE_OF_TIGER_CLAW.md updated

---

## 9. Tomorrow (2026-03-26) — Pre-Zoom Sprint

- Morning: ROADMAP.md, KNOWN_ISSUES.md, CHANGELOG.md
- Polish pass on wizard and website
- Practice run
- Break ~3–4 PM Pacific
- Zoom call: **2026-03-27 (Thursday), 7 PM Pacific**

---

## FINAL REMINDER

`CLAUDE.md` contains the non-negotiable product philosophy and engineering constraints. Read it before writing any code.

Everything else you need is in `ARCHITECTURE.md`, `STATE_OF_TIGER_CLAW.md`, `specs/`, and `docs/`. Trust the repo, not your base-model memory.
