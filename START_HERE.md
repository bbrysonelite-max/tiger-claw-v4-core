# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
Stop what you are doing. Read this entire document and `CLAUDE.md`. These are your injected directives. Do not ask Brent to repeat himself. Do not rely on hallucinated history.

---

## 1. The Current State of the Universe

**Tiger Claw is LIVE on Google Cloud Run (`https://api.tigerclaw.io`).**

- **Architecture:** V4 Stateless Serverless — one API process, all tenants, context resolved per-request
- **Database:** PostgreSQL HA via Cloud SQL Proxy (`tiger_claw_shared`)
- **Cache/Queue:** Redis HA + BullMQ (5 queues: provision, telegram, line, fact-extraction, ai-routines, global-cron)
- **AI Engine:** Gemini 2.0 Flash (LOCKED — `gemini-2.5-flash` has a GCP function-calling bug, do not use it)
- **Tests:** 155/155 passing

**Strict Rule 1:** OpenClaw, Mini-RAG, and per-tenant Docker containers are DEAD. Their folders have been physically eradicated. Do not reference or restore them.

**Strict Rule 2:** `main` is branch-protected. NEVER push directly. Always use `feat/` branches and `gh pr create`.

**Strict Rule 3:** Read `CLAUDE.md` before writing any code. It contains non-negotiable product and engineering directives.

---

## 2. What Has Been Accomplished

1. **V4 Stateless Architecture** — Cloud Run API, shared PostgreSQL, Redis, BullMQ. No Docker containers per tenant.
2. **19 Native Function Calling Tools** — All in `api/src/tools/`. Backed by 155 passing tests.
3. **4-Layer Key Protection** — Platform Onboarding → Tenant Primary → Tenant Fallback → Platform Emergency. Graceful degradation, never goes dark.
4. **Hive Intelligence (V4 Analytics)** — Universal Prior, Founding Member Program, ICP signal mapping. Migrations 005a-009.
5. **Gemini 2.0 Flash Lock + Schema Hardening** — Fixed silent GCP JSON parameter suppression bug.
6. **72-Hour Trial Cron Engine** — Native trial depletion warnings (24h, 48h, 72h) via global-cron heartbeat.
7. **Key Rotation to Secret Manager** — All Google AI keys vaulted in Cloud Secret Manager.
8. **CORS Fixed** — `wizard/auth` API call works cleanly from `wizard.tigerclaw.io`.
9. **Memory Architecture V4.1** — All 4 phases shipped (see below).
10. **Integrity First Product Philosophy** — Baked into `CLAUDE.md`. Non-negotiable for all future code.
11. **Website Fixed** — Industry Agent naming, Stan Store deep links, Pre-Flavored label on Tiger-Claw Pro.

---

## 3. Memory Architecture (V4.1 — Fully Shipped)

`buildSystemPrompt()` is **async**. On every request it injects three live signals:
- **Operator profile** — from `onboard_state.json` (name, product, ICP, top result)
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
- [x] Phase 1: Dynamic prompt enrichment (ICP + hive + pipeline) — shipped
- [x] Phase 2: Sawtooth context compression (`chat_memory`) — shipped
- [x] Phase 3: Fact anchor extraction (`tenant_states.fact_anchors`) — shipped
- [x] Phase 4: `startFocus` / `completeFocus` primitives — shipped (PR #23 pending merge)

**Mac cluster (192.168.0.2) is an OFFLINE ops tool.** It reads Cloud SQL via Auth Proxy for Reflexion Loop analysis. It is NOT called by Cloud Run and cannot break production.

---

## 4. Product (as of 2026-03-24)

| Product | Price | Stan Store URL |
|---|---|---|
| Tiger-Claw Pro (Pre-Flavored) | $147/mo | `stan.store/brentbryson/p/tired-of-manually-searching-for-leads-` |
| Industry Agent | $197/mo | `stan.store/brentbryson/p/custom-agent-flavor` |

- Tiger-Claw Pro = pre-trained for sales and network marketing. Ships ready. No configuration.
- Industry Agent = domain pre-trained for a specific vertical. Custom flavor injection.
- "Standard Agent" is a dead name. It is "Industry Agent."

---

## 5. Open Issues (Priority Order)

1. **Value-gap detection** — 7-day lead check cron → Value Check-in message to operator. Required by CLAUDE.md.
2. **Wizard deploy stale** — PRs #23/#24 must merge to trigger fresh Vercel build (kills stale `[Mockup]` artifact).
3. **OG/social meta tags** — `tigerclaw.io` missing `og:title`, `og:image`, `twitter:card`.
4. **Wizard auth error has no purchase link** — Dead end for new customers who haven't bought yet.
5. **Mac cluster Reflexion Loop tooling** — Offline batch job for fact_anchors / chat_memory analysis not built yet.

---

## FINAL REMINDER

`CLAUDE.md` contains the non-negotiable product philosophy and engineering constraints. Read it before writing any code.

Everything else you need is in `ARCHITECTURE.md`, `STATE_OF_TIGER_CLAW.md`, `specs/`, and `docs/`. Trust the repo, not your base-model memory.
