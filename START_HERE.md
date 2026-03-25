# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
Stop what you are doing. Read this entire document and `CLAUDE.md`. These are your injected directives. Do not ask Brent to repeat himself. Do not rely on hallucinated history.

---

## 1. The Current State of the Universe

**Tiger Claw is LIVE on Google Cloud Run (`https://api.tigerclaw.io`).**

- **Architecture:** V4 Stateless Serverless — one API process, all tenants, context resolved per-request
- **Database:** PostgreSQL HA via Cloud SQL Proxy (`tiger_claw_shared`)
- **Cache/Queue:** Redis HA + BullMQ (6 queues: provision, telegram, line, fact-extraction, ai-routines, global-cron)
- **AI Engine:** Gemini 2.0 Flash (LOCKED — `gemini-2.5-flash` has a GCP function-calling bug, do not use it)
- **Tests:** 382/382 passing
- **Flavors:** 10 customer-facing industry flavors (doctor was removed — healthcare compliance risk)

**Strict Rule 1:** OpenClaw, Mini-RAG, and per-tenant Docker containers are DEAD. Their folders have been physically eradicated. Do not reference or restore them.

**Strict Rule 2:** `main` is branch-protected. NEVER push directly. Always use `feat/` branches and `gh pr create`.

**Strict Rule 3:** Read `CLAUDE.md` before writing any code. It contains non-negotiable product and engineering directives.

---

## 2. What Has Been Accomplished

1. **V4 Stateless Architecture** — Cloud Run API, shared PostgreSQL, Redis, BullMQ. No Docker containers per tenant.
2. **18 Native Function Calling Tools** — All in `api/src/tools/`. Backed by 382 passing tests.
3. **Business Model: Card Upfront** — No free trial. Card charged at checkout via Stan Store. 7-day money-back guarantee, no questions asked. The `trialExpired` code path is dead and removed.
4. **Key Strategy: Primary + Backup, 6 Providers** — Wizard supports all 6 AI providers (Google, OpenAI, Anthropic, Grok, OpenRouter, Kimi). Auto-detects provider from key prefix on paste. Server validates on INSTALL.
5. **Memory Architecture V4.1 (All 4 Phases)** — `buildSystemPrompt()` is async. Injects ICP, hive signals, pipeline stats, and fact anchors on every request. Sawtooth compression, fact anchor extraction, and focus primitives all shipped (PRs #20–#24, merged).
6. **Value-Gap Detection Cron** — 9 AM UTC daily: active tenant with zero leads in 3 days fires a diagnostic message to the operator. Per CLAUDE.md mandate. Merged PR #26.
7. **Dead Code Removal** — `tiger_knowledge` (dead Mini-RAG tool) removed PR #27. `tiger_keys` simplified from 4-layer to Primary+Backup PR #28.
8. **System Prompt Fixes** — Tool count corrected (18), `tiger_keys` telemetry parameter fixed (`httpStatus` not `error`). Merged PR #29.
9. **Flavor File Review & Cleanup — COMPLETE** — All 10 remaining flavors reviewed. Doctor dropped (compliance risk). Loose language tightened across real-estate, health-wellness, plumber, lawyer, gig-economy, candle-maker, baker. PR #30 (pending merge).
10. **Integrity First Product Philosophy** — Baked into `CLAUDE.md`. Non-negotiable for all future code.
11. **Website + OG Tags** — `tigerclaw.io` updated with product naming, Stan Store links, 7-day MBG banner, OG/Twitter Card meta tags, claw graphic (1200×675). Flavor count updated to 10.
12. **Hive Intelligence (V4 Analytics)** — Universal Prior, Founding Member Program, ICP signal mapping. Migrations 005a-009.

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

## 5. Open Issues (Priority Order)

1. **PR #30 — flavor cleanup pending merge.** Drop doctor, tighten language. 382/382 tests green.
2. **Mac cluster Reflexion Loop tooling** — Offline batch job for `fact_anchors` / `chat_memory` analysis not built yet. Not a production blocker.

---

## FINAL REMINDER

`CLAUDE.md` contains the non-negotiable product philosophy and engineering constraints. Read it before writing any code.

Everything else you need is in `ARCHITECTURE.md`, `STATE_OF_TIGER_CLAW.md`, `specs/`, and `docs/`. Trust the repo, not your base-model memory.
