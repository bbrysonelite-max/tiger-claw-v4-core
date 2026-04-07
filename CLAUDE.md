# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints, not suggestions. They apply to every line of code, every UI flow, every API endpoint, and every background job.**

---

## Current Session State (2026-04-06 — Session 15 COMPLETE)

### 458/458 tests passing. PRs #235, #236, #237 merged. Cloud Run revision 00372-mg2 live.

**Session 15 shipped:**
- **PR #235 — Verbatim fix (tiger_refine):** Every saved market intelligence fact now requires an exact word-for-word quote from the source. Field renamed `rawText` → `verbatim`. Prompt enforces no-quote-no-fact rule. Filter rejects facts with verbatim < 15 chars.
- **PR #236 — Paddle webhook integration:** `POST /webhooks/paddle` live. HMAC-SHA256 signature verification. Redis idempotency (24h TTL, fail closed on Redis down). Provisions BYOK user+bot+subscription on `transaction.completed`. GCP secrets created: `paddle-webhook-secret`, `paddle-api-key`. Webhook configured in Paddle dashboard.
- **PR #237 — Wizard flavor fix:** Removed 5 cut flavors (personal-trainer, dorm-design, baker, candle-maker, gig-economy) from wizard signup. Now shows canonical 9.
- **Oxylabs confirmed working:** Mine ran with Oxylabs producing 209 posts vs 14 from Serper. Env vars confirmed in deployed revision.
- **Deployed:** Cloud Run revision `tiger-claw-api-00372-mg2`. Health green. fix-all-webhooks run (2 tenants fixed).

**Full assessment in `MODULE_ASSESSMENT.md`. Read it before writing any code.**

### FIRST PRIORITY NEXT SESSION: Close the Paddle Payment Loop

Paddle webhook is live and provisioning works. What's missing: a Paddle product + price so a real checkout can trigger the full chain. Tomorrow:
1. Create a Paddle product + price in Paddle dashboard
2. Get a checkout link
3. Buy it as a customer
4. Watch the webhook fire → bot provisioned → go through wizard → bot scouts → bot talks

Do not add features. Prove the loop closes end-to-end first.

### Critical Open Issues

- **PADDLE PRODUCT:** Webhook is live but no Paddle product/price exists yet. No checkout URL. Create tomorrow before testing.
- **C4:** Payment gate still open for direct wizard access. Fix after Paddle loop is proven.
- **Admin alert markdown bug:** Underscores in error messages (e.g. `pending_setup`) break Telegram Markdown parser. Admin alerts with error text fail to deliver. Fix before launch.
- **LINE:** Not provisioning LINE. Future only. Telegram is the only active channel.

### Active Business Context

- Operator is building this for their own distribution network. Do not treat any individual names as launch gates. If any one person falls out, it does not matter. The platform must stand on its own merit.
- **Max Steingart:** White label / affiliate deal (30% via Stan Store). Hold at referral model. Do not build partner infrastructure until he has sold his first 10.
- Founding members: comped provisioning, manual if needed. Payment gate fix comes after first live conversation is confirmed.

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
- 449 tests must pass before any PR is opened. Run `npm test` from `api/`.

---

## Reference Files

- `SOTU.md` — **single source of truth. Read this first every session.**
- `START_HERE.md` — fast orientation
- `ARCHITECTURE.md` — canonical system design
- `STATE_OF_THE_TIGER_PATH_FORWARD.md` — roadmap and merged PR history
- `SOUL.md` — brand voice, mission, and personality directives
- `RULES.md` — engineering rules of engagement
