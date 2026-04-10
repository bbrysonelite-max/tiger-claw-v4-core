# Daily Operational Checks

**Run these at the start of every working session. Do not skip.**

**No lying. No assuming. No guessing. If a check fails, stop and fix before any other work.**

---

## Why this file exists

Some things need to be verified every day, not just when something feels broken. A silent failure that nobody catches is more expensive than a loud failure that triggers an immediate fix. Every item below is a thing that (a) can break without warning and (b) would do real damage to a paying customer if it stayed broken for more than a day.

---

## Daily Checks

### 1. Admin dashboard — every dependency green or loud-alarm red

**Location:** `wizard.tigerclaw.io/admin/dashboard`

Open the dashboard. Every external dependency must be either green (healthy) or red with a visible alarm. Never silently absent. If a dependency is not on the dashboard at all, that is a failure — add it.

**Dependencies to verify (target state):**
- Postgres (Cloud SQL)
- Redis
- Every BullMQ worker in `api/src/workers/` (alive + recent heartbeat)
- Telegram webhook delivery (registered count matches active tenants)
- Gemini API platform keys (platform, onboarding, emergency)
- OpenRouter circuit breaker (fallback path healthy)
- Serper (×3 keys, round-robin)
- **Oxylabs** (added recently — MUST be on the dashboard)
- Resend email
- Paddle webhook (last event received within expected window)

**Current gap (as of 2026-04-10):** the admin dashboard surfaces almost none of these. The backend has a partial check at `GET /admin/pipeline/health` covering Serper×3, Gemini platform×3, and Resend — and the dashboard UI does not even call that endpoint. A zombie `/admin/pool/health` fetch is 404ing on every dashboard refresh. This is a pending build task — see `NEXT_SESSION.md` item 6.

**Until the build lands**, run the backend check directly:

```bash
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -s https://api.tigerclaw.io/admin/pipeline/health \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq
```

Every entry must return `ok: true`. Any `ok: false` is stop-the-world.

---

### 2. One-page signup — Gemini key validator rejects bad keys

**Location:** `wizard.tigerclaw.io/signup` (source: `web-onboarding/src/app/signup/page.tsx`, spec: `specs/PHASE_1_SIGNUP.md`)

The one-page signup must reject a dead Gemini key at hatch time with a user-visible error before the bot is provisioned.

**Daily test:** fire a hatch attempt with a deliberately malformed Gemini key (e.g. `"not-a-real-key"`). Confirm the signup rejects it with an actionable error pointing the user at aistudio.google.com. Then confirm a real key passes.

**Current gap (as of 2026-04-10):** the key validator was removed during the one-page signup rewrite and never restored. Every bot hatched since that rewrite could have a dead key and no one would know until the circuit breaker fell through to OpenRouter. Restoration is `NEXT_SESSION.md` item 2. **Until then this check is NOT RUNNABLE** — flag at every session open that the validator is still missing and any paid customer hatch is at risk.

---

### 3. Mine health — functioning and producing usable data

**Location:** admin dashboard mine panel (pending build — `NEXT_SESSION.md` item 7) + direct DB sample until then

The bar for the mine is **qualitative**, not quantitative. There is no "≥ N facts" minimum. What matters is: is the data usable for Strike draft generation and is it representative of real prospects?

**Verify daily:**
- **Last run time** is recent (within expected cron cadence)
- **Last run did not fail** — no silent worker errors in `factExtractionWorker` or `marketIntelligenceWorker`
- **Facts are usable** — sample the 5 most recent rows from `market_intelligence`. Read the `verbatim` column. Each should be a real user quote with real sentiment relevant to the flavor's ICP. Not noise, not boilerplate, not a bot echo.
- **Mine has a dedicated Gemini key** (not borrowing a tenant's key — status unknown as of 2026-04-10, `NEXT_SESSION.md` item 3)
- **Reddit 403 fallback path** (Oxylabs / Serper) still producing facts despite the Reddit API block

**Until the mine panel is on the admin dashboard**, sample facts directly via cloud-sql-proxy (port 5433):

```bash
psql -h localhost -p 5433 -U botcraft -d tiger_claw_shared \
  -c "SELECT id, source_domain, verbatim, created_at
      FROM market_intelligence
      ORDER BY created_at DESC
      LIMIT 5;"
```

Read the verbatims. Trust your gut. If they read like noise, stop and diagnose before any other work.

---

## What this file is NOT

- **Not a CI checklist.** No test suite replaces reading the actual data.
- **Not a one-time audit.** Run every session.
- **Not a monitoring dashboard substitute.** If a check is failing regularly, the answer is instrumentation with loud alarms — not manual checks forever.

---

## When to update this file

- **Add a check** when a silent failure causes customer damage and you wish you had caught it a day earlier.
- **Remove a check** only when it graduates to automated loud-alarm instrumentation. Note the graduation in the commit message. Do not silently delete.
