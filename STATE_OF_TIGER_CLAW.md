# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp Generated:** 2026-03-24T22:30:00-07:00
**Infrastructure Status:** LIVE (254 tests green, CI auto-merge active, 10 canary tenants provisioned)
**Last Session:** Broken Window Sweep — GitGuardian unblock, tool test activation, CORS/dashboard audit

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

## Current State (2026-03-24 Evening)

### What Was Done This Session

**Broken Window Sweep (branch: feat/intelligence-prompt-rewrite, PR #15):**

**1. GitGuardian PR Block — FIXED**
- PR #15 was blocked by GitGuardian detecting `sk_test_fake` (Stripe key pattern) in `webhooks.test.ts`.
- This was introduced in the Phase 1 hardening commit (`f812020`).
- Fixed: replaced with `stripe_test_key_placeholder`.
- PR #15 should now pass CI and auto-merge, deploying everything accumulated in this branch.

**2. CORS — Investigated, NOT broken**
- `wizard.tigerclaw.io/wizard/auth` OPTIONS preflight returns 204 with correct `access-control-allow-origin`.
- GET `/wizard/auth` includes CORS headers. Punch list P0 was a false alarm — already fixed in a prior session.

**3. Admin Fleet Dashboard — Exists, was blocked by PR gate**
- Dashboard lives at `web-onboarding/src/app/admin/canary/page.tsx` (commit `36f38c3`).
- URL: `wizard.tigerclaw.io/admin/canary` — returns 404 only because PR #15 hadn't merged yet.
- Once PR #15 merges: dashboard is live. Full table: name, bot handle, onboarding status, last active, canary badge.

**4. tiger_scout tests — UNSKIPPED, 3/3 passing**
- Rewrote mocks with mutable-object pattern (same as tiger_convert).
- Fixed assertion: output is `'Hunt complete. Sources: ...'` not `'Scans Complete'`.
- Fixed burst-limit test: tool returns `ok: true` with `'Hunt skipped: Maximum 3 burst scans'` (not `ok: false`).

**5. tiger_contact tests — UNSKIPPED, 8/8 passing**
- Original tests targeted `get` / `update` / `delete` actions — those actions do not exist in the tool.
- Completely rewritten against real API: `queue`, `mark_sent`, `list`.
- Added tests for: qualified lead queue, duplicate skip, opted-out rejection, unqualified rejection, mark_sent, list, unknown action.

**Test count: 254 passing (up from 243), 0 TypeScript errors. 15 tool test files still skipped.**

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
| Tool test priority | APPROVED | scout ✅ → contact ✅ → nurture → briefing → onboard → remaining 12 |
| Skills curation access | PENDING BRENT | Admin-only or tenant UI? |
| Auto-drafted skill status | PENDING BRENT | draft (admin review) or auto-approved (tenant-scoped)? |

### The 10 Canaries
All admin-provisioned. All have empty `onboard_state.json`. First-message nudge is live.

**Critical: John (Thailand)** — $20M of $25M revenue. "Dumber than hell." Intelligence fix live, untested in real conversation. Once PR #15 merges, the canary dashboard will show bot status in real time.

---

## Open Issues — Ranked by Damage

### 🔴 P0 — PR #15 Merge Pending
GitGuardian blocker has been fixed. PR must merge to deploy: canary dashboard, FITFO, self-improvement engine, skills table, intelligence prompt overhaul.
**Status:** Fixed this session. CI re-run should pass.

### 🔴 P0 — All 10 Canaries Have No Personality Data
Empty `onboard_state.json`. First-message nudge fires for new conversations only.
**Fix:** `POST /admin/tenants/:id/reset-conversation` — clears Redis chat history. OR instruct canaries to message their bot "let's start over."

### 🔴 P0 — Intelligence Fix Untested in Production
Changes live (pending PR merge) but never observed in real canary conversation.
**Fix:** After PR merges — test each canary bot manually. Monitor Cloud Run logs ([AI] prefix).

### 🟠 P1 — 15 of 19 Tool Tests Still Skipped
tiger_scout ✅ and tiger_contact ✅ done. Remaining priority order:
tiger_nurture → tiger_briefing → tiger_onboard → remaining 12

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
