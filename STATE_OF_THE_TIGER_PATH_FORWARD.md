# State of the Tiger — Path Forward

**Last Updated:** 2026-03-31
**Author:** Claude Sonnet 4.6

---

## Phase Status

### ✅ ALL PHASES COMPLETE — READY FOR FIRST REAL CUSTOMER

**Phase 1 — Container Health** ✅
**Phase 2 — Database Cleanup** ✅
**Phase 3 — BYOK Key Path** ✅
**Phase 4 — Wizard Hatch Fixes** ✅
**Phase 5 — Wizard Completion & Hardening** ✅
**Phase 6 — Intent Bridge (Data Moat → Bot Brain)** ✅

---

## Next: First Real Customer

The platform is fully restored, hardened, and the bot brain is now connected to the data moat.

Immediate Priorities:
1. **Triage open PRs** (#90, #78, #77, #75, #74, #46) — determine what's stale vs. ready.
2. **Fire test** with a real customer Telegram token + Gemini key.
3. **First customer** — pick from the waiting list and activate.

---

## Merged PRs — This Session (2026-03-31)

| PR | What It Did |
|----|-------------|
| **#107** | fix: LINE-only provisioning — `preferredChannel` defaulted to `"telegram"` even when only `lineToken` was present |
| **#109** | fix: Zapier bridge cleanup — removed unused `sendStanStoreWelcome` import, clarified comment |
| **#110** | fix: wizard UX friction pass — contrast, copy, multi-agent support |
| **#111** | fix: 3 critical fire test bugs — name update, ICP fast-path, email placeholder |
| **#112** | feat: intent bridge — `getMarketIntelligence()` + `formatMarketIntelligence()` wired into `buildSystemPrompt()`. 10,833 facts in prod. Domain key = flavor displayName. |

## Merged PRs — Previous Session (2026-03-30)

- **PR #106:** fix: LINE-only provisioning (provisioner side)
- **PR #108:** fix: sanitize Gemini JSON escape sequences
- **PR #99–#105:** Wizard completion — Stan Store on-demand, ICP steps, LINE e2e, readability

---

## Known Issues / Tech Debt

| Item | Status | Notes |
|-------|----------|-------|
| `bot_ai_keys` dead write | LOW | Wizard writes here, runtime never reads. Cleanup planned. |
| ~25 dead BotFather bots | LOW | Need manual /deletebot cleanup |
| CI `API Tests` failure | INFRA BUG | Postgres `role "root"` error in GitHub Actions — pre-existing, not code. `build_and_test` (TypeScript compile) is the reliable gate. |
| Open PRs #46, #74, #75, #77, #78, #90 | NEEDS TRIAGE | From prior Gemini sessions — may be stale or superseded |

---

## Infrastructure

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1) |
| Cloud SQL proxy | port 5432, user `botcraft`, DB `tiger_claw_shared` |
| DB password | `TigerClaw2026Secure` (Secret: `tiger-claw-database-url`) |
| Wizard | Next.js on Vercel at `wizard.tigerclaw.io` |
| GitHub | `bbrysonelite-max/tiger-claw-v4-core` |
| Deploys | Auto via GHA on merge to main |
| Market Intelligence | 10,833 facts in `market_intelligence` table as of 2026-03-31 |

---

## Agent Rules

- One PR per fix. No chaining.
- feat/ branches only. Never push direct to main.
- Architecture is **LOCKED**. No RAG, no containers.
- Always test SQL against prod DB before merging — CI Postgres is broken.
