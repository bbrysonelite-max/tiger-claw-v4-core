# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
**Stop what you are doing. Read this entire document and read `ARCHITECTURE.md`. This is your injected context. Do not ask Brent to repeat himself. Do not rely on hallucinated history.**

## 1. The Current State of the Universe
**Tiger Claw is LIVE and COMPILATION GREEN.** 
- **Architecture:** V4 Stateless Serverless on Google Cloud Run (`https://api.tigerclaw.io`).
- **Database:** Postgres HA via Cloud SQL Proxy.
- **Cache:** Redis HA.
- **Strict Rule 1:** OpenClaw, Mini-RAG, and per-tenant Docker containers ARE DEAD. I physically eradicated their folders `skills/`, `.agents/`, `docker/`, and `Mini-RAG/` from this repo permanently. 
- **Strict Rule 2:** `main` is branch-protected. DO NOT attempt to push directly. Every agent must check out a `feat/` branch and use `gh pr create` to submit changes.

## 2. What We Accomplished Last Session
1. **GitHub Repository Lockdown:** Deployed strict branch protection via the active REST API. Established `.github/CODEOWNERS` mandating Brent's approval, required tests, and completely shut out direct raw-pushes.
2. **The Hive Intelligence Rollout (V4 Analytics):** Deployed the Universal Prior, Founding Member Program, and autonomous ICP signal mapping engine across the database layer (Migrations 005a-009) and the native agent loop (`tiger_scout`, `tiger_convert`). Successfully wired the nightly aggregation engine to power the front-end dashboard, completely decoupled from PII hazards.
2. **The Great Google Schema Hunt:** Successfully patched a horrific blind-bug in Google's `gemini-2.5-flash-preview` GCP instances where lowercase JSON tool parameters were aggressively suppressed, silently throwing empty `parts:[]` responses. We downgraded globally to the bulletproof `gemini-2.0-flash` layer and heavily hardened `mapToGoogleSchema` with explicit strict `SchemaType.OBJECT` compiler exports.
3. **Onboarding Flow Streamlining:** Axed the entire API key interrogation phase from the native Telegram Onboarding flow, letting tenants instantly spin up their flywheel without provisioning delays.
4. **The 72-Hour Cron Pulse Engine:** Activated a native conversational trial engine running exclusively in the stateless `global-cron`. The engine natively scans the timestamp differentials across active tenants and intercepts their Webhooks to deploy extremely flavorful, dynamically generated 24h, 48h, and 72h free-trial depletion warnings securely into their operator chat window utilizing native Telegram payloads.
5. **The Great Google Key Disaster & Architecture Hardening:** Safely navigated a catastrophic 403 Google API key deprecation/leak event. We vaulted brand new, explicitly tested Google keys into Cloud Secret Manager and established a zero-downtime deployment flow for the master API router. Re-verified `gemini-2.0-flash` as the absolute core engine. Cleaned out duplicate `Rules.md` files causing terminal loop hallucinations.
6. **Web Wizard Subagent QA:** Deployed an autonomous browser subagent against the production Next.js onboarding bridge. Discovered a fatal `Failed to fetch` (CORS missing `Access-Control-Allow-Origin`) block explicitly preventing users from advancing past Step 1 (Identity & Niche) to contact the `api.tigerclaw.io/wizard/auth` endpoint.

## 3. Memory Architecture (V4.1 — Active)

`buildSystemPrompt()` is now **async**. On every request it injects three live signals:
- **Operator profile** — from `onboard_state.json` (name, product, ICP, top result)
- **Network intelligence** — top 3 `hive_signals` rows for this tenant's vertical/region
- **Pipeline stats** — live lead counts from `tenant_leads`

All three are loaded in `Promise.all()` and fail silently — DB unreachable = static prompt, no crash.

**Redis key inventory:**
| Key | Purpose | TTL |
|---|---|---|
| `chat_history:{tenantId}:{chatId}` | Raw turn history | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Sawtooth compressed summaries *(Phase 2)* | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending *(Phase 4)* | 24 hours |

**Mac cluster (192.168.0.2) is an OFFLINE ops tool.** It reads Cloud SQL via Auth Proxy for Reflexion Loop analysis. It is NOT called by Cloud Run and cannot break production.

**Memory phases:**
- [x] Phase 1: Dynamic prompt enrichment (ICP + hive + pipeline) — shipped
- [ ] Phase 2: Sawtooth context compression (`chat_memory`)
- [ ] Phase 3: Fact anchor extraction (`tenant_states.fact_anchors`)
- [ ] Phase 4: `startFocus` / `completeFocus` primitives

## FINAL REMINDER
Everything you need is in `ARCHITECTURE.md`, `specs/`, and `Rules.md`. Trust the GitHub spec, not your LLM memory.
