# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints,
not suggestions. They apply to every line of code, every UI flow, every API
endpoint, and every background job.**

---

## Current Session State (2026-03-31 Session 2)

- **FIRST BOT CONFIRMED LIVE.** Captain Tiger Two (`bbryson-mne8ffim`) responded on Telegram at 1:35 AM.
- **ICP Fast-Path FIXED:** Wizard bots no longer re-run onboarding. `icpSingle` is now written at hatch time and on first message. `buildSystemPrompt` falls back to `customerProfile` for pre-fix bots.
- **Grok Model UPDATED:** `grok-2-1212` → `grok-4-1-fast-non-reasoning` (xAI dropped the old model).
- **Dashboard FIXED:** AI engine label no longer mashes provider names. Telegram card no longer shows ACTIVE + "Pending" simultaneously.
- **Architecture LOCKED:** V4 Stateless (Cloud Run + PostgreSQL + BullMQ).
- **Recent PRs Merged:** direct commit (greeting CTA), #113, #114, #115, #116.

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
- Every subscription and onboarding flow **must** expose a clearly visible,
  one-click cancellation or data-export path.
- **Never** add hidden flags, cooldown timers, confirmation mazes, or
  multi-step friction to prevent a user from cancelling or exporting their data.
- If you are writing a cancellation route, it must complete in a single API
  call with no silent side effects that degrade the user's account before
  confirmation.

### No Dark Patterns
- **Never** pre-check add-on boxes, upsell toggles, or marketing consent.
- **Never** use ambiguous button labels ("Cancel" meaning "cancel cancellation"
  vs "cancel subscription" is a dark pattern — always use explicit labels).
- **Never** hide pricing, usage caps, or trial expiry behind extra navigation.
- If a UI element's purpose is to make the user *accidentally* stay or spend,
  delete it.

---

## 2. Radical Value Delivery — Keeping Money Without Value Is a Moral Failure

### Value-Gap Detection
- Any tenant who is paying and has **not generated a lead in 3 consecutive
  days** must be flagged in the system.
- The flag triggers a "Value Check-in" message to the operator — not a
  retention campaign, but a genuine diagnostic.
- This logic lives in the cron heartbeat. It is not optional.

### Proactive Error Correction
- If the system detects a backend processing error affecting a paying user,
  the code must: (1) log it, (2) attempt self-correction, (3) notify the
  affected user with a plain-language apology and status update.
- **Never** swallow errors silently when the error affects a paying user's output.

---

## 3. Complexity Is a Moral Tax — Protect the User's Time

### Zero-Config Target
- Background infrastructure must be **completely invisible** to the operator.
- The user sees one thing: their bot working. The agent handles everything else.

---

## Engineering Constraints (Non-Negotiable)

- `main` is branch-protected. Always use `feat/` branches and `gh pr create`.
- Never push directly to `main` or use `--no-verify` / `--force` without
  explicit user instruction.
- OpenClaw, Mini-RAG, and per-tenant Docker containers are permanently
  eradicated. Do not reference or recreate them.
- The Mac cluster at 192.168.0.2 is an **offline** Reflexion Loop tool. It is
  NOT a Cloud Run dependency. Never make Cloud Run call it.
- `buildSystemPrompt()` is async. Always `await` it.
- All DB calls in hot paths must be wrapped in `try/catch` with graceful
  degradation. A DB outage must never crash message delivery.
- Market intelligence domain key is **flavor displayName** (e.g. `"Real Estate Agent"`),
  NOT the flavor key (e.g. `"real-estate"`). See `getMarketIntelligence()` in `market_intel.ts`.
- Bot state lives in **PostgreSQL** per-tenant schemas (`t_{tenantId}.bot_states`), not Redis.
- Cloud SQL instance is `tiger-claw-postgres-ha`. Local proxy runs on **port 5433**.
- Grok keys: stored as `provider=grok` in `bot_ai_config`. `resolveAIProvider` translates
  to `provider=openai` + `baseURL=https://api.x.ai/v1` for the OpenAI SDK. Never confuse
  these two layers. Current model: `grok-4-1-fast-non-reasoning`.
- ICP data: wizard writes `customerProfile`. `buildSystemPrompt` reads `icpSingle`.
  Both are now written at hatch time. `buildSystemPrompt` falls back to `customerProfile`
  if `icpSingle` is absent. Do not break this fallback chain.

---

## Reference Files

- `ARCHITECTURE.md` — canonical system design
- `START_HERE.md` — session resurrection briefing, infrastructure notes, bug history
- `STATE_OF_THE_TIGER_PATH_FORWARD.md` — roadmap, merged PR history, known issues
- `specs/` — feature specifications
