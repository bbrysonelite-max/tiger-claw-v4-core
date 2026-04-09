# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints, not suggestions. They apply to every line of code, every UI flow, every API endpoint, and every background job.**

---

## Current Session State (2026-04-08 — Session 17 — PRs #263–#267 merged)

### 462/462 tests passing. PRs #251–#267 merged. Cloud Run revision 00422-xc6 live. Wizard on Vercel (auto-deploy).

**Session 17 shipped (PRs #263–#267):**
- **PR #263 — Orchestrator dedup + strike queuing fix:** Research agent retry failures pushed `completed` past `expected`, re-triggering Reporting Agent 5x. Fixed with Redis SETNX one-shot guard. Also moved `markFactsQueued` before `draftReplies` so facts are always queued even on Gemini failure.
- **PR #264 — Strike harvest verbatim column fix (ROOT CAUSE):** `harvestFacts()` selected `verbatim` from `market_intelligence` — column does not exist. Every pipeline run crashed silently at first DB query. Removed from SELECT + interface + prompt. **First successful run confirmed: operator received 20-link Telegram alert.**
- **PR #265 — Rule 13 added to RULES.md:** After every merge, update RULES.md and SOTU.md.
- **PR #267 — Dashboard contrast fix:** Admin fleet dashboard + customer dashboard — all `text-zinc-400/500/600` labels on dark backgrounds bumped to readable `zinc-200/300/400`. Zero-state indicators preserved.

**Session 16 shipped (PRs #251–#261):**
- **PR #251 — bot-status fix:** `GET /wizard/bot-status` returned `pending` for admin-hatched bots. Added `'live'` to both isLive checks in `wizard.ts`.
- **PR #252 — duplicate tenant fix (critical):** Hatch was creating two tenant records. Slug generated twice. Fixed: generate slug once, pass as `precomputedSlug`.
- **PR #253 — dashboard isLive + Stan Store cleanup.**
- **PR #255 — ICP hard-wire:** Provisioner pre-seeds `onboard_state.json` at hatch. Bot wakes up calibrated — **no interview, no questions asked**.
- **PR #258 — WHAT_TIGER_CLAW_DOES.md:** New product vision doc.
- **PR #260 — `tiger_book_zoom`:** Cal.com booking tool built and registered. Deferred — needs platform booking architecture decision.
- **PR #261 — first impression + language matching + strike pipeline + wizard cleanup.**
- **Brents Tiger 01 (@Brentstiger01_bot) confirmed live and responding on Telegram.**

**Full assessment in `MODULE_ASSESSMENT.md`. Read it before writing any code.**

### FIRST PRIORITY NEXT SESSION

1. **Send bot link to warm contacts** — Operator action. `t.me/Brentstiger01_bot`. Document first real prospect conversation.
2. **Create Paddle product + price** — No checkout URL exists. No Paddle path without it.
3. **Prove full Paddle loop** — pay → provision → hatch → first message.
4. **Fix admin alert markdown bug** — Underscores in error messages break Telegram Markdown parser.

### Critical Open Issues

- **NO REAL PROSPECT CONVERSATIONS YET:** Brents Tiger 01 live. Operator is the only one who has messaged. Bot link not yet sent to warm contacts.
- **PADDLE PRODUCT:** Webhook live, no product/price yet. No checkout URL. Create before testing.
- **C4:** Payment gate still open for direct wizard access. Fix after Paddle loop proven.
- **Admin alert markdown bug:** Underscores in error messages break Telegram Markdown parser. Fix before launch.
- **Orphan tenant:** `brents-tiger-01-mnpcril3` (1ed77b8f) — duplicate from bug. No bot token. Terminate when convenient.
- **Test tenant cleanup:** Toon's 3 records, Tiger Test 102, FiretestApril5, Teddy Tiger Claw — defer to a cleanup session.
- **LINE:** Future only. Telegram is the only active channel.
- **Cal.com booking:** `tiger_book_zoom` built. Deferred pending platform booking architecture decision.

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

## Reference Files

- `SOTU.md` — **single source of truth. Read this first every session.**
- `START_HERE.md` — fast orientation
- `ARCHITECTURE.md` — canonical system design
- `STATE_OF_THE_TIGER_PATH_FORWARD.md` — roadmap and merged PR history
- `SOUL.md` — brand voice, mission, and personality directives
- `RULES.md` — engineering rules of engagement
