# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints, not suggestions. They apply to every line of code, every UI flow, every API endpoint, and every background job.**

**Current state lives in `SOTU.md`. Read it first every session. This file is timeless rules only — no session state, no priorities, no "what's broken right now."**

---

## Session Lifecycle — Non-Negotiable

**Every session starts with this exact sequence. No exceptions.**

1. Read `SOTU.md` — the single source of truth for current state.
2. Read `NEXT_SESSION.md` — the ordered action list for this session.
3. Run `DAILY_CHECKS.md` — the operational ritual. If any check fails, stop and fix before any other work.

No code, no investigation, no "just quickly checking something" before these three reads complete.

**Every session ends with this exact sequence. No exceptions.**

1. Update `SOTU.md` with what actually shipped this session — not what was planned.
2. Delete closed items from `NEXT_SESSION.md`. Do not mark ✅. Do not leave `ALREADY IN PLACE` annotations. Remove.
3. Verify every merged PR with `gh pr view <number>` showing `MERGED`.
4. Verify deploy with `curl https://api.tigerclaw.io/health` returning 200.
5. The session is not closed until `SOTU.md` and `NEXT_SESSION.md` are in sync with each other and with git.

**All Tiger Claw state lives exclusively in this repo.** Do not mirror `SOTU.md`, `NEXT_SESSION.md`, `CLAUDE.md`, or `DAILY_CHECKS.md` to any vault, notes system, document, or external surface. If you are tempted to write Tiger Claw information anywhere other than `~/tiger-claw-v4-core/`, stop and write it here instead.

---

## Product Philosophy: Integrity First

> "Every system we build must adhere to a strict ethical code: Value must exceed Cost. Do not write code that traps users, obfuscates pricing, or adds unnecessary complexity. Prioritize the user's time and success as a moral obligation. If a feature does not provide immediate, tangible value, it is friction and must be eliminated."

Operator is building this platform for their own distribution network. Platform must stand on its own merit.

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
- **Test every bot from a FRESH chatId** to see what a prospect actually sees. Never from the operator account.
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
- **452 tests must pass** before any PR is opened. Run `npm test` from `api/`.

---

## Telegram Bot Tokens

Every Telegram bot token in Tiger Claw is registered directly with BotFather by the operator. The wizard hatch flow walks the operator through creating their bot, pasting the token into the signup form, and launching the agent.

- Operators hold their own admin tokens. If an admin token fails, the operator generates a new one from BotFather and replaces it through the wizard.
- Tokens are encrypted at rest with AES-256-GCM. Encryption and Telegram API helpers live in `api/src/services/pool.ts`.
- The platform never provisions, reserves, or rotates tokens on behalf of operators. Every token in the system belongs to one operator who acquired it themselves.

---

## Reference Files

**The 4-doc model — only SOTU and NEXT_SESSION contain state:**

- `SOTU.md` — **single source of truth. Read this first every session.** Everything stateful lives here.
- `NEXT_SESSION.md` — ordered action list for next session. Deletion-only.
- `CLAUDE.md` — this file. Timeless engineering directives. No state.
- `DAILY_CHECKS.md` — session-open operational ritual. Pure procedure. No state.

**Supporting docs (domain-specific, rarely change):**

- `ARCHITECTURE.md` — canonical system design
- `RULES.md` — engineering rules of engagement
- `SOUL.md` — brand voice, mission, personality directives
- `WHAT_TIGER_CLAW_DOES.md` — product vision / one-sentence pitch

**Archived:**

- `docs/archive/STATE_OF_THE_TIGER_PATH_FORWARD.md` — pre-Session-20 session history
