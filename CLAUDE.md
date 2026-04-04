# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints, not suggestions. They apply to every line of code, every UI flow, every API endpoint, and every background job.**

---

## Current Session State (2026-04-04 — Sessions 7+8 COMPLETE)

### Platform is fully green. 455/455 tests passing. Revision 00310-pjx live.

**Sessions 7+8 fixed 14+ silent failures including things broken since launch:**
- Serper fallback for market miner (Reddit 403'd from Cloud Run egress)
- RESEND_API_KEY wired into deploy — first production email ever sent and confirmed
- TELEGRAM_WEBHOOK_SECRET in deploy — webhooks no longer need manual fix after every deploy
- Admin alert env var names corrected — alerts were silently dropped since launch
- nurture_check now correctly calls tiger_nurture, not tiger_scout
- 72-hour duplicate account window removed
- Slug collision guard added to wizard hatch
- Scoring ceiling fixed (engagement weight normalized)
- tiger_refine registered in toolsMap
- getTenant() wrapped in try/catch in webhook hot path
- tiger_strike_draft FK validation — prevents hallucinated UUID crashes
- System prompt rule: never report tool failures to operator, never ask "what's it gonna be?"
- Mine dashboard controls — Run Now button, live status, last run stats
- tiger_gmail_send + tiger_postiz removed from toolsMap (irreversible public actions — not Tiger's job)
- /admin/metrics activeTenants fixed — was counting onboarding as active

### Immediate Priority
Jeff Mack, John (Thailand), and Debbie need to complete wizard at `wizard.tigerclaw.io/signup`.
Target: first 10 customers from Brent/Jeff/John NuSkin network running for one week.

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
- 455 tests must pass before any PR is opened. Run `npm test` from `api/`.

---

## Reference Files

- `SOTU.md` — **single source of truth. Read this first every session.**
- `START_HERE.md` — fast orientation
- `ARCHITECTURE.md` — canonical system design
- `STATE_OF_THE_TIGER_PATH_FORWARD.md` — roadmap and merged PR history
- `SOUL.md` — brand voice, mission, and personality directives
- `RULES.md` — engineering rules of engagement
