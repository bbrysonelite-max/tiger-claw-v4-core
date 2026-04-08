# Tiger Claw — Agent Directives

**Every AI reading this file must treat these as non-negotiable constraints, not suggestions. They apply to every line of code, every UI flow, every API endpoint, and every background job.**

---

## Current Session State (2026-04-07 — Session 16 continued — PRs #257–#261 merged)

### 462/462 tests passing. PRs #251–#261 merged. Cloud Run revision 00417-4qf live.

**Session 16 shipped (PRs #251–#255):**
- **PR #251 — bot-status fix:** `GET /wizard/bot-status` returned `pending` for admin-hatched bots. Provisioner sets `status = 'live'`; endpoint only checked `active`/`onboarding`. Added `'live'` to both isLive checks in `wizard.ts`.
- **PR #252 — duplicate tenant fix (critical):** Hatch was creating two tenant records. Slug generated twice with different `Date.now()` — once in `createBYOKBot()`, again in hatch handler. Fixed: generate slug once, pass as `precomputedSlug`.
- **PR #253 — dashboard isLive + Stan Store cleanup:** `dashboard.ts` isLive missing `'live'` status. Removed two user-facing "Stan Store" references from `StepReviewPayment.tsx`.
- **PR #254 — SOTU docs:** Recorded ICP hard-wire decision.
- **PR #255 — ICP hard-wire:** Provisioner pre-seeds `onboard_state.json` at hatch time. `phase: complete`, ICP from flavor config. Bot wakes up calibrated — **no interview, no questions asked**. Optional `product` field on `/admin/hatch`.
- **Brents Tiger 01 (@Brentstiger01_bot) confirmed live and responding on Telegram.**
- **Parallel sub-agent audit:** Mine healthy (2 AM orchestrated run), NM defaultBuilderICP solid, webhook query correct.

**Session 16 continued shipped (PRs #257–#261):**
- **PR #258 — WHAT_TIGER_CLAW_DOES.md:** New doc, product vision with ⚠️ markers.
- **PR #260 — `tiger_book_zoom`:** Cal.com booking tool. Registered in `toolsMap`. Reads `calcomBookingUrl` from settings.json. Fires admin alert on booking. Inactive until `calcomBookingUrl` is set.
- **PR #261 — first impression + language matching + strike pipeline + wizard cleanup:**
  - 4-language `/start` greeting (per-chatId, state in `first_impression_shown.json`).
  - System prompt: language-matching directive — agent mirrors prospect's language.
  - `strike_auto_pipeline.ts` (new): harvest → draft → Web Intent URLs → admin alert → mark queued.
  - `reporting_agent.ts`: calls `runStrikeAutoPipeline()` after mine cycle (non-fatal).
  - Interior Designer removed from wizard frontend.
- **Direct DB fix:** Brents Tiger 01 `onboard_state.json` force-written with `phase: complete`, Nuskin identity, full NM defaultBuilderICP.

**Full assessment in `MODULE_ASSESSMENT.md`. Read it before writing any code.**

### FIRST PRIORITY NEXT SESSION

1. **Verify Tiger Strike at 2 AM** — Check that `engagement_status` rows moved to `queued` and admin alert arrived after mine cycle.
2. **Set `calcomBookingUrl`** — Write Cal.com booking URL to Brents Tiger 01 settings.json. Test `tiger_book_zoom`.
3. **Send bot link to 5 warm contacts** — Operator action. `t.me/Brentstiger01_bot`. Document first cold conversation.
4. **Wizard contrast fix** — Gray instructional text on dark backgrounds is illegible. Replace `text-gray-*` / `text-slate-*` on helper text with `text-white` or `text-slate-200`.
5. **Create Paddle product + price** — No checkout URL exists. Build before testing payment loop.

### Critical Open Issues

- **CALCOM URL:** `tiger_book_zoom` built, not active. Set `calcomBookingUrl` in Brents Tiger 01 settings before testing booking.
- **STRIKE PIPELINE UNVERIFIED:** Wired. Has not yet fired at 2 AM. Check after next mine cycle.
- **PADDLE PRODUCT:** Webhook live, no product/price yet. No checkout URL. Create before testing.
- **C4:** Payment gate still open for direct wizard access. Fix after Paddle loop proven.
- **Admin alert markdown bug:** Underscores in error messages break Telegram Markdown parser. Fix before launch.
- **Orphan tenant:** `brents-tiger-01-mnpcril3` (1ed77b8f) — duplicate from bug. No bot token. Terminate when convenient.
- **LINE:** Future only. Telegram is the only active channel.

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
- 462 tests must pass before any PR is opened. Run `npm test` from `api/`.

---

## Reference Files

- `SOTU.md` — **single source of truth. Read this first every session.**
- `START_HERE.md` — fast orientation
- `ARCHITECTURE.md` — canonical system design
- `STATE_OF_THE_TIGER_PATH_FORWARD.md` — roadmap and merged PR history
- `SOUL.md` — brand voice, mission, and personality directives
- `RULES.md` — engineering rules of engagement
