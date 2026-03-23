# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp Generated:** 2026-03-22T19:15:00-07:00
**Infrastructure Status:** LIVE (133/133 tests green, CI auto-merge active, 10 canary tenants provisioned, PRs #6/#7/#8 merged and deployed).

---

## 🛑 MANDATORY DIRECTIVE TO ALL AI AGENTS 🛑
This document is the absolute, most recent source of truth for the Tiger Claw repository (`/Users/brentbryson/Tigerclaw-Anti_Gravity/tiger-claw/`).

If you are reading this, you are working on the **Tiger Claw Multi-Tenant SaaS**.
1. **NO RAG.** The personal AI OS/Mini-RAG has been physically extracted to a separate workflow. You will not write, reference, or import RAG pipelines here.
2. **NO OPENCLAW.** We do not spin up per-tenant Docker containers.
3. **ARCHITECTURE:** Stateless Google Cloud Run API, Gemini 2.0 Flash (locked — 2.5 Flash has a GCP function-calling bug), 19 Native Function Calling Tools (`api/src/tools/`), Schema-per-tenant Postgres.
4. **NO REWRITES:** The 19 core tools compile flawlessly and are backed by 133 passing tests. Do not rewrite architecture.
5. **PROTOCOL:** Read this document fully before making any assumptions or taking any action.

## 🛑 GIT PROTOCOL — NON-NEGOTIABLE 🛑

- NEVER push directly to main. main is branch-protected.
- ALL work goes on a feature branch.
- Branch naming: feat/description, fix/description, chore/description
- When work is complete and tests pass: open a PR and IMMEDIATELY enable auto-merge.
- Brent does NOT review or merge PRs. CI green = ships. That is the policy.
- PR title must be clear and descriptive.
- PR body must include: what changed, why, and what tests cover it.

**Full autonomous deploy sequence (agents must follow this exactly):**
```bash
git checkout -b feat/your-description
# make changes, run tests
git push origin feat/your-description
gh pr create --title "feat: your description" --body "What changed and why"
gh pr merge --auto --squash   # fires immediately when CI passes — no human needed
```

**After any merge to main — deploy to Cloud Run:**
**Agent constraint:** NEVER checkout the main branch locally. All deployments are handled exclusively by GitHub Actions upon PR merge. The human operator must set GCP_CREDENTIALS in GitHub Secrets for this to work. Do not run ops/deploy-cloudrun.sh locally.

---

## Current State (2026-03-22 Evening)

### What Was Done This Session
- **PR #5:** Removed NM clichés from onboarding system prompt (merged)
- **PR #6:** Moved banned NM phrases to global voice rule — now applies in ALL modes, not just onboarding. Added exact variants: "mouth is closed your business is closed", "What's the move?", "manufacture some success", etc. (merged)
- **PR #7:** Fixed tiger_scout throwing "Onboarding not complete" for admin-provisioned tenants. Added explicit tool routing to system prompt so Gemini knows which tool to call for which user request. (merged)
- **PR #8:** Removed CODEOWNERS human review gate. CI green = auto-merge = ships. (merged)
- **Cloud Run deploy:** Manually triggered after session — building from latest main.

### The 10 Canaries
All 10 early adopters (NM distributor network, mostly Thailand) were provisioned with `comped:true` via `/admin/provision`. Their bots were broken due to the OpenClaw infrastructure failure before Tiger Claw V4.

**Critical canary: John (Thailand)** — Brent's top distributor, responsible for $20M of $25M total network revenue. John called this session to report his bot was "dumber than hell." He was told to check back in 30 minutes. Brent has a **Zoom call with John on Thursday 7 PM Scottsdale time.**

**The core problem with canary bots:**
1. Admin-provisioned tenants never completed the Telegram onboarding interview — `onboard_state.json` is empty. The bot has no ICP, no product, no identity data. It's a blank shell.
2. Bots were giving generic NM cliché responses (fixed in PR #6)
3. Bots were not calling tiger_scout when asked to find prospects (fixed in PR #7)
4. **The bot needs to handle ANY request intelligently** — not just the 19 predefined tool scenarios. This is the core intelligence gap that remains open.

**What canary users need to do:**
Each canary must message their Telegram bot and complete the onboarding interview. The bot will ask about their product, their biggest result, their ideal prospect. Without this, the bot has no context and will underperform.

### Open Issues (Not Yet Fixed)

1. **Agent Intelligence Gap** — The bots behave like a tool router, not a general agent. When a user asks something outside the 19 tools, the bot fails or gives a canned response. The bar is: handle anything a business person throws at it. This is the #1 priority.

2. **No Admin Dashboard** — There is no visual interface showing all tenants, their bot Telegram handles, onboarding completion status, and last activity. Brent cannot see who's who without a DB query. This is needed urgently — especially to manage the canary group before Thursday.

3. **Wizard Flow** — "Launch My Agent" on tigerclaw.io hits `/wizard/auth` which requires an existing Stan Store purchase. New users are blocked before they can try the 72-hour free trial. Deprioritized per Brent — address after canary situation is resolved.

4. **Auto-Deploy in CI** — GitHub Actions runs tests and automatically deploys to Cloud Run upon merge to main. Agents are strictly forbidden from checking out `main` to deploy manually.

5. **Facebook/LINE/WhatsApp** — All stubbed. Not functional.

### Immediate Priorities Before Thursday

1. **Admin dashboard** — One page showing all tenants: name, Telegram bot handle, onboarding status (complete/incomplete), last active timestamp. Must be visual, not a terminal query.

2. **Full click-through walkthrough** — Every screen, every command, every edge case on a real bot. This should have been done before canaries received their bots.

3. **Agent intelligence** — Bots must handle any business question, not just tool-mapped requests. The system prompt currently treats Gemini as a switch statement. It needs to behave as a capable general agent that also has 19 specialized tools.

---

## Architecture Reference

- **API:** Cloud Run, Node.js/Express, port 4000
- **DB:** Cloud SQL PostgreSQL HA, schema-per-tenant isolation
- **Cache/Queue:** Cloud Redis HA + BullMQ (5 queues)
- **AI:** Gemini 2.0 Flash via `@google/generative-ai` SDK
- **Frontend:** Next.js on Vercel (`wizard.tigerclaw.io`)
- **Payments:** Stan Store + Stripe
- **Email:** Resend
- **Bot Pool:** 42+ Telegram bot tokens, AES-256-GCM encrypted
- **GCP Project:** `hybrid-matrix-472500-k5`
- **Cloud Run Service:** `tiger-claw-api`, region `us-central1`

---
*Locked. Proceed.*
