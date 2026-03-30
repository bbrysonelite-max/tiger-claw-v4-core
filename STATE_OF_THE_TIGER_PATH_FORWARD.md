# State of the Tiger — Path Forward

**Last Updated:** 2026-03-30 (Monday)
**Session:** All-nighter — PRs #99–#103 written, #99–#101 merged

---

## Phase Status

### ✅ COMPLETE

**Phase 1 — Container Health**
- secrets.ts EISDIR fix (PR #93)
- FRONTEND_URL updated to `wizard.tigerclaw.io`
- Container stable, `/health` returns 200

**Phase 2 — Database Cleanup**
- All global tables truncated, 22+ per-tenant schemas dropped, Redis flushed
- Clean slate confirmed 2026-03-29

**Phase 3 — BYOK Key Path**
- Key path traced end-to-end (investigation)
- Key observability + loud failures (PR #94)
- Confirmed: `bot_ai_config` is the live read path; `bot_ai_keys` is a dead write (cleanup later)

**Phase 4 — Wizard Hatch Fixes**
- activateSubscription fails loudly (PR #95)
- Pre-flight validation on /hatch (PR #96)
- userId fix in provisioning queue (PR #97)
- Clear stale frontend state on success/failure (PR #98)

**Phase 5a — Wizard Completion**
- Stan Store webhook audit: Zapier IS active; on-demand record creation added as fallback (PR #99)
- StepCustomerProfile wizard step — 4 ICP fields collected at signup (PR #100)
- Network-marketer prospect section added to StepCustomerProfile (PR #101)
- Bot first-message ICP bypass — skips tiger_onboard() when wizard ICP exists (PR #102 — **OPEN**)
- LINE end-to-end: UI collects both LINE creds, hatch saves them, provisioner registers webhook (PR #103 — **OPEN**)

---

### 🔜 NEXT: Fire Test (Phase 5b)

**Gate: Merge #102 and #103 first.**

Fire test steps:
1. Complete wizard with fresh Telegram token + Gemini/OpenAI key + ICP filled in
2. Hit Hatch — watch Cloud Run logs for provisioning success
3. Send first message on Telegram
4. **Pass criteria:** Bot sends confident intro (not onboarding questions)
5. Optional: add LINE creds and confirm LINE webhook registered in LINE Developer Console

---

### 🔜 AFTER THAT: Phase 6 — First Real Customer

- Pick from the waiting list (7 past customers who paid but never got service)
- Walk them through wizard manually if needed
- Monitor closely

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| PR #102 not merged | **BLOCKER** | ICP first-message bypass — merge before fire test |
| PR #103 not merged | HIGH | LINE end-to-end — merge before fire test |
| `bot_ai_keys` dead write | LOW | Wizard writes here, runtime never reads. Cleanup after fire test. |
| Tenant `2ca971d3` missing | INVESTIGATED | Does not exist in DB. Was from pre-wipe session. Not a bug. |
| ~25 dead BotFather bots | LOW | Manual `/deletebot` cleanup, not urgent |
| LINE-only bot path untested | MEDIUM | Provisioner now supports it, but never fire-tested |

---

## LINE Message Flow (as audited 2026-03-30)

```
LINE message
  → POST /webhooks/line/:tenantId
  → checks: tenant exists + lineChannelSecret set (silent drop if not)
  → verifies HMAC-SHA256 signature
  → checks lineChannelAccessToken (silent drop if not)
  → enqueues to lineQueue (BullMQ)
  → lineWorker → processLINEMessage()
  → resolveAIProvider() (same 3-step as Telegram)
  → Gemini or OpenAI path
  → LINE Push API (not Reply — async)
```

**Silent drop conditions:** tenant missing, `lineChannelSecret` null, `lineChannelAccessToken` null, non-text event.

---

## Infrastructure Quick Reference

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1) |
| Cloud SQL proxy | port 5433, user `botcraft`, DB `tiger_claw_shared` |
| DB password | `TigerClaw2026Secure` (Secret Manager: `tiger-claw-database-url`) |
| Redis | BullMQ queues + per-tenant state (key_state.json, onboard_state.json) |
| Wizard | Next.js on Vercel at `wizard.tigerclaw.io` |
| GitHub | `bbrysonelite-max/tiger-claw-v4-core` |
| Deploys | GitHub Actions auto-deploy on merge to main |

---

## Agent Coordination Rules

- One PR per fix. No chaining. No overnight 12-PR sprints (we tried it, it's exhausting).
- Never push directly to main. Always `feat/` branches + `gh pr create`.
- Verify deploy after every merge. Stop if Cloud Run logs show errors.
- `main` is protected. `--no-verify` and `--force` are banned without explicit instruction.
