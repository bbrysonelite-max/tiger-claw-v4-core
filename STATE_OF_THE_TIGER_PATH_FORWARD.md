# State of the Tiger — Path Forward

**Last Updated:** 2026-03-30 (Monday morning — post all-nighter session 2)
**PRs merged this session:** #99–#105 (7 PRs)

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

**Phase 5 — Wizard Completion**
- Stan Store on-demand record creation (PR #99) ✅
- StepCustomerProfile ICP wizard step (PR #100) ✅
- Network-marketer prospect section (PR #101) ✅
- ICP first-message bypass in ai.ts (PR #102) ✅
- LINE end-to-end: UI + hatch + provisioner (PR #103) ✅
- LINE-only bot validation (PR #104) ✅
- Full wizard readability overhaul (PR #105) ✅

---

## Next: Fire Test (Phase 6)

**No blockers. Everything is merged and deployed.**

Steps:
1. Open `wizard.tigerclaw.io`
2. Complete all 5 wizard steps (Telegram token + Gemini key + ICP)
3. Hit "Hatch"
4. Send first Telegram message
5. **Pass:** Bot sends confident intro, not onboarding questions

After that: pick first real customer from the waiting list.

---

## Known Issues / Tech Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| **Admin bot token expired** | **HIGH** | `sendAdminAlert()` returns 401 — all provisioning alerts silently failing. Token `8451751033:AAEN...` is dead. Fix: BotFather → new token → update Cloud Run env var. |
| `bot_ai_keys` dead write | LOW | Wizard writes here, runtime never reads. Cleanup after fire test. |
| LINE-only bot untested end-to-end | MEDIUM | Provisioner supports it, wizard supports it. Never fire-tested. |
| `lineChannelSecret` not in WizardState on older sessionStorage | LOW | Fresh session will always have it; edge case for anyone mid-wizard during deploy |
| ~25 dead BotFather bots | LOW | Need manual /deletebot cleanup |
| Founding member 5-instance cap | INFO | Observation window ends ~2026-04-03 |

## DB State (as of 2026-03-30 morning)

Only 2 test tenants exist. No real customers yet. Fire test not completed.

| Tenant | Name | Status | Notes |
|--------|------|--------|-------|
| `71018251...` | heylookbrentisgolfing | onboarding | Telegram + OpenAI key |
| `8803b9f4...` | bbryson | pending | LINE creds saved, provisioner never ran |

---

## Stan Store Purchase Flow

```
Stan Store purchase
  → receipt email contains ?email= wizard link
  → wizard.tigerclaw.io?email=X
  → POST /auth/verify-purchase
      → if record exists: issue session token
      → if no record (webhook didn't fire): create on-demand, issue token
  → 5-step wizard
  → POST /wizard/hatch
  → BullMQ provisioner
  → Bot live
```

Zapier is still active but no longer a hard dependency.

---

## Infrastructure

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1) |
| Cloud SQL proxy | port 5433, user `botcraft`, DB `tiger_claw_shared` |
| DB password | `TigerClaw2026Secure` (Secret: `tiger-claw-database-url`) |
| Wizard | Next.js on Vercel at `wizard.tigerclaw.io` |
| GitHub | `bbrysonelite-max/tiger-claw-v4-core` |
| Deploys | GitHub Actions on merge to main |

---

## Agent Rules

- One PR per fix. No chaining.
- feat/ branches only. Never push direct to main.
- Verify Cloud Run logs after every deploy.
- `--no-verify` and `--force` banned without explicit instruction.
