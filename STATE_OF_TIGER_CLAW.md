# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp Generated:** 2026-03-24T01:15:00-07:00
**Infrastructure Status:** LIVE (379 tests green, CI auto-merge active, 10 canary tenants provisioned)
**Last Session:** GitGuardian full clean — 18 tracked files scrubbed, secrets replaced with env vars. Commit: 67f82b9

---

## 🛑 MANDATORY DIRECTIVE TO ALL AI AGENTS 🛑
This document is the absolute, most recent source of truth for this repository.

1. **NO RAG.** No Mini-RAG pipelines here.
2. **NO OPENCLAW.** No per-tenant Docker containers.
3. **ARCHITECTURE:** Stateless Cloud Run API, Gemini 2.0 Flash (LOCKED — 2.5 Flash silently strips JSON params), 19 Native Function Calling Tools, Schema-per-tenant Postgres.
4. **NO REWRITES:** 19 core tools compile and are backed by 379 passing tests. Do not rewrite architecture.
5. **FITFO.md:** Agent operating protocol at `/tiger-claw/FITFO.md`. All agents must internalize it.

## 🛑 GIT PROTOCOL — NON-NEGOTIABLE 🛑

- NEVER push to main. Branch-protected.
- ALL work: feature branch → PR → CI green → auto-merge → auto-deploy.
- Brent does NOT review PRs. CI green = ships.
```bash
git checkout -b feat/your-description
cd api && npx vitest run   # must run from api/ directory, must pass before PR
git push origin feat/your-description
gh pr create --title "feat: description" --body "What changed and why"
gh pr merge --auto --squash
```
- NEVER checkout main locally. GitHub Actions deploys on merge.
- NEVER run `npx vitest run` from repo root — it picks up web-onboarding tests and produces wrong counts. Always `cd api && npx vitest run`.

---

## Current State (2026-03-24 ~01:15 PST)

### What Was Done This Session

**Branch: feat/skills-admin-email-hardening (PR #16)**
**Final commit: 67f82b9**

#### 1. Skills Admin Routes (earlier this session)
- `GET /admin/skills` — list all skills with filter by status/scope
- `POST /admin/skills/:id/approve` — approve a draft skill
- `POST /admin/skills/:id/reject` — reject with reason
- `POST /admin/skills/:id/promote` — elevate tenant→flavor→platform scope
- `DELETE /admin/skills/:id` — hard delete
- logAdminEvent on every transition
- 11 new tests in admin.test.ts (27 total in file)

#### 2. Migration 014: Duplicate Draft Skills Fix
- `ON CONFLICT DO NOTHING` in draftSkillFromFailure() had no matching unique index for status='draft'
- Migration 014 adds: `CREATE UNIQUE INDEX skills_tenant_name_draft_idx ON skills (tenant_id, name) WHERE status = 'draft'`

#### 3. Email Trial Reminders
- `sendTrialReminderEmail(email, hoursRemaining)` implemented in email.ts
- Trial BullMQ jobs (24h/48h/72h) now fire both Telegram message AND email
- Mock-safe: no-ops when `RESEND_API_KEY` is not set

#### 4. Hardcoded URL Fixes
- `app.tigerclaw.io` → `process.env['FRONTEND_URL'] ?? 'https://wizard.tigerclaw.io'` throughout ai.ts
- All trial reminder prompts, paused-bot messages now use env var

#### 5. suspendTenant / resumeTenant Fixed
- suspendTenant now writes `tenantPaused: true` to `key_state.json` — LINE channel stops consuming API keys
- resumeTenant now deletes `tenantPaused` from `key_state.json` — LINE resumes
- Previously, suspending a tenant only killed the Telegram webhook; LINE was still live and burning keys

#### 6. Canary Reset Route
- `POST /admin/fleet/:id/reset-conversation` — clears all Redis `chat_history:{tenantId}:*` keys
- Uses `clearTenantChatHistory()` exported from ai.ts
- 3 new tests in admin.test.ts

#### 7. GitGuardian Full Clean (67f82b9) — THIS SESSION'S FINAL COMMIT
All tracked ops/test files with hardcoded secrets scrubbed. Zero secrets remain in any git-tracked file.

**Files fixed:**
- `api/test_gemini.js`, `api/test_gemini2.js`, `api/test_gemini3.js`, `api/test_gemini_full.ts` — `AIzaSyAq3KzzX1aE3wtjy39j6yDQ2e3dWcb-af0` → `process.env.GOOGLE_API_KEY`
- `api/test_all_tools.ts`, `api/test_ai_full.js`, `api/test_19.js` — same Google key → env var
- `api/drop_keys.js`, `api/clear_tenant_keys.js` — `TigerClaw2026MasterKey` DB string → `process.env.DATABASE_URL`
- `api/get_cols.js`, `api/set_webhook.ts`, `api/check_bot.js`, `api/query_db.js` — same DB string → env var
- `api/check_agents.js`, `api/clean_db.js`, `api/insert_raw.js`, `api/create_sandbox.js`, `api/check_webhook.js` — same DB string → env var

**Secrets remaining in repo:** NONE (`.env` is gitignored; `specs/legacy/BLUEPRINT_v4.md` has `sk_live_...` placeholder only — not a real key)

### Test Count
**379 passing, 0 TypeScript errors, 33 test files, 0 skipped.**
(Up from 254 → 365 → 376 → 379 across sessions)

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
| Tool test priority | COMPLETE | All 19 tool tests passing ✅ — 379/379 tests, 0 skipped |
| Skills curation access | PENDING BRENT | Admin-only or tenant UI? |
| Auto-drafted skill status | PENDING BRENT | draft (admin review) or auto-approved (tenant-scoped)? |

### The 10 Canaries
All admin-provisioned. All have empty `onboard_state.json`. First-message nudge is live (fires on first inbound message to a bot with empty state). Reset route available: `POST /admin/fleet/:id/reset-conversation`.

---

## Open Issues — Ranked by Damage

### ✅ RESOLVED — GitGuardian Fully Clean
18 tracked files scrubbed. Zero secrets in git-tracked files. PR #16 at commit 67f82b9.

### 🔴 P0 — All 10 Canaries Have No Personality Data
Empty `onboard_state.json`. First-message nudge fires but there's nothing to build on.
**Fix:** `POST /admin/fleet/:id/reset-conversation` then tell each canary to message their bot.

### 🔴 P0 — Intelligence Fix Untested in Production
TOOL JUDGMENT + FITFO pending PR merge. Never observed in real canary conversation.
**Fix:** After PR merges — test each canary bot manually. Monitor Cloud Run logs ([AI] prefix).

### ✅ RESOLVED — Email Is No Longer a Stub
sendTrialReminderEmail, sendProvisioningReceipt, sendKeyAbuseWarning, sendStanStoreWelcome — all live.

### ✅ RESOLVED — suspendTenant LEFT LINE ACTIVE
Fixed. Both suspend and resume now write to key_state.json.

### ✅ RESOLVED — Skills Curation Has No Admin Routes
Done. GET/approve/reject/promote/DELETE. 11 tests.

### 🟠 P1 — Single AI Provider
Hard-locked to Gemini 2.0 Flash. Item 3 of 6-item plan. Not started.

### 🟠 P1 — Hive Benchmarks Not in System Prompt
Hive data not in agent context. Item 4 of 6-item plan. Not started.

### 🟠 P1 — LINE/Facebook Scouting Incomplete
Facebook: silently returns empty if SERPER_KEY_* missing. LINE: reads local file, not real LINE API.

### 🟡 P2 — OpenAI Tool Declaration Mapper
19 tools in Gemini format. Needed before multi-provider BYOK goes live.

### 🟡 P2 — analyzePatterns() Defined But Never Called
In self-improvement.ts. Wire into admin fleet or weekly events.

### 🟡 P2 — SMOKE_TEST_GOOGLE_KEY Not Set in GitHub Actions
web-onboarding/e2e/production-smoke.spec.ts skips if env var absent. Add to repo secrets for CI to exercise it.

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
- **Email:** Resend — fully implemented (4 functions in email.ts)
- **Bot Pool:** 42+ Telegram tokens, AES-256-GCM encrypted
- **GCP Project:** hybrid-matrix-472500-k5, region us-central1
- **Key Layers:** L1 platform onboarding (72h), L2 tenant primary BYOK, L3 tenant fallback BYOK, L4 platform emergency

## Punch List
Full weakness detail + plans: /Users/brentbryson/Desktop/TIGERCLAW_PUNCH_LIST.md

---
*Locked. Proceed.*
