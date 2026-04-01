# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints, not suggestions. They apply to every line of code, every UI flow, every API endpoint, and every background job.**

---

## Current Session State (2026-03-30 5:45 PM MST)

- **FIRE TEST IN PROGRESS.** Phase 6. Jeff Mack demo at 8 PM tonight.
- **Revision 00172** deployed with: multi-agent auth, wizard UX fixes, bot_pool removal.
- **3 additional bugs found during fire test** — all fixed by Gemini, deploying now:
  1. Provisioner name UPDATE missing (bot showed email prefix)
  2. ICP fast-path missing in ai.ts (bot asked ICP questions instead of using wizard data)
  3. Email prefix as name (resolved by fix #1)
- **PRs Merged:** #106, #107, #108, #109, #110.
- **Architecture LOCKED:** V4 Stateless (Cloud Run + Redis + Postgres).
- **Admin Bot ACTIVE:** `@AlienProbeadmin_bot` with heartbeat monitor.

### Active Business Context
- **Max Steingart:** White label deal, 30% affiliate via Stan Store. Must sell 10 before we build.
- **John / Bryson International Group:** 21,000 LINE distributors in Thailand. Pebo's own downline.
- **Jeff Mack:** Demo tonight at 8 PM. Non-technical. Telegram. Paying customer.
- **Directive from Pebo:** No new features. Reduce friction, provision agents, sell.

---

## Product Philosophy: Integrity First

> "Every system we build must adhere to a strict ethical code: Value must
> exceed Cost. Do not write code that traps users, obfuscates pricing, or adds
> unnecessary complexity. Prioritize the user's time and success as a moral
> obligation. If a feature does not provide immediate, tangible value, it is
> friction and must be eliminated."

---

## 1. Integrity First — User Agency Is Sacred

### Easy Exit Mandate
- Every subscription and onboarding flow **must** expose a clearly visible, one-click cancellation or data-export path.
- **Never** add hidden flags, cooldown timers, confirmation mazes, or multi-step friction to prevent a user from cancelling or exporting their data.
- If you are writing a cancellation route, it must complete in a single API call with no silent side effects that degrade the user's account before confirmation.

### No Dark Patterns
- **Never** pre-check add-on boxes, upsell toggles, or marketing consent.
- **Never** use ambiguous button labels ("Cancel" meaning "cancel cancellation" vs "cancel subscription" is a dark pattern — always use explicit labels).
- **Never** hide pricing, usage caps, or trial expiry behind extra navigation.
- If a UI element's purpose is to make the user *accidentally* stay or spend, delete it.

---

## 2. Radical Value Delivery — Keeping Money Without Value Is a Moral Failure

### Value-Gap Detection
- Any tenant who is paying and has **not generated a lead in 3 consecutive days** must be flagged in the system.
- The flag triggers a "Value Check-in" message to the operator — not a retention campaign, but a genuine diagnostic: *"Your bot hasn't surfaced a lead in 3 days. Here's what might be wrong, and here's how to fix it."*
- This logic lives in the cron heartbeat. It is not optional.

### Proactive Error Correction
- If the system detects a backend processing error — even one the user has not yet seen — the code must: (1) log it, (2) attempt self-correction, (3) notify the affected user with a plain-language apology and status update.
- **Never** swallow errors silently when the error affects a paying user's output.

---

## 3. Complexity Is a Moral Tax — Protect the User's Time

### Friction Audit Standard
- Before adding any new user-facing step, ask: *"Does the user need to do this, or can the system handle it?"*
- Dead clicks, redundant confirmation screens, and "just in case" form fields are defects, not features. Remove them.

### Zero-Config Target
- Background infrastructure (Redis compression, fact extraction, hive signal aggregation) must be **completely invisible** to the operator.
- The user sees one thing: their bot working. The agent handles everything else.

---

## 4. Multi-Agent Architecture (Added 2026-03-30)

- **One email can have multiple bots.** The old `lookupPurchaseByEmail` one-bot-per-email lock is dead.
- `auth.ts` now creates a NEW bot when an existing bot's subscription is not `pending_setup`.
- Each Stan Store purchase creates a fresh bot_id, fresh subscription, fresh tenant.
- The wizard session token carries the correct bot_id through all 5 steps.
- This is critical for the business model: Pebo wants 20+ agents. Jeff might want multiple. John's 21,000 distributors will want several each.

---

## Engineering Constraints (Non-Negotiable)

- `main` is branch-protected. Always use `feat/` branches and `gh pr create`.
- Never push directly to `main` or use `--no-verify` / `--force` without explicit user instruction.
- OpenClaw, Mini-RAG, and per-tenant Docker containers are permanently eradicated. Do not reference or recreate them.
- The Mac cluster at 192.168.0.2 is an **offline** Reflexion Loop tool. It is NOT a Cloud Run dependency.
- `buildSystemPrompt()` is async. Always `await` it.
- All DB/Redis calls in hot paths must be wrapped in `try/catch` with graceful degradation.

---

## Reference Files

- `ARCHITECTURE.md` — canonical system design
- `START_HERE.md` — session resurrection briefing and phase status
- `STATE_OF_THE_TIGER_PATH_FORWARD.md` — roadmap and merged history
- `specs/` — feature specifications
