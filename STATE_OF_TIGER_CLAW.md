# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp Generated:** 2026-03-23T23:30:00-07:00
**Infrastructure Status:** LIVE (365 tests green, CI auto-merge active, 10 canary tenants provisioned)
**Last Session:** Broken Window Sweep — All 19 tool tests rewritten and passing, wizard.test.ts GitGuardian fix pending

---

## 🛑 MANDATORY DIRECTIVE TO ALL AI AGENTS 🛑
This document is the absolute, most recent source of truth for this repository.

1. **NO RAG.** No Mini-RAG pipelines here.
2. **NO OPENCLAW.** No per-tenant Docker containers.
3. **ARCHITECTURE:** Stateless Cloud Run API, Gemini 2.0 Flash (LOCKED — 2.5 Flash silently strips JSON params), 19 Native Function Calling Tools, Schema-per-tenant Postgres.
4. **NO REWRITES:** 19 core tools compile and are backed by 254 passing tests. Do not rewrite architecture.
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

## Current State (2026-03-23 Late Night)

### What Was Done This Session

**Broken Window Sweep — Phase 2 (branch: feat/intelligence-prompt-rewrite, commit: c754fed):**

**Summary: All 19 tool test files now have passing tests. 365/365 tests, 0 skipped, 0 TypeScript errors.**

**11 tool tests completely rewritten:**

**1. tiger_settings** — Switched from ctx.storage to tenant_data.js `getTenantState`/`saveTenantState`. Tests: get/set/reset actions with valid settings keys.

**2. tiger_lead** — Switched from CRUD creation (`{name, email}`) to search-by-name detail view. Full LeadRecord shape in mocks.

**3. tiger_score** — Switched from `{contactId, score:0-100}` to real API: `score`/`list`/`update_engagement` actions. Added `hiveEmitter.js` mock. Key insight: `builderScore = profileFit×0.30 + intentScore×0.45 + engagement×0.25` — 100+100+0 = 75, below 80 threshold.

**4. tiger_move** — Switched from `{contactId, toStatus}` to `{name, status, confirm}`. Key insight: without `confirm:true` returns `awaitingConfirmation:true`; same-status move returns `ok:true, changed:false` (not ok:false).

**5. tiger_aftercare** — Switched from `{contactId, type}` to `{action:'enroll', leadId, oar}`. Requires complete `onboard_state.json`. Full tenant_data stack mocked.

**6. tiger_export** — Switched from `{format:'csv'}` checking `data.contacts` to `{filter?}` checking `data.rowCount` and `file.content`. Returns leads, not contacts.

**7. tiger_hive** — Switched from global fetch mock to raw http module pattern. Must set `INTERNAL_API_URL=http://127.0.0.1:19999`. Actions: query/submit/generate/list. Falls back gracefully on ECONNREFUSED.

**8. tiger_import** — Switched from `{contacts:[...]}` to `{action:'import'/'preview'/'status', csv:string}`. Dedup by `displayName`, not email.

**9. tiger_keys** — Switched from `{apiKey, action:'activate'}` to `{action:'status'/'report_error'/'rotate'/'restore_key'}`. Mocks `db.js` (getBotState/setBotState/getTenant) and `email.js`. `INTERNAL_API_URL` required.

**10. tiger_objection** — Fixed 1 test: empty `prospectText` returns `ok:true` (classifies to 'general' bucket), not `ok:false`.

**11. tiger_search** — Switched from ctx.storage contact records to full LeadRecord mocks via tenant_data.js. Query syntax: plain text, `status:new`, `score:60+`, tag matching.

**GitGuardian Status:** STILL BLOCKING PR #15
- `wizard.test.ts` contains `AIza*` Google key patterns.
- Blanket sed replacement attempted → broke 13 tests (assertion values matched payloads).
- Stashed, not committed. Needs careful manual fix: read each `AIza*` occurrence, replace only in payload positions, update corresponding assertions.

**Test count: 365 passing (up from 254), 0 TypeScript errors, 33 test files, 0 skipped.**

### Architectural Decisions Locked (all prior + carried forward)

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
| Tool test priority | COMPLETE | All 19 tool tests passing ✅ — 365/365 tests, 0 skipped |
| Skills curation access | PENDING BRENT | Admin-only or tenant UI? |
| Auto-drafted skill status | PENDING BRENT | draft (admin review) or auto-approved (tenant-scoped)? |

### The 10 Canaries
All admin-provisioned. All have empty `onboard_state.json`. First-message nudge is live.

All 10 canaries need onboarding reset. Once PR #15 merges, the canary dashboard will show each bot's status in real time.

---

## Open Issues — Ranked by Damage

### 🔴 P0 — PR #15 Blocked: wizard.test.ts AIza* Patterns
GitGuardian flags Google AI key patterns (`AIza*`) in `wizard.test.ts`. The file has multiple occurrences — some are payload values being sent TO the API, some are assertion values checking what was STORED. Blanket replacement breaks assertions.
**Fix Required:** Read `api/src/routes/__tests__/wizard.test.ts` carefully. Replace `AIza*` strings in request/payload positions with `GOOGLE_AI_TEST_KEY_PLACEHOLDER`. Update any assertions that check for the old value. Do not touch occurrences that test "was the correct key rejected/accepted".
**Current state:** Broken attempt is stashed. 365/365 tests green without the stash applied.

### 🔴 P0 — All 10 Canaries Have No Personality Data
Empty `onboard_state.json`. First-message nudge fires for new conversations only.
**Fix:** `POST /admin/tenants/:id/reset-conversation` — clears Redis chat history. OR instruct canaries to message their bot "let's start over."

### 🔴 P0 — Intelligence Fix Untested in Production
Changes live (pending PR merge) but never observed in real canary conversation.
**Fix:** After PR merges — test each canary bot manually. Monitor Cloud Run logs ([AI] prefix).

### ✅ RESOLVED — All 19 Tool Tests Passing
365/365, 33 files, 0 skipped. All tool test files rewritten to match real service-layer APIs. Committed as `c754fed`.

### 🟠 P1 — Single AI Provider
Hard-locked to Gemini 2.0 Flash. Item 3 of 6-item plan. Not started.

### 🟠 P1 — Hive Benchmarks Not in System Prompt
Hive data not in agent context. Item 4 of 6-item plan. Not started.

### 🟠 P1 — Email Is a Stub
Resend not implemented. RESEND_API_KEY unused. No transactional email.

### 🟠 P1 — LINE/Facebook Scouting Incomplete
Facebook: silently returns empty if SERPER_KEY_* missing. LINE: reads local file, not real LINE API.

### 🟡 P2 — Skills Curation Has No Admin Routes
Migration 013 created. Skills being drafted. No view/approve/reject/promote routes.

### 🟡 P2 — OpenAI Tool Declaration Mapper
19 tools in Gemini format. Needed before multi-provider BYOK goes live.

### 🟡 P2 — No Pause Override for Operator
No way to stop bot mid-conversation. Verify `tenantPaused` flag in `processTelegramMessage`.

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
- **Admin Dashboard:** wizard.tigerclaw.io/admin/canary (live after PR #15 merges)
- **Payments:** Stan Store + Stripe
- **Email:** Resend (STUB — not implemented)
- **Bot Pool:** 42+ Telegram tokens, AES-256-GCM encrypted
- **GCP Project:** hybrid-matrix-472500-k5, region us-central1
- **Key Layers:** L1 platform onboarding (72h), L2 tenant primary BYOK, L3 tenant fallback BYOK, L4 platform emergency

## Punch List
Full weakness detail + plans: /Users/brentbryson/Desktop/TIGERCLAW_PUNCH_LIST.md

---
*Locked. Proceed.*
