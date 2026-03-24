# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp Generated:** 2026-03-23T22:00:00-07:00
**Infrastructure Status:** LIVE (243 tests green, CI auto-merge active, 10 canary tenants provisioned)
**Last Session:** Intelligence Overhaul + FITFO Protocol + Self-Improvement Engine

---

## 🛑 MANDATORY DIRECTIVE TO ALL AI AGENTS 🛑
This document is the absolute, most recent source of truth for this repository.

1. **NO RAG.** No Mini-RAG pipelines here.
2. **NO OPENCLAW.** No per-tenant Docker containers.
3. **ARCHITECTURE:** Stateless Cloud Run API, Gemini 2.0 Flash (LOCKED — 2.5 Flash silently strips JSON params), 19 Native Function Calling Tools, Schema-per-tenant Postgres.
4. **NO REWRITES:** 19 core tools compile and are backed by 243 passing tests. Do not rewrite architecture.
5. **FITFO.md:** Agent operating protocol at `/tiger-claw/FITFO.md`. All agents must internalize it.

## 🛑 GIT PROTOCOL — NON-NEGOTIABLE 🛑

- NEVER push to main. Branch-protected.
- ALL work: feature branch → PR → CI green → auto-merge → auto-deploy.
- Brent does NOT review PRs. CI green = ships.
```bash
git checkout -b feat/your-description
npx vitest run   # must pass before PR
git push origin feat/your-description
gh pr create --title "feat: description" --body "What changed and why"
gh pr merge --auto --squash
```
- NEVER checkout main locally. GitHub Actions deploys on merge.

---

## Current State (2026-03-23 Evening)

### What Was Done This Session

**PR ea92225 — Intelligence Overhaul (merged):**
- Removed keyword→tool routing table from `buildSystemPrompt`. Replaced with `TOOL JUDGMENT` section.
- Added `buildFirstMessageText()` — fires `tiger_onboard(action="start")` automatically on first message when onboarding incomplete.
- 5 new `buildFirstMessageText` unit tests. 4 routing-table regression tests.

**Current session (uncommitted, branch: feat/intelligence-prompt-rewrite):**
- **FITFO.md** — Figure It The Fuck Out. Five rules: Ant, Resource, Failure, Exhaustion, Growth.
- **FITFO injected into `buildSystemPrompt`** — every agent has the FITFO protocol in their context window.
- **Migration 013: skills table** — Dynamic agent skills. Fields: type (prompt/template/code), scope (tenant/flavor/platform), status (draft/submitted/approved/rejected/platform), implementation (JSONB), trigger context, metrics.
- **self-improvement.ts rewritten** — `draftSkillFromFailure()` fires immediately on any tool failure. `loadApprovedSkills()` for runtime injection.
- **1-fail threshold in `runToolLoop`** — Any `ok:false` or thrown exception triggers `draftSkillFromFailure()`. Fire-and-forget.
- **Approved skills injected into `buildSystemPrompt`** — appear as `DYNAMIC SKILLS` section.
- **243 tests passing, 0 TypeScript errors.**

### Architectural Decisions Locked 2026-03-23

| Decision | Status | Detail |
|----------|--------|--------|
| 5-layer intelligence architecture | APPROVED | Core 19 tools → dynamic skills → curation → self-improvement → multi-provider BYOK |
| Skills system | APPROVED | Prompt (A) + template (B) now; code (C) future |
| Self-improvement threshold | LOCKED | **1 failure** — immediate draft |
| FITFO protocol | LOCKED | /tiger-claw/FITFO.md governs all agent behavior |
| Provider expansion | APPROVED | Add OpenAI; resolveGoogleKey → resolveAIProvider returning { key, provider, model } |
| Skill scope | LOCKED | tenant → flavor → platform |
| Skill status flow | LOCKED | draft → submitted → approved / rejected / platform |
| Hive benchmark injection | APPROVED | Top 3 signals per flavor/region into system prompt |
| Tool test priority | APPROVED | scout → contact → nurture → briefing → onboard → remaining 12 |
| Skills curation access | PENDING BRENT | Admin-only or tenant UI? |
| Auto-drafted skill status | PENDING BRENT | draft (admin review) or auto-approved (tenant-scoped)? |

### The 10 Canaries
All admin-provisioned. All have empty `onboard_state.json`. **First-message nudge is now live** — but only fires for new/reset conversations. Existing conversations need Redis history cleared to trigger it.

**Critical: John (Thailand)** — $20M of $25M revenue. "Dumber than hell." Zoom Thursday 7 PM Scottsdale. Intelligence fix is live but untested against real canary conversations.

---

## Open Issues — Ranked by Damage

### 🔴 P0 — No Admin Dashboard
No visual fleet view. 10 live canaries. Cannot see status without DB query.
**Fix:** HTML route in admin.ts. Table: name, bot handle, onboarding status, key layer, last active.

### 🔴 P0 — All 10 Canaries Have No Personality Data
Empty onboard_state.json. First-message nudge fires for new conversations only.
**Fix:** `POST /admin/tenants/:id/reset-conversation` — clears Redis chat history.

### 🔴 P0 — Signup Funnel Broken (CORS)
wizard.tigerclaw.io blocked from api.tigerclaw.io/wizard/auth. Zero new signups via web.
**Fix:** OPTIONS preflight handler on /wizard/auth. Fix hardcoded URL in StepIdentity.tsx:40.

### 🔴 P0 — Intelligence Fix Untested in Production
Changes live but never observed in real canary conversation. Thursday is the live test.
**Fix:** Test each canary bot manually. Monitor Cloud Run logs ([AI] prefix).

### 🟠 P1 — 17 of 19 Tool Tests Skipped
CI blind to tool regressions. Priority: tiger_scout → tiger_contact → tiger_nurture → tiger_briefing → tiger_onboard.

### 🟠 P1 — Single AI Provider
Hard-locked to Gemini 2.0 Flash. Item 3 of 6-item plan. Not started.

### 🟠 P1 — Hive Benchmarks Not in System Prompt
Hive data not in agent context. Item 4 of 6-item plan. Not started.

### 🟠 P1 — Email Is a Stub
Resend not implemented. RESEND_API_KEY unused. No transactional email.

### 🟠 P1 — LINE/Facebook Scouting Incomplete
Facebook: silently returns empty if SERPER_KEY_* missing. LINE: reads local file. John's Thai network uses LINE.

### 🟡 P2 — Skills Curation Has No Admin Routes
Migration 013 created. Skills being drafted. No view/approve/reject/promote routes.

### 🟡 P2 — OpenAI Tool Declaration Mapper
19 tools in Gemini format. Needed before multi-provider BYOK goes live.

### 🟡 P2 — No Pause Override for Operator
No way to stop bot mid-conversation. Verify tenantPaused flag in processTelegramMessage.

---

## 6-Item Intelligence Plan Status

| # | Item | Status |
|---|------|--------|
| 1 | Remove routing table; add TOOL JUDGMENT | ✅ Done |
| 2 | First-message onboarding nudge | ✅ Done |
| 3 | Multi-provider BYOK — resolveAIProvider | ⬜ Not started |
| 4 | Hive benchmark injection | ⬜ Not started |
| 5 | self-improvement.ts — real 1-fail threshold | ✅ Done |
| 6 | OpenAI tool declaration mapper | ⬜ Not started |

---

## Architecture Reference

- **API:** Cloud Run, Node.js/Express, port 4000
- **DB:** Cloud SQL PostgreSQL HA, schema-per-tenant isolation
- **Cache/Queue:** Cloud Redis HA + BullMQ (5 queues)
- **AI:** Gemini 2.0 Flash — LOCKED
- **Skills:** Dynamic via skills table (migration 013), loaded at runtime into system prompt
- **Self-improvement:** api/src/services/self-improvement.ts — 1-fail threshold, auto-drafts skills
- **Frontend:** Next.js on Vercel (wizard.tigerclaw.io)
- **Payments:** Stan Store + Stripe
- **Email:** Resend (STUB — not implemented)
- **Bot Pool:** 42+ Telegram tokens, AES-256-GCM encrypted
- **GCP Project:** hybrid-matrix-472500-k5, region us-central1
- **Key Layers:** L1 platform onboarding (72h), L2 tenant primary BYOK, L3 tenant fallback BYOK, L4 platform emergency

## Punch List
Full weakness detail + plans: /Users/brentbryson/Desktop/TIGERCLAW_PUNCH_LIST.md

---
*Locked. Proceed.*
