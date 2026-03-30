# State of the Tiger — Path Forward

**Last Updated:** 2026-03-30 (Monday afternoon — RESTORATION COMPLETE)
**Author:** Gemini CLI

---

## Phase Status

### ✅ ALL PHASES COMPLETE — READY TO FIRE TEST

**Phase 1 — Container Health**
- secrets.ts EISDIR fix (PR #93) ✅
- FRONTEND_URL → wizard.tigerclaw.io ✅
- Container stable on Cloud Run ✅

**Phase 2 — Database Cleanup**
- All test data wiped, clean slate ✅

**Phase 3 — BYOK Key Path**
- Key observability + loud failures (PR #94) ✅
- Runtime reads from `bot_ai_config` (confirmed) ✅

**Phase 4 — Wizard Hatch Fixes**
- activateSubscription loud failure (PR #95) ✅
- Pre-flight validation on /hatch (PR #96) ✅
- userId fix in provisioning queue (PR #97) ✅
- Clear stale frontend state (PR #98) ✅

**Phase 5 — Wizard Completion & Hardening**
- Stan Store on-demand record creation (PR #99) ✅
- StepCustomerProfile ICP wizard step (PR #100) ✅
- Network-marketer prospect section (PR #101) ✅
- ICP first-message bypass in ai.ts (PR #102) ✅
- LINE end-to-end: UI + hatch + provisioner (PR #103) ✅
- LINE-only bot validation (PR #104) ✅
- Full wizard readability overhaul (PR #105) ✅
- JSON escape sequence sanitization (PR #108) ✅
- Admin bot restoration + heartbeat monitor (PR #109) ✅

---

## Next: Fire Test (Phase 6)

**The platform is fully restored and hardened.** 

Immediate Priorities:
1. **First Real Customer:** Pick the first customer from the waiting list.
2. **Stan Store Webhook:** Merge the Zapier bridge PR to automate the "Receipt → Wizard" flow.
3. **Fire Test:** Verify end-to-end "Hatch → Telegram Confident Intro".

---

## Known Issues / Tech Debt

| Item | Status | Notes |
|-------|----------|-------|
| **Admin Bot** | **FIXED** | Nervous system restored via `@AlienProbeadmin_bot`. |
| **JSON Parse** | **FIXED** | Sanitizer added to `tiger_refine.ts` and `ai.ts`. |
| `bot_ai_keys` dead write | LOW | Wizard writes here, runtime never reads. Cleanup planned. |
| ~25 dead BotFather bots | LOW | Need manual /deletebot cleanup |

## DB State (as of 2026-03-30)

| Tenant | Name | Status | Notes |
|--------|------|--------|-------|
| `71018251...` | heylookbrentisgolfing | onboarding | Telegram + OpenAI key |
| `8803b9f4...` | bbryson | pending | LINE creds saved |

---

## Merged PRs (Restoration Session)

- **PR #106:** fix: LINE-only provisioning
- **PR #107:** feat: preferredChannel type fix
- **PR #108:** fix: sanitize Gemini JSON escape sequences
- **PR #109:** feat: restore admin bot + heartbeat monitor

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
| Deploys | Manual script + GHA |

---

## Agent Rules

- One PR per fix. No chaining.
- feat/ branches only. Never push direct to main.
- Architecture is **LOCKED**. No RAG, no containers.
