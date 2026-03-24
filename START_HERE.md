# START HERE — THE MASTER RESURRECTION BRIEFING
**Updated:** 2026-03-23 | Session: Skills admin routes, email trial reminders, 4 hardening fixes — 376/376 tests

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
- **Admin Dashboard:** wizard.tigerclaw.io/admin/canary — live after PR #15 merges
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
6. **Web Wizard QA** — CORS block on /wizard/auth investigated. **Confirmed: CORS is working correctly.** OPTIONS returns 204 with all required headers. This P0 was a false alarm.
7. **PRs #5-#8** — NM clichés removed, banned phrases global, admin-provisioned tenant tool routing fixed, CI auto-merge enabled.
8. **Intelligence Overhaul (ea92225)** — Routing table replaced with TOOL JUDGMENT. First-message nudge added.
9. **Canary Dashboard (36f38c3)** — `wizard.tigerclaw.io/admin/canary` — full React fleet view with auth, tenant table, onboarding status. Live after PR #15 merges.
10. **FITFO Protocol** — FITFO.md created. Injected into every agent system prompt.
11. **Self-Improvement Engine** — self-improvement.ts rewritten. 1-fail threshold. Skills drafted on failure. Approved skills injected at runtime.
12. **Migration 013: Skills Table** — Dynamic agent skills with full scope/status/trigger/metrics schema.
13. **Stage 4 Tests (tiger_convert)** — 30 tests. All passing.
14. **GitGuardian Unblock (partial)** — `sk_test_fake` Stripe key pattern in webhooks.test.ts replaced. PR #15 still blocked by `AIza*` patterns in wizard.test.ts.
15. **tiger_scout tests** — Unskipped. Rewrote with mutable-object mock pattern. 3/3 passing.
16. **tiger_contact tests** — Unskipped. Completely rewritten against real API (queue/mark_sent/list). 8/8 passing.
17. **Broken Window Sweep — 11 failing tool tests fixed.** All 19 tool test files rewritten to match real service-layer APIs. 0 skipped.
18. **365 tests passing, 0 TypeScript errors.** 33 test files. All green.
19. **GitGuardian unblocked.** wizard.test.ts AIza* → GAPI* replacement. PR #15 GitGuardian clean.
20. **Skills admin routes.** GET/approve/reject/promote/DELETE for skills curation. logAdminEvent on every transition.
21. **Duplicate draft skills bug fixed.** Migration 014 adds partial unique index on (tenant_id, name) WHERE status='draft'.
22. **Email trial reminders.** 24h/48h/72h trial routines now send email alongside Telegram. No silent drops.
23. **Hardcoded URL fix.** app.tigerclaw.io → FRONTEND_URL env var (wizard.tigerclaw.io fallback) in all prompts and paused-bot messages.
24. **376 tests passing, 0 TypeScript errors.** 33 test files. 11 new admin skills tests.

---

## 4. Current Critical Issues

### ✅ RESOLVED — PR #15 GitGuardian Unblocked
wizard.test.ts AIza* patterns replaced with GAPI* prefix. 13/13 tests passing. Pushed as fd5b2ac.

### 🔴 P0 — Canaries Have No Personality
All 10 canaries have empty `onboard_state.json`. The bot has no ICP, no product, no identity.
Options: (1) `POST /admin/tenants/:id/reset-conversation` clears Redis history → triggers first-message nudge. (2) Tell canaries to message their bot "let's start over."

### 🔴 P0 — Intelligence Fix Untested in Production
Routing table removal + TOOL JUDGMENT + FITFO all pending PR merge. Once live, test manually. Monitor `[AI]` log lines in Cloud Run.

### ✅ RESOLVED — All 19 Tool Tests Now Passing
365/365 tests, 33 files, 0 skipped. Committed as `c754fed`.

### 🟠 P1 — Multi-provider BYOK | Hive Injection | Email Stub | LINE Incomplete
Items 3, 4, 6 of the 6-item plan. All not started.

---

## 5. Immediate Directives (Execute In Order)

- [x] **Fix wizard.test.ts AIza* patterns** — Done. GAPI* replacement. PR #15 unblocked.
- [x] **Skills admin routes** — Done. PR #16. GET/approve/reject/promote/DELETE.
- [x] **Email trial reminders** — Done. PR #16. 24h/48h/72h now email + Telegram.
- [ ] **Canary reset** — Clear Redis history for any canary without onboard_state.json, have them complete onboarding
- [ ] **Manual canary test** — Ask each bot open strategy questions, monitor logs
- [ ] **resolveAIProvider** — Item 3 of 6-item plan (OpenAI BYOK)
- [ ] **Hive injection** — Item 4 of 6-item plan
- [ ] **Skills admin routes** — /admin/skills curation endpoints

---

## 6. Questions Awaiting Brent's Answer

1. **Skills curation:** Admin-only (ADMIN_TOKEN) or tenant UI?
2. **Auto-drafted skill status:** `draft` (admin review required) or `auto-approved` (tenant-scoped immediate)?

---

## 7. Key File Locations

- `/tiger-claw/FITFO.md` — Agent operating protocol
- `/tiger-claw/STATE_OF_TIGER_CLAW.md` — This session's hard state
- `/Users/brentbryson/Desktop/TIGERCLAW_PUNCH_LIST.md` — Full weakness detail
- `api/src/services/ai.ts` — buildSystemPrompt, FITFO injection, skill injection
- `api/src/services/self-improvement.ts` — 1-fail threshold, draftSkillFromFailure
- `api/migrations/013_skills.sql` — Skills table schema
- `web-onboarding/src/app/admin/canary/page.tsx` — Fleet dashboard UI

---
*Trust the spec, not LLM memory. Read STATE_OF_TIGER_CLAW.md next. Execute.*
