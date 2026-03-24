# START HERE — THE MASTER RESURRECTION BRIEFING
**Updated:** 2026-03-23 | Session: Intelligence Overhaul + FITFO Protocol + Self-Improvement Engine

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
Stop. Read this entire document and STATE_OF_TIGER_CLAW.md before doing anything else. This is your injected context. Do not ask Brent to repeat himself. Do not rely on LLM memory.

---

## 1. What Tiger Claw Is

**Tiger Claw is an autonomous AI sales and recruiting agent platform.** Multi-tenant SaaS. Stateless Cloud Run API. One bot per tenant. 19 native Gemini function-calling tools: Discovery → First Contact → Nurture → Conversion → Retention.

The agent is NOT a chatbot. It is a strategic consulting partner. It thinks, decides, acts. It has persistent memory (Redis chat history), a self-improvement engine (skills table, 1-fail threshold), and cross-tenant learning (Hive).

**FITFO.md at repo root is the agent operating protocol.** Five rules: Ant (never stops), Resource (identify dependencies first), Failure (1 fail = skill draft), Exhaustion (ask for help only after exhausting all options), Growth (use what you learn to improve). Every agent runs under it.

---

## 2. The Architecture (Immutable)

- **API:** Cloud Run, Node.js/Express, port 4000
- **DB:** Cloud SQL PostgreSQL HA, schema-per-tenant
- **Cache/Queue:** Cloud Redis HA + BullMQ (5 queues: telegram-webhooks, line-webhooks, ai-routines, global-cron, admin-events)
- **AI:** Gemini 2.0 Flash — LOCKED. 2.5 Flash silently strips JSON function call parameters.
- **Skills:** Dynamic prompt/template skills via `skills` table (migration 013). Loaded at runtime.
- **Self-improvement:** 1-fail threshold. Any tool failure → immediate `draftSkillFromFailure()`.
- **Frontend:** Next.js on Vercel (wizard.tigerclaw.io)
- **Payments:** Stan Store + Stripe
- **Email:** Resend (STUB — not yet implemented)
- **Bot Pool:** 42+ Telegram bot tokens, AES-256-GCM encrypted
- **GCP Project:** hybrid-matrix-472500-k5

**Hard rules:**
- NO RAG. NO OpenClaw. NO per-tenant Docker containers.
- NO rewrites of the 19 tools without full test coverage.
- NEVER push to main. Feature branch → PR → CI green → auto-merge → deploy.
- NEVER upgrade Gemini beyond 2.0 Flash without full regression cycle.

---

## 3. What Was Accomplished (Full Chronological History)

1. **GitHub Lockdown** — Branch protection, CODEOWNERS, CI gate.
2. **Hive Intelligence (V4)** — Universal Prior, Founding Member program, ICP signal mapping. Migrations 005a-011.
3. **Gemini Schema Bug Fix** — Patched JSON stripping in 2.5 Flash. Downgraded to 2.0 Flash. Hardened mapToGoogleSchema.
4. **72-Hour Trial Engine** — Cron: 24h/48h/72h trial warnings via Telegram. BullMQ jobId dedup.
5. **Google Key Disaster Recovery** — Catastrophic 403 deprecation. New keys in Cloud Secret Manager.
6. **Web Wizard QA** — Discovered CORS block on /wizard/auth. Documented. Not yet fixed.
7. **PRs #5-#8** — NM clichés removed, banned phrases global, admin-provisioned tenant tool routing fixed, CI auto-merge enabled.
8. **Intelligence Overhaul (ea92225)** — Routing table replaced with TOOL JUDGMENT. First-message nudge added.
9. **FITFO Protocol** — FITFO.md created. Injected into every agent system prompt.
10. **Self-Improvement Engine** — self-improvement.ts rewritten. 1-fail threshold. Skills drafted on failure. Approved skills injected at runtime.
11. **Migration 013: Skills Table** — Dynamic agent skills with full scope/status/trigger/metrics schema.
12. **Stage 4 Tests (tiger_convert)** — 30 tests. 243 total passing. 0 TypeScript errors.

---

## 4. Current Critical Issues

### 🔴 P0 — Thursday Zoom with John
John = $20M of $25M revenue. Bots called "dumber than hell." Intelligence fix live but untested against real canary conversations. Thursday 7 PM Scottsdale.

**Before Thursday:**
1. Reset John's bot chat history (force first-message nudge)
2. Have John message his bot and complete onboarding
3. Test manually with real business questions
4. Monitor Cloud Run logs ([AI] prefix)

### 🔴 P0 — No Admin Dashboard
No visual fleet view. Build before Thursday. Table: name, bot handle, onboarding status, key layer, last active.

### 🔴 P0 — Signup Funnel Broken (CORS)
OPTIONS preflight or Vercel env var issue. Fix: OPTIONS handler on /wizard/auth + fix hardcoded URL in StepIdentity.tsx:40.

### 🟠 P1 — 17 Tool Tests Skipped | Single AI Provider | Hive Not Injected | Email Stub | LINE Incomplete

---

## 5. Immediate Directives (Execute In Order)

- [ ] **Commit** current uncommitted work on feat/intelligence-prompt-rewrite
- [ ] **Admin Dashboard** — HTML fleet view before Thursday
- [ ] **CORS fix** on /wizard/auth
- [ ] **tiger_scout tests** — remove describe.skip, first to re-enable
- [ ] **resolveAIProvider** — Item 3 of 6-item plan (OpenAI BYOK)
- [ ] **Hive injection** — Item 4 of 6-item plan
- [ ] **Skills admin routes** — /admin/skills curation endpoints

---

## 6. Questions Awaiting Brent's Answer

1. **Skills curation:** Admin-only (ADMIN_TOKEN) or tenant UI?
2. **Auto-drafted skill status:** `draft` (admin review required) or `auto-approved` (tenant-scoped immediate)?

---

## 7. Desktop Punch List

`/Users/brentbryson/Desktop/TIGERCLAW_PUNCH_LIST.md` — full detail, plans, architectural decisions. Update after every session.

---
*Trust the spec, not LLM memory. Read STATE_OF_TIGER_CLAW.md next. Execute.*
