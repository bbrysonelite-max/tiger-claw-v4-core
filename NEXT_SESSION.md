# Next Session Priorities

**Read SOTU.md first. Then this file. Then run `DAILY_CHECKS.md` before any other work. No exceptions.**

**No lying. No assuming. No guessing. Do not claim anything works until tested live.**

**This file is deletion-only. Closed items are removed, not marked ✅. If you finish an item, delete it from this file in the same PR that closed it.**

---

## Context — Where We Are

Session 22 shipped the Stripe payment flow end-to-end and eliminated the email gate. PRs #310–#313 merged. Payment Link → webhook → user/bot/subscription → wizard auto-verify is proven with a $1 test purchase. The wizard is now locked — `/signup` without a Stripe `session_id` redirects to the landing page. No email form anywhere.

`brents-tiger-01-mns7wcqk` (Tiger Proof / Nu Skin) is still the only active bot. Awaiting Pat Sullivan's quality review on first SSDI batch (35 leads, delivered 2026-04-12).

---

## Do These In Order. Do Not Skip Ahead.

---

### 1. Delete 3 OpenClaw self-referential rows from `market_intelligence`

Carryover from Session 20 mine audit, never executed. Low priority, but keep on the list until actually deleted:

```sql
SELECT id, LEFT(fact_summary, 60) FROM market_intelligence WHERE fact_summary ILIKE '%OpenClaw%';
CREATE TABLE market_intelligence_backup_20260412 AS SELECT * FROM market_intelligence WHERE fact_summary ILIKE '%OpenClaw%' OR fact_summary ILIKE '%Tiger Claw%';
DELETE FROM market_intelligence WHERE id IN ('<full-uuid-1>', '<full-uuid-2>', '<full-uuid-3>');
```

---

### 2. Voice examples for network-marketer flavor

The bot now responds intelligently. It does NOT yet respond in Brent's actual voice. The system prompt is still generic "helpful assistant" tone. This is prompt engineering, not architecture.

**Brent writes the examples in his own voice.** Claude Code wires them into the network-marketer flavor system prompt. Then re-test from a fresh chatId with "I'm tired of my job" and compare against the late-night baseline.

The examples should cover at minimum:
- Opening response to a transition-stage prospect (unhappy at current job)
- Qualifying question that surfaces network-marketing fit without sounding like a pitch
- Handling "tell me more about the product" without becoming a product brochure
- Soft close toward a Zoom call

Do not write code until Brent has provided the example text. This is a pair-programming task, not a solo task.

---

### 3. Verify the mine has a dedicated Gemini key

Suspected during the late-night diagnosis but not confirmed. Trace the mine's intelligence path: when `marketIntelligenceWorker` or `factExtractionWorker` runs, which Gemini key does it use? Is it (a) a dedicated mine key, (b) a platform fallback key, or (c) the first tenant's key it finds?

If the mine is borrowing a tenant's key, that's a billing leak and a silent failure risk (if that tenant's key dies, the mine dies with it).

Report findings. Do not fix until Brent has decided the architecture.

---

### 4. Verify admin hatch + all callers use new field names

PR #281 renamed `icpBuilder` → `icpProspect` and `icpCustomer` → `icpProduct` at 19:06 PDT on 2026-04-09. The admin hatch route `fdfc803` was still sending the OLD field names at 18:12 PDT — and continued to run at 19:41 PDT (18 minutes after the rename merged), which is how the lobotomy was created.

**Audit required:** grep the codebase for `icpBuilder` and `icpCustomer`. Every hit that is not in a migration file, archived doc, or test fixture should be fixed. Verify the admin hatch client (wherever it lives — dashboard, Claude Code session, a script) is sending the new field names.

---

### 5. Stripe cleanup — branding + dead endpoints + signature fix

Stripe payment flow is live and proven. Remaining cleanup:

1. **Stripe branding** (dashboard only): Change business name from "Bot Craft Automation" → "Tiger Claw". Update product description from "AI Recruiting Agent". Set brand color to orange.
2. **Deactivate 2 dead botcraftwrks.ai webhook endpoints** in Stripe dashboard.
3. **Deactivate $1 test Payment Link** (`plink_1TLEtH0Fp3hGvMoU3Cp4xMhf`) and refund the test charge.
4. **Fix `STRIPE_WEBHOOK_SECRET` mismatch** — secret in Cloud Run doesn't match signing secret for endpoint `we_1TAPuv0Fp3hGvMoUYrbo6ira`. Update via `gcloud secrets` or re-roll the webhook signing secret in Stripe.
5. **Update webhook log message** — handler says "STAN STORE PRE-SALE", should say "Stripe".
6. **Delete Paddle webhook dead code** — `POST /webhooks/paddle` handler is unused.

---

### 6. Admin dashboard — build dependency health endpoint

**There is no dependency health endpoint on the backend at all.** `GET /admin/pipeline/health` at `api/src/routes/admin.ts:906` looks like it should be one based on its name, but it is actually a **mine statistics** endpoint — it returns `totalFacts`, `factsLast24h`, `byVertical`, `byRegion`, `byCapturedBy`, and a single `healthy` boolean computed from "did any facts land in the last 24h AND newest fact within 48h". It does NOT check Serper, Gemini platform keys, Resend, Oxylabs, Postgres connectivity (beyond the query implicitly needing the DB), Redis, any BullMQ worker, Telegram webhook delivery, Stripe webhook, or OpenRouter. The dashboard UI (`web-onboarding/src/app/admin/dashboard/page.tsx`) does not call it either.

Either build a new `GET /admin/dependencies/health` endpoint for the real dependency checks, or expand `/admin/pipeline/health` to add them alongside the mine stats (recommended — one endpoint, loud response, easy to consume).

**Build:**
1. **Expand** `GET /admin/pipeline/health` (or build a new `/admin/dependencies/health`) to check: Postgres connectivity, Redis ping, each BullMQ worker in `api/src/workers/` (alive + recent heartbeat), Telegram webhook delivery (registered count vs active tenants), Serper×3 keys (the ones currently NOT checked anywhere), Gemini platform keys (platform + onboarding + emergency — NOT checked anywhere), Resend email (NOT checked anywhere), **Oxylabs** credentials + a test request, Stripe webhook (timestamp of last event received), OpenRouter circuit breaker state.
2. **Wire** the dashboard to call the dependency health endpoint (and separately render the mine stats from `/admin/pipeline/health`'s existing payload).
3. **Render** each dependency as a green/red row. Red surfaces as a loud alarm at the top of the dashboard. Never silently absent.

**Acceptance:** open the admin dashboard, every dependency is visible, Oxylabs is on the list, no 404s in the browser network tab. `DAILY_CHECKS.md` item 1 becomes fully runnable from the dashboard.

---

### 7. Admin dashboard — mine health panel

Add a mine status card to the admin dashboard surfacing:
- Last run timestamp + duration
- Last run fact count
- Last 5 fact summaries (read-only, for sanity check — is the data usable?)
- Worker error count since midnight (`factExtractionWorker`, `marketIntelligenceWorker`)
- Mine Gemini key identifier (dependent on item 5 above tracing the key first)

**Acceptance:** `DAILY_CHECKS.md` item 3 becomes fully runnable from the dashboard without manual `psql` queries.

---

## Flag — Not a Fix, Monitor Only

**Gemini model cache at `api/src/services/ai.ts:1350`** — `getGeminiModelWithCache` caches compiled models per key. If the cache holds a stale system prompt between deploys, a bot could respond with old voice examples even after a new deploy. Not a problem during the late-night fix (fresh chatId triggered a fresh build). Flag for future debugging if stale behavior appears after a voice-example deploy.

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
