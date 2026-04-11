# Daily Operational Checks

**Run these at the start of every working session. Do not skip.**

**No lying. No assuming. No guessing. If a check fails, stop and fix before any other work.**

**This file is pure procedure. No state claims live here. If a check is currently broken, that lives in `SOTU.md` — not here.**

---

## Why this file exists

Some things need to be verified every day, not just when something feels broken. A silent failure that nobody catches is more expensive than a loud failure that triggers an immediate fix. Every item below is a thing that (a) can break without warning and (b) would do real damage to a paying customer if it stayed broken for more than a day.

---

## Daily Checks

### 1. Admin dashboard — every dependency green or loud-alarm red

**Location:** `wizard.tigerclaw.io/admin/dashboard`

Open the dashboard. Every external dependency must be either green (healthy) or red with a visible alarm. Never silently absent. **If a dependency is not on the dashboard at all, that is a failure — add it.**

**Dependencies to verify:**
- Postgres (Cloud SQL)
- Redis
- Every BullMQ worker in `api/src/workers/` (alive + recent heartbeat)
- Telegram webhook delivery (registered count matches active tenants)
- Gemini API platform keys (platform, onboarding, emergency)
- OpenRouter circuit breaker (fallback path healthy)
- Serper (×3 keys, round-robin)
- Oxylabs
- Resend email
- Stripe webhook (last event received within expected window)

---

### 2. One-page signup — Gemini key validator rejects bad keys

**Location:** `wizard.tigerclaw.io/signup` (source: `web-onboarding/src/app/signup/page.tsx`, validator: `api/src/routes/wizard.ts:190` via `validateAIKey("google", aiKey)`)

The one-page signup must reject a dead Gemini key at hatch time with a user-visible error before the bot is provisioned.

**Daily test:** fire a hatch attempt with a deliberately malformed Gemini key (e.g. `"not-a-real-key"`). Confirm the signup rejects it with an actionable error pointing the user at aistudio.google.com. Then confirm a real key passes.

**Expected behavior:** `validateAIKey` makes a live HTTP call to `generativelanguage.googleapis.com/v1beta/models`. Bad key → 400 with `field: "aiKey"` → signup page maps the error back to the form field and shows it inline.

---

### 3. Mine health — functioning and producing usable data

**Location:** admin dashboard mine panel (if built — otherwise direct DB sample via `psql`)

The bar for the mine is **qualitative**, not quantitative. There is no "≥ N facts" minimum. What matters is: is the data usable for Strike draft generation and is it representative of real prospects?

**Schema note:** the `market_intelligence` table has **no `verbatim` column**. The content column is `fact_summary`, and every row is an LLM paraphrase in third person ("The individual expresses…", "The user lacks…"), not a real user quote. The mine does not store prospect language verbatim anywhere. When this check says "read the facts", it means reading paraphrased summaries — use your gut on whether the paraphrase reflects a real, topically-relevant prospect statement.

**Verify daily:**
- **Last run time** is recent (within expected cron cadence) — check `/admin/pipeline/health` → `newestFact` field, or query `MAX(created_at)` directly
- **Last run did not fail** — no silent worker errors in `factExtractionWorker` or `marketIntelligenceWorker`
- **Facts are usable** — sample the 5 most recent rows from `market_intelligence`. Read the `fact_summary` column. Each should paraphrase a real, topically-relevant statement relevant to the flavor's ICP. Not noise, not boilerplate, not operator sales copy, not unrelated threads that tripped a keyword classifier.
- **Reddit 403 fallback path** (Oxylabs / Serper) still producing facts despite the Reddit API block

**Sample facts via cloud-sql-proxy** (port 5433) until the mine panel is on the admin dashboard. Extract creds from the database URL secret (the DB password is not stored as a standalone secret):

```bash
DATABASE_URL=$(gcloud secrets versions access latest --secret="tiger-claw-database-url" --project="hybrid-matrix-472500-k5")
USER=$(echo "$DATABASE_URL" | sed -E 's|^postgres(ql)?://([^:]+):.*|\2|')
PASS=$(echo "$DATABASE_URL" | sed -E 's|^postgres(ql)?://[^:]+:([^@]+)@.*|\2|')

PGPASSWORD="$PASS" psql -h 127.0.0.1 -p 5433 -U "$USER" -d tiger_claw_shared -c "
  SELECT LEFT(id::text, 8) AS id, domain, category, captured_by, confidence_score AS conf,
         LEFT(fact_summary, 400) AS fact,
         TO_CHAR(created_at, 'MM-DD HH24:MI') AS created
  FROM market_intelligence
  WHERE domain = 'Network Marketer'
  ORDER BY created_at DESC
  LIMIT 5;
"
```

**Gotcha:** cloud-sql-proxy caches ADC at startup. If `gcloud auth application-default login` was re-run, restart the proxy (`kill <pid>`, relaunch) before expecting new auth to take effect.

Read the summaries. Trust your gut. If they read like noise, self-references, or off-topic content, stop and diagnose before any other work.

---

## What this file is NOT

- **Not a CI checklist.** No test suite replaces reading the actual data.
- **Not a one-time audit.** Run every session.
- **Not a monitoring dashboard substitute.** If a check is failing regularly, the answer is instrumentation with loud alarms — not manual checks forever.
- **Not a place for state claims.** If the Gemini key validator is currently broken, that lives in `SOTU.md`, not here. This file describes the check itself — timelessly.

---

## When to update this file

- **Add a check** when a silent failure causes customer damage and you wish you had caught it a day earlier.
- **Remove a check** only when it graduates to automated loud-alarm instrumentation. Note the graduation in the commit message. Do not silently delete.
- **Never embed "current gap as of [date]" blocks.** Gaps drift. Procedure doesn't. If the procedure can't be run today because something is broken, the broken thing lives in `SOTU.md`.
