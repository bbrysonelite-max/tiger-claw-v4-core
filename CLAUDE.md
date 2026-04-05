# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints, not suggestions. They apply to every line of code, every UI flow, every API endpoint, and every background job.**

---

## Current Session State (2026-04-05 — Session 13 COMPLETE)

### Platform green. 447/447 tests passing. Revision 00345-525 live. PRs #221–#222 merged to main — NOT YET DEPLOYED.

**Session 13 shipped 4 changes across two repos:**
- PR #220 (docs): MODULE_ASSESSMENT + SOTU updated — C1/C2/H1/H3/M1/M3 marked resolved, stale open items removed
- PR #221 (fix/C3): Hatch email now sends in Tiger's voice with agent name + flavor. Fires even when botUsername is null. Dead admin-only `triggerProactiveInitiation` block removed from provisioner.
- PR #222 (fix/M2): `makeSerperFetcher()` factory in market_miner — per-invocation call counter eliminates cross-run interference. `getSerperKey()` round-robin rotator in tiger_scout — all 3 Serper keys used, not just KEY_1.
- Website PR #1 (tiger-bot-website): Refund policy section added to tigerclaw.io for Paddle compliance.

**⚠️ Deploy needed:** PRs #221–#222 are on main but Cloud Run still runs 00345-525. Run deploy before next customer onboards.

**Full assessment in `MODULE_ASSESSMENT.md`. Read it before writing any code.**

### ⚠️ FIRST PRIORITY NEXT SESSION: Agent Behavior Review
- Agent behavior was flagged as a "broken window" — conversational quality, SOUL injection, and `runToolLoop()` behavior need a ground-truth review before any customer goes through the wizard.
- Do not skip. Do not onboard John, Jeff, or Debbie until this is reviewed and confirmed working.

### Critical Open Issues (do not launch publicly until C4 is resolved)
- **C4:** Payment gate is open — any email gets a free bot. Paddle application submitted 2026-04-05. Domains approved. Business name had typos — cannot find how to correct in portal. Everything else approved; token likely available but deferred. Awaiting final approval.
- **H2:** Reddit 403 on every scout run — Oxylabs account needed.
- Read `MODULE_ASSESSMENT.md` for the complete prioritized fix list.

### Active Business Context
- **Max Steingart:** White label / affiliate deal (30% affiliate via Stan Store). Holding at referral model — must sell 10 first. Do not build partner infrastructure until he proves he can sell.
- **John / Bryson International Group:** 21,000 LINE distributors in Thailand. `vijohn@hotmail.com` — wiped from DB, needs fresh wizard.
- **Jeff Mack:** `jeffmackte@gmail.com` — wiped from DB, needs fresh wizard.
- **Debbie:** `justagreatdirector@outlook.com` — pending, needs wizard.

---

## Product Philosophy: Integrity First

> "Every system we build must adhere to a strict ethical code: Value must exceed Cost. Do not write code that traps users, obfuscates pricing, or adds unnecessary complexity. Prioritize the user's time and success as a moral obligation. If a feature does not provide immediate, tangible value, it is friction and must be eliminated."

---

## 1. Integrity First — User Agency Is Sacred

### Easy Exit Mandate
- Every subscription and onboarding flow **must** expose a clearly visible, one-click cancellation or data-export path.
- **Never** add hidden flags, cooldown timers, confirmation mazes, or multi-step friction to prevent a user from cancelling or exporting their data.

### No Dark Patterns
- **Never** pre-check add-on boxes, upsell toggles, or marketing consent.
- **Never** use ambiguous button labels.
- **Never** hide pricing, usage caps, or trial expiry.

---

## 2. Radical Value Delivery — Keeping Money Without Value Is a Moral Failure

### Value-Gap Detection
- Any tenant who is paying and has **not generated a lead in 3 consecutive days** must be flagged.
- The flag triggers a "Value Check-in" message to the operator — a genuine diagnostic, not a retention campaign.

### Proactive Error Correction
- If the system detects a backend processing error affecting a paying user: (1) log it, (2) attempt self-correction, (3) notify the user with a plain-language apology and status update.
- **Never** swallow errors silently when the error affects a paying user's output.

---

## 3. Complexity Is a Moral Tax — Protect the User's Time

- Background infrastructure must be **completely invisible** to the operator.
- The user sees one thing: their bot working.

---

## 4. Multi-Agent Architecture

- **One email can have multiple bots.** The old one-bot-per-email lock is dead.
- `auth.ts` creates a NEW bot when an existing bot's subscription is not `pending_setup`.
- Each Stan Store purchase creates a fresh bot_id, fresh subscription, fresh tenant.
- This is critical: John's 21,000 distributors will want several each.

---

## Engineering Constraints (Non-Negotiable)

- **NO AI AGENT TOUCHES MAIN. EVER.** All changes go through a `feat/` or `fix/` branch, then `gh pr create`.
- After every PR: verify with `gh pr view <number>` that state is `MERGED`.
- After every deploy: verify `curl https://api.tigerclaw.io/health` returns 200.
- Never push directly to `main`. Never use `--no-verify` or `--force` on main.
- OpenClaw, Mini-RAG, and per-tenant Docker containers are permanently gone.
- The Mac cluster at 192.168.0.2 is offline only. Cloud Run never calls it.
- `buildSystemPrompt()` is async. Always `await` it.
- All DB calls in hot paths must be wrapped in `try/catch` with graceful degradation.
- Cloud SQL proxy runs on port **5433** locally (NOT 5432).
- Market intelligence domain key = flavor **displayName** (e.g. `"Real Estate Agent"`), NOT the flavor key.
- `node-fetch` is NOT in `package.json`. Use native `fetch` (Node 18+).
- New tools in `api/src/tools/` MUST be registered in `toolsMap` in `ai.ts`. Missing = infinite tool loop.
- **`tiger_gmail_send` and `tiger_postiz` are intentionally NOT in toolsMap.** Do not re-add them. Gemini must not send personal Gmail or post to social media without explicit human approval.
- **Gemini 2.0 Flash only.** Do not switch to 2.5-flash (GCP function-calling bug).
- 447 tests must pass before any PR is opened. Run `npm test` from `api/`.

---

## Reference Files

- `SOTU.md` — **single source of truth. Read this first every session.**
- `START_HERE.md` — fast orientation
- `ARCHITECTURE.md` — canonical system design
- `STATE_OF_THE_TIGER_PATH_FORWARD.md` — roadmap and merged PR history
- `SOUL.md` — brand voice, mission, and personality directives
- `RULES.md` — engineering rules of engagement
