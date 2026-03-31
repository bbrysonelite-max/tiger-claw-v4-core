# State of the Tiger — Path Forward

**Last Updated:** 2026-03-31 (Session 2)
**Author:** Claude Sonnet 4.6

---

## Phase Status

### ✅ ALL PHASES COMPLETE — FIRST BOT CONFIRMED LIVE

**Phase 1 — Container Health** ✅
**Phase 2 — Database Cleanup** ✅
**Phase 3 — BYOK Key Path** ✅
**Phase 4 — Wizard Hatch Fixes** ✅
**Phase 5 — Wizard Completion & Hardening** ✅
**Phase 6 — Intent Bridge (Data Moat → Bot Brain)** ✅
**Phase 7 — ICP Fast-Path & Display Hardening** ✅ ← NEW THIS SESSION

---

## Confirmed Working (2026-03-31)

Captain Tiger Two (`bbryson-mne8ffim`) is live on Telegram with a Grok xAI key. Bot responded correctly at 1:35 AM. No onboarding questions. Story told. Personality intact.

---

## Next: First Real Customer

Immediate priorities:
1. **Pick a customer** from the waiting list and activate.
2. **Triage open PRs** (#90, #78, #77, #75, #74, #46) — determine stale vs. ready.
3. **Key health monitor false positive** — cron passes provider `openai` to `validateAIKey` for Grok bots, hits wrong endpoint, marks key dead. Fix: pass original provider through alongside the resolved SDK alias.

---

## Merged PRs — Session 2 (2026-03-31)

| PR | What It Did |
|----|-------------|
| direct commit | fix: bot greeting CTA — removed "Send me a name", now "I'm ready — let me hunt" |
| **#113** | fix: dashboard display — AI engine label (`Grok Gemini` → `Grok 2`), Telegram card contradiction (ACTIVE + "Pending") |
| **#114** | fix: wizard ICP fast-path — hatch now writes `icpSingle` + `botName`; fast-path also writes on first message |
| **#115** | fix: `buildSystemPrompt` fallback to `customerProfile` when `icpSingle` missing — repairs all existing broken bots without migration |
| **#116** | fix: Grok model `grok-2-1212` → `grok-4-1-fast-non-reasoning` (xAI dropped the old model, returned 400 Model not found) |

## Merged PRs — Session 1 (2026-03-31)

| PR | What It Did |
|----|-------------|
| **#107** | fix: LINE-only provisioning — `preferredChannel` defaulted to `"telegram"` |
| **#109** | fix: Zapier bridge cleanup |
| **#110** | fix: wizard UX friction pass |
| **#111** | fix: 3 critical fire test bugs |
| **#112** | feat: intent bridge — market intelligence → `buildSystemPrompt()` |

## Merged PRs — Previous Session (2026-03-30)

- **PR #106:** fix: LINE-only provisioning (provisioner side)
- **PR #108:** fix: sanitize Gemini JSON escape sequences
- **PR #99–#105:** Wizard completion — Stan Store on-demand, ICP steps, LINE e2e, readability

---

## Known Issues / Tech Debt

| Item | Priority | Notes |
|------|----------|-------|
| Key health monitor false positive for Grok | MEDIUM | Cron passes SDK alias `openai` to `validateAIKey` → hits `api.openai.com` with xAI key → 401 → `key_health=dead`. Does not block delivery. Fix: pass original provider through `resolveAIProvider`. |
| `bot_ai_keys` dead write | LOW | Wizard writes here, runtime never reads. Cleanup when convenient. |
| ~25 dead BotFather bots | LOW | Need manual /deletebot cleanup |
| CI `API Tests` failure | INFRA BUG | Postgres `role "root"` in GitHub Actions — pre-existing, not our code. `build_and_test` (TypeScript compile) is the reliable gate. |
| Open PRs #46, #74, #75, #77, #78, #90 | TRIAGE | From prior Gemini sessions — review for staleness |

---

## Infrastructure

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1), latest `tiger-claw-api-00186-jq7` |
| Cloud SQL instance | `tiger-claw-postgres-ha` (NOT `tiger-claw-db`) |
| Cloud SQL proxy | port **5433** locally |
| DB | user `botcraft`, DB `tiger_claw_shared` |
| Bot state | PostgreSQL per-tenant schema `t_{tenantId}.bot_states` (NOT Redis) |
| Wizard | Next.js on Vercel, `wizard.tigerclaw.io` |
| Deploys | Auto via GHA on merge to main |
| Market Intelligence | 10,833+ facts in `market_intelligence` table |

---

## Agent Rules

- One PR per fix. No chaining.
- `feat/` branches only. Never push direct to main unless explicitly told to.
- Architecture is **LOCKED**. No RAG, no containers, no OpenClaw.
- Always test SQL against prod DB via Cloud SQL proxy — CI Postgres is broken.
- `buildSystemPrompt()` is async. Always `await` it.
- Grok keys: provider stored as `grok` in DB, resolved to `openai` + `baseURL: https://api.x.ai/v1` by `resolveAIProvider`. Never confuse the two layers.
