# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints, not suggestions. They apply to every line of code, every UI flow, every API endpoint, and every background job.**

---

## Current Session State (2026-04-09 — Session 17 CLOSED — PRs #263–#272 merged)

### 462/462 tests passing. PRs #251–#272 merged. Cloud Run revision 00434-c6h live. Wizard on Vercel (auto-deploy).

**Session 17 shipped (PRs #263–#272):**
- **PR #263 — Orchestrator dedup + strike queuing fix:** Research agent retry failures pushed `completed` past `expected`, re-triggering Reporting Agent 5x. Fixed with Redis SETNX one-shot guard. Also moved `markFactsQueued` before `draftReplies` so facts are always queued even on Gemini failure.
- **PR #264 — Strike harvest verbatim column fix (ROOT CAUSE):** `harvestFacts()` selected `verbatim` from `market_intelligence` — column does not exist. Every pipeline run crashed silently. Removed from SELECT + interface + prompt. **First successful run: 20-link alert received.**
- **PR #265 — Rule 13 added to RULES.md:** After every merge, update RULES.md and SOTU.md.
- **PR #267 — Dashboard contrast fix:** Admin + customer dashboard — all `text-zinc-400/500/600` labels bumped to readable `zinc-200/300/400`. Zero-state indicators preserved.
- **PR #268 — Session 17 docs update (partial):** START_HERE, ARCHITECTURE, STATE_OF_THE_TIGER_PATH_FORWARD updated.
- **PR #269 — Provisioner botName top-level fix (CRITICAL):** `botName` was written inside `identity{}` only. Code reads `state.botName` at top level. Gemini saw "Bot name: —" and entered confused self-onboarding loop, asking prospects "What is your name?" Fixed: `botName` + `completedAt` now written at top level on every hatch. Direct DB fix applied to live bot. Polluted fact_anchors cleaned.
- **PR #270 — Prospect engagement mode:** System prompt had no prospect context — bot was 100% operator-management frame. Added: WHO YOU ARE TALKING TO block, dream injection directive, covenant opening, explicit voice examples, HARD RULE: never surface internal system state.
- **PR #271 — Bot description + /start message:** Description was "AI-powered network-marketer agent for Brents Tiger 01. Managed by Tiger Claw." Replaced with covenant line. Live bot updated immediately via Telegram Bot API. /start ending fixed: "Let's get to work! I'm having my nails done later!" → "What's going on for you right now?"
- **PR #272 — No tool names in responses:** Previous rule missed shorthand variants (tigerlead, tigernurture, tigerstrikedraft, etc.). Explicitly listed all variants. Added: never explain reasoning out loud mid-message.

**Session 16 shipped (PRs #251–#261):**
- **PR #255 — ICP hard-wire:** Provisioner pre-seeds `onboard_state.json` at hatch. Bot wakes calibrated — **no interview, no questions asked.**
- **PR #261 — 4-language /start + language matching + Strike pipeline wired.**
- (Other PRs: #251 bot-status, #252 duplicate tenant, #253 dashboard isLive, #258 WHAT_TIGER_CLAW_DOES, #260 tiger_book_zoom)

**Full assessment in `MODULE_ASSESSMENT.md`. Read it before writing any code.**

### FIRST PRIORITY NEXT SESSION

1. **CHECK PROSPECT CONVERSATIONS** — Two people were messaging @Brentstiger01_bot at session close (11:40 PM PT). Check what they actually received. Screenshot needed.
2. **Validate prospect engagement mode** — was the conversation warm and human or still broken?
3. **Create Paddle product + price** — No checkout URL exists. No Paddle path without it.
4. **Fix admin alert markdown bug** — Underscores in error messages break Telegram Markdown parser.

### Critical Open Issues

- **PROSPECT MODE UNVALIDATED:** Deployed but no confirmed successful prospect conversation. Two people messaged at close — check first.
- **PADDLE PRODUCT:** Webhook live, no product/price yet. No checkout URL. Create before testing.
- **C4:** Payment gate still open for direct wizard access. Fix after Paddle loop proven.
- **Admin alert markdown bug:** Underscores in error messages break Telegram Markdown parser.
- **Orphan + Tiger Test 102:** Both suspended. Terminate when convenient.
- **Fleet debris:** FiretestApril5, Teddy Tiger Claw, Tigertest100, etc. — cleanup when convenient.
- **LINE:** Future only. Telegram is the only active channel.
- **Cal.com booking:** `tiger_book_zoom` built. Deferred pending platform booking architecture decision.

### Key Lesson from Session 17 — Mandatory for Next Agent
The bot had no prospect mode at all. When real people messaged they got status reports, tool names, and internal platform language. This was broken from day one. **Always test from a FRESH chatId to see what a prospect sees.** Read Cloud Run logs before diagnosing — root cause was visible immediately every time.

### Active Business Context

- Operator is building this for their own distribution network. Do not treat any individual names as launch gates. The platform must stand on its own merit.
- Founding members: comped provisioning via admin hatch. Payment gate fix comes after first live prospect conversation is confirmed.
- Window to prove agent intelligence is short. Do not waste it on interviews, forms, or friction.

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
- Each purchase creates a fresh bot_id, fresh subscription, fresh tenant.

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
- **`tiger_gmail_send` and `tiger_postiz` are intentionally NOT in toolsMap.** Do not re-add them.
- **Gemini 2.0 Flash only.** Do not switch to 2.5-flash (GCP function-calling bug).
- **462 tests must pass** before any PR is opened. Run `npm test` from `api/`.

---

## ⚠️ THERE IS NO BOT POOL. THIS IS NON-NEGOTIABLE. ⚠️

**ALL Telegram bot tokens are BYOB — Bring Your Own Bot.**
- Every operator gets their token directly from BotFather.
- The platform does NOT maintain, store, or provision a pool of pre-registered bot tokens.
- There is no `bot_pool` table in active use. There are no pool management endpoints.
- `api/src/services/pool.ts` contains ONLY AES-256-GCM crypto helpers and Telegram API utilities. It is NOT a pool manager.
- If you see any code attempting to pull a token from a pool, assign a bot from a pool, or replenish a pool — **DELETE IT. Do not "fix" it. Delete it.**
- Admin tokens are operator-held. If an admin token fails, the operator replaces it. There is no auto-rotation.
- This decision is permanent. Do not re-introduce pool logic under any name or abstraction.

---

## Reference Files

- `SOTU.md` — **single source of truth. Read this first every session.**
- `START_HERE.md` — fast orientation
- `ARCHITECTURE.md` — canonical system design
- `STATE_OF_THE_TIGER_PATH_FORWARD.md` — roadmap and merged PR history
- `SOUL.md` — brand voice, mission, and personality directives
- `RULES.md` — engineering rules of engagement
