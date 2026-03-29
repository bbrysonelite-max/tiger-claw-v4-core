# State of the Tiger — Path Forward

**Last Updated:** 2026-03-29 (Sunday night session)
**Session Context:** 5 PRs merged (#94-#98), Phase 4 complete, Phase 5 pending

---

## Recovery Plan Status

### COMPLETED PHASES

**Phase 1 — Container Health**
- 1.1 secrets.ts EISDIR fix (PR #93) — DONE
- 1.2 FRONTEND_URL updated to wizard.tigerclaw.io — DONE
- Container stable, /health returns 200

**Phase 2 — Database Cleanup**
- All 9 global tables truncated to 0 rows — DONE
- 22 per-tenant schemas dropped — DONE
- Redis flushed — DONE

**Phase 3 — BYOK Key Path**
- 3.1 Key path trace (investigation) — DONE
- 3.2 Key observability + loud failures (PR #94) — DONE

**Phase 4 — Wizard Hatch Fixes**
- 4.1 activateSubscription fails loudly (PR #95) — DONE
- 4.2 Pre-flight validation on /hatch (PR #96) — DONE
- 4.3 userId fix in provisioning queue (PR #97) — DONE
- 4.4 Clear stale frontend state (PR #98) — DONE

---

### PENDING PHASES

**Phase 5 — Fire Test**

BLOCKER: Audit Stan Store purchase flow first. The original simple flow (purchase receipt email → wizard link) may have been broken by an agent that added Zapier.

Fire Test Steps (after audit clears):
1. Create $1 test product on Stan Store with wizard link in confirmation email
2. Buy with a different email
3. Click wizard link from confirmation email
4. Enter fresh Telegram bot token (from @BotFather /newbot)
5. Enter Gemini API key
6. Hit "Hatch"
7. Gate: Bot responds to a test message in Telegram

**Phase 6 — First Real Customer**
- Pick first customer from the waiting line
- Walk them through the same flow
- Monitor Cloud Run logs for errors

---

## Known Issues Still Open

| Issue | Severity | Notes |
|-------|----------|-------|
| Stan Store webhook | UNKNOWN | May have been broken by Zapier addition. Needs audit. |
| ~25 dead BotFather bots | LOW | Pebo needs to manually /deletebot them. |
| bot_ai_keys dead write | LOW | Wizard writes here but runtime never reads it. Cleanup later. |
| 81 stale feature branches | LOW | Clean up after fire test passes. |

---

## Infrastructure Quick Reference

- **GCP Project:** hybrid-matrix-472500-k5
- **Cloud Run Service:** tiger-claw-api (us-central1, asia-southeast1)
- **Cloud SQL:** PostgreSQL (password in Secret Manager as tiger-claw-database-url)
- **Redis:** Used for BullMQ job queues + key_state.json per-tenant state
- **Wizard:** Next.js on Vercel at wizard.tigerclaw.io
- **GitHub:** bbrysonelite-max/tiger-claw-v4-core
- **Deploys:** GitHub Actions auto-deploy on merge to main

---

## Agent Coordination Rules

- Cowork (Claude Opus in desktop) = orchestrator and merge handler
- Claude Code = primary code agent, runs prompts one at a time
- Gemini = secondary agent for frontend work
- One PR per fix. No chaining. No 12-PR overnight sprints.
- Verify after every merge. Stop if deploy breaks.
- Never push directly to main. Always feat/ branches + gh pr create.
