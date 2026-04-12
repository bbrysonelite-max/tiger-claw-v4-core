# Next Session Priorities

**Read SOTU.md first. Then this file. Then run `DAILY_CHECKS.md` before any other work. No exceptions.**

**No lying. No assuming. No guessing. Do not claim anything works until tested live.**

**This file is deletion-only. Closed items are removed, not marked ✅. If you finish an item, delete it from this file in the same PR that closed it.**

---

## Context — Where We Are

Session 23 found and fixed the root cause of the lobotomy: the Gemini SDK's `getGenerativeModelFromCachedContent()` silently overwrites `systemInstruction` with `cachedContent.systemInstruction` (which was undefined). Every bot was running with NO system prompt. PR #319 bypassed the cache. PR #317 fixed the garbage identity data in the hatch route. PR #320 added operator profession from flavor config.

The bot now wakes up with Tiger voice ("Let me take you by the hand and lead you to your brighter future") and can hold prospect conversations. But the prompt needs work — steps need to be smaller for Gemini to follow reliably, and operator interactions need refinement (bot asked "what do you do?" before PR #320).

Wizard is 2 steps: (1) Telegram bot token, (2) Gemini API key. Operator name comes from Stripe automatically.

`brents-tiger-01-mns7wcqk` (Tiger Proof / Nu Skin) is still the only production bot. Awaiting Pat Sullivan's quality review on first SSDI batch (35 leads, delivered 2026-04-12).

---

## Do These In Order. Do Not Skip Ahead.

---

### 1. Prompt engineering — make the bot smart enough to do the job

The bot has voice, personality, market intelligence, and the flavor config brain. But Gemini needs the instructions broken into smaller steps to follow them reliably. This is iterative prompt work, not architecture.

**Requirements:**
1. **Test infrastructure** — a set of test bots with pre-loaded Telegram tokens and Gemini keys, so testing doesn't require going through Stripe checkout every time.
2. **Enough Gemini API quota** for extensive back-and-forth testing.
3. **Time** to iterate. This is not a one-PR fix.

**What to test:**
- Prospect first touch (cold open from "hi" or "/start")
- Prospect qualification (life situation, pain signals)
- Prospect objection handling (scam?, cost?, trust?)
- Prospect close to Zoom
- Operator requests ("find me prospects", "anything good today?", "run a scan")
- Operator coaching ("nothing is working", "should I focus on LinkedIn or Instagram?")
- Mixed conversation (prospect sends message, then operator asks about pipeline)

**Acceptance:** bot handles all scenarios above without exposing tool names, without asking the operator what they do, without falling into generic assistant mode, and without listing capabilities.

---

### 2. Stripe cleanup — branding + dead endpoints + signature fix

1. **Stripe branding** (dashboard only): Change business name from "Bot Craft Automation" → "Tiger Claw". Update product description from "AI Recruiting Agent". Set brand color to orange.
2. **Deactivate 2 dead botcraftwrks.ai webhook endpoints** in Stripe dashboard.
3. **Check $1 test Payment Link** (`plink_1TLEtH0Fp3hGvMoU3Cp4xMhf`) — verify status, recreate if needed for Jeff Mack / Debbie Cameron.
4. **Fix `STRIPE_WEBHOOK_SECRET` mismatch** — secret in Cloud Run doesn't match signing secret for endpoint `we_1TAPuv0Fp3hGvMoUYrbo6ira`. Update via `gcloud secrets` or re-roll the webhook signing secret in Stripe.
5. **Delete Stan Store dead code** — `POST /webhooks/stan-store`, stan-store-onboarding queue/worker, Stan Store URL references in reactivate.ts and subscriptions.ts. Separate task — touches multiple files.

---

### 3. Admin dashboard — build dependency health endpoint

**There is no dependency health endpoint on the backend at all.** `GET /admin/pipeline/health` is a **mine statistics** endpoint, not dependency checks.

**Build:**
1. **Expand** `GET /admin/pipeline/health` (or build a new `/admin/dependencies/health`) to check: Postgres connectivity, Redis ping, each BullMQ worker, Telegram webhook delivery, Serper×3 keys, Gemini platform keys, Resend email, Oxylabs credentials, Stripe webhook, OpenRouter circuit breaker state.
2. **Wire** the dashboard to call the dependency health endpoint.
3. **Render** each dependency as a green/red row. Red surfaces as a loud alarm at the top of the dashboard.

---

### 4. Admin dashboard — mine health panel

Add a mine status card to the admin dashboard surfacing:
- Last run timestamp + duration
- Last run fact count
- Last 5 fact summaries (read-only, for sanity check)
- Worker error count since midnight
- Mine Gemini key identifier

---

## Flag — Not a Fix, Monitor Only

**Dead Gemini cache code at `api/src/services/ai.ts`** — `geminiCacheByKey` map, `GEMINI_CACHE_TTL_SECONDS` constant, and `GoogleAICacheManager` import are still in the file but unused after PR #319 bypassed the cache. Clean up when convenient but not urgent.

---

## Do Not Build

- **Cal.com booking:** `tiger_book_zoom` is built. Inactive until `calcomBookingUrl` is set by operator. Not a code task.
- **LINE:** Deferred. Requires LINE Official Account. Not a roadmap item this phase.
- **New features:** no new features without a paying customer asking.
- **Refactors, cleanup, or "improvements" not listed above.**

---

## Session Close Protocol (4-doc model)

When this session ends:
1. Update `SOTU.md` with what actually shipped. Not what was planned.
2. **Delete** closed items from `NEXT_SESSION.md`. Do not mark ✅. Do not leave `ALREADY IN PLACE` annotations. Remove.
3. Verify every merged PR with `gh pr view <number>` showing MERGED.
4. Verify deploy with `curl https://api.tigerclaw.io/health` returning 200.
5. No session is CLOSED until SOTU and NEXT_SESSION are in sync with each other and with git.

**That's it. Two files. No `CLAUDE.md` session block update. No `PATH_FORWARD` update. No `START_HERE` update. Those files are either deleted, archived, or carry no state.**
