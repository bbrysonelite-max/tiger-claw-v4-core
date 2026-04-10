# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints, not suggestions. They apply to every line of code, every UI flow, every API endpoint, and every background job.**

---

## Current Session State (2026-04-09 — Session 18 CLOSED)

### 456/456 tests passing. PRs #274–#284 merged. Cloud Run revision **tiger-claw-api-00450-ntm** live. Wizard on Vercel (auto-deployed). Webhook fix confirmed: brents-tiger-01-mns7wcqk fixed.

**Session 18 shipped (PRs #274–#284):**
- **PR #274** — Remove bot pool (5,559 lines deleted)
- **PR #275** — Post-#274 collateral fix
- **PR #276/#279/#283/#284** — Doc updates
- **PR #277** — Repo cleanup
- **PR #278** — Agent context fix: `hasOnboarding` requires real identity, `displayOperatorName` fallback, provisioner writes `phase="identity"` when no product
- **PR #280** — Admin hatch accepts `icpProspect` + `icpProduct`
- **PR #281** — `icpBuilder` → `icpProspect`, `icpCustomer` → `icpProduct` everywhere
- **PR #282** — Commander-language wizard cleanup: ICP step removed (5→4 steps), `sales-tiger` removed, `StepCustomerProfile.tsx` deleted

### FIRST PRIORITY NEXT SESSION

1. **Verify `brents-tiger-01-mns7wcqk`** — onboard_state.json was written directly to DB (Nu Skin, full icpProspect/icpProduct). Test from a **fresh chatId**. Read what a prospect actually gets.
2. **Create Paddle product + price** — no checkout URL exists. Paddle path completely unproven.

### Critical Open Issues

- **`brents-tiger-01-mns7wcqk` not verified:** API is live with correct code. Bot not yet tested from a fresh chatId.
- **PADDLE PRODUCT:** Webhook live, no product/price yet. No checkout URL.
- **C4:** Payment gate open — direct wizard access bypasses payment. Fix after Paddle loop proven.
- **Admin alert markdown bug:** Underscores in error messages break Telegram Markdown parser.
- **LINE:** Deferred. Telegram only.
- **Cal.com booking:** `tiger_book_zoom` built. Inactive pending `calcomBookingUrl` set.

### Active Business Context

- Operator is building this for their own distribution network. Platform must stand on its own merit.
- BYOB only. Every operator provides their own Telegram bot token from BotFather. No exceptions.
- Test every bot from a FRESH chatId to see what a prospect actually sees. Never from the operator account.

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
- **456 tests must pass** before any PR is opened. Run `npm test` from `api/`.

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
