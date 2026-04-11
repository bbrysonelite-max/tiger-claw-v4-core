# Next Session Priorities

**Read SOTU.md first. Then this file. Then run `DAILY_CHECKS.md` before any other work. No exceptions.**

**No lying. No assuming. No guessing. Do not claim anything works until tested live.**

---

## Context — Where We Are

Session 19 closed with a verified win: the "lobotomy" was a data problem, not a code problem. A surgical UPDATE to `brents-tiger-01-mns7wcqk`'s `onboard_state.json` at 2026-04-10 00:49 UTC produced the first real-intelligence prospect response in project history. The bot responded to "I'm tired of my job" with empathy, qualifying questions, and network-marketing context — not a canned fallback.

The architecture has been working the whole time. The data was wrong. That reframes everything below.

Cloud Run revision `tiger-claw-api-00456-9rb` is live. `brents-tiger-01-mns7wcqk` (Tiger Proof / Nu Skin) is the only active bot and is verified live from a fresh chatId.

---

## Do These In Order. Do Not Skip Ahead.

---

### 1. Voice examples for network-marketer flavor — FIRST

The bot now responds intelligently. It does NOT yet respond in Brent's actual voice. The system prompt is still generic "helpful assistant" tone. This is prompt engineering, not architecture.

**Brent writes the examples in his own voice.** Claude Code wires them into the network-marketer flavor system prompt. Then re-test from a fresh chatId with "I'm tired of my job" and compare against the late-night baseline.

The examples should cover at minimum:
- Opening response to a transition-stage prospect (unhappy at current job)
- Qualifying question that surfaces network-marketing fit without sounding like a pitch
- Handling "tell me more about the product" without becoming a product brochure
- Soft close toward a Zoom call

Do not write code until Brent has provided the example text. This is a pair-programming task, not a solo task.

---

### 2. Restore wizard Gemini key validator at hatch

The key tester was removed during the one-page signup rewrite and never restored. Every bot hatched since that rewrite could have a dead Gemini key and no one would know until a prospect message arrived and the circuit breaker fell through to OpenRouter.

**This MUST be restored before any paid customer hatches.** Implementation: call Gemini's `models.list` or a 1-token generate on the provided key during the wizard hatch flow, reject the hatch if the call fails, show a specific error to the user ("this key does not work — check for typos or generate a new one at aistudio.google.com").

Test path: hatch with a known-bad key, confirm rejection. Hatch with a real key, confirm pass.

---

### 3. Mine content pollution triage — CRITICAL, blocks paid customers

**Found during DAILY_CHECKS.md item 3 dry run at 2026-04-10 ~14:20 PDT.** The mine is functioning (8,051 facts, 388 in the last 24h, `healthy: true`) but the data is NOT usable for Strike draft generation, especially for the Network Marketer flavor that is being tested live.

**Finding 1 — self-referential pollution.** Two of the 5 highest-confidence (conf=100) Network Marketer facts are about the operator's own sunset product, OpenClaw Mastered. The research agent scraped old sales copy and ingested it as prospect intelligence. The mine is training on itself.
- Row `67cb7c2a` (conf 100): *"OpenClaw Mastered has a server fee of $15 per month after a 14-day free trial period, in addition to the initial $27 cost."*
- Row `07d6e010` (conf 100): *"The front-end offer for OpenClaw Mastered is priced at $27."*

**Finding 2 — classifier drift.** The research agent is classifying completely off-topic content as Network Marketer signal:
- Row `3c6a9bf5` (conf 100): *"The individual expects to pay between $950 and $1500 per month for housing."* (student budget Reddit thread)
- Row `fa29d39a` (conf 100): *"The salary range for the Senior Specialty Solutions Engineer – Network position is $175,000 – $275,000 annually."* (job listing — the literal word "Network" triggered classification)
- Row `25d1fa74` (conf 98): *"The individual reports having $50,200 in savings and is almost 21 years old."*

Only the lower-confidence rows (`4f46bf3e`, `23ed60d0` — both about "side hustles with low startup costs") are actually on-topic. Lawyer flavor looks better but still has noise (row `f7c386ce`: *"Juniper wants to meet Apollo to discuss something important"* — scraped from unrelated text).

**Finding 3 — `DAILY_CHECKS.md` schema error.** There is no `verbatim` column on `market_intelligence`. The real column is `fact_summary`, and every row is LLM paraphrase in third person ("The individual…", "The user…"), not real user quotes. The mine does not store prospect language verbatim anywhere. (Corrected in the same PR that added this item.)

**Why this is a paid-customer blocker.** Voice examples (item 1 above) only affect the system prompt at turn time. They do not affect the Strike draft pipeline, which reads `market_intelligence` directly. If you hatch a Network Marketer bot and Strike draft generation cites "expects $950–$1500/month housing" or "OpenClaw Mastered has a $15/mo server fee" to a prospect, the draft is garbage and the prospect sees it. A paid customer would churn.

**Triage plan (tomorrow):**
1. **Targeted DELETE of self-referential rows.** Find every row where `fact_summary ILIKE '%OpenClaw%' OR fact_summary ILIKE '%Tiger Claw%' OR fact_summary ILIKE '%BotCraft%'`. Count, back up (`CREATE TABLE ... AS SELECT`), then DELETE. This is reversible from the backup if the filter is too aggressive.
2. **Research agent classifier audit.** Find the research agent code (`api/src/services/orchestrator.ts` or similar — trace from `captured_by='research-agent'`). Read the prompt/logic that assigns a `domain` to each extracted fact. Understand how a $175K tech salary ended up tagged as "Network Marketer".
3. **Source URL audit.** `source_url` is a column — query `SELECT source_url, COUNT(*) FROM market_intelligence WHERE domain='Network Marketer' GROUP BY source_url ORDER BY COUNT(*) DESC LIMIT 20;`. If the top sources are irrelevant domains (job boards, student forums, your own sales pages), build a blocklist.
4. **Decision point:** after the audit, decide whether the mine needs a domain/source allowlist, tighter classifier prompts, or a full re-extraction. Do not fix until Brent has reviewed the audit findings.

**Dependency:** this triage blocks trust in Strike drafts for any flavor. Voice examples (item 1) can still ship today because voice lives in the system prompt and is independent of the mine.

---

### 3b. Verify the mine has a dedicated Gemini key

Suspected during the late-night diagnosis but not confirmed. Trace the mine's intelligence path: when `marketIntelligenceWorker` or `factExtractionWorker` runs, which Gemini key does it use? Is it (a) a dedicated mine key, (b) a platform fallback key, or (c) the first tenant's key it finds?

If the mine is borrowing a tenant's key, that's a billing leak and a silent failure risk (if that tenant's key dies, the mine dies with it).

Report findings. Do not fix until Brent has decided the architecture.

---

### 4. Verify admin hatch + all callers use new field names

PR #281 renamed `icpBuilder` → `icpProspect` and `icpCustomer` → `icpProduct` at 19:06 PDT on 2026-04-09. The admin hatch route `fdfc803` was still sending the OLD field names at 18:12 PDT — and continued to run at 19:41 PDT (18 minutes after the rename merged), which is how the lobotomy was created.

**Audit required:** grep the codebase for `icpBuilder` and `icpCustomer`. Every hit that is not in a migration file, archived doc, or test fixture should be fixed. Verify the admin hatch client (wherever it lives — dashboard, Claude Code session, a script) is sending the new field names.

---

### 5. Integrate Stripe — replace Paddle

**Decision (2026-04-11):** Paddle is dropped. Payment provider is Stripe.

What exists today: a Paddle webhook handler (`POST /webhooks/paddle`) and Paddle-specific subscription creation logic. None of it is re-usable — Stripe's event model is different.

**Build:**
1. Create Stripe product + price in the Stripe dashboard.
2. Replace `POST /webhooks/paddle` with `POST /webhooks/stripe` — handle `checkout.session.completed` (or `payment_intent.succeeded` depending on Stripe Checkout vs Payment Links flow). Create user + bot + subscription on success. Verify Stripe webhook signature.
3. Replace Paddle checkout URL generation with a Stripe Checkout Session or Payment Link.
4. Test the full flow end to end:

```
Checkout → Stripe fires checkout.session.completed → POST /webhooks/stripe → user + bot + subscription created → Wizard hatch → bot live
```

This is the entire business model. It has never been tested end to end. Cannot take a paying customer without this.

---

### 6. Admin dashboard — expand dependency monitoring + delete dead pool code

Two related problems, one PR.

**Problem A: there is no dependency health endpoint on the backend at all.** `GET /admin/pipeline/health` at `api/src/routes/admin.ts:906` looks like it should be one based on its name, but it is actually a **mine statistics** endpoint — it returns `totalFacts`, `factsLast24h`, `byVertical`, `byRegion`, `byCapturedBy`, and a single `healthy` boolean computed from "did any facts land in the last 24h AND newest fact within 48h". It does NOT check Serper, Gemini platform keys, Resend, Oxylabs, Postgres connectivity (beyond the query implicitly needing the DB), Redis, any BullMQ worker, Telegram webhook delivery, Paddle webhook, or OpenRouter. The dashboard UI (`web-onboarding/src/app/admin/dashboard/page.tsx`) does not call it either. Either build a new `GET /admin/dependencies/health` endpoint for the real dependency checks, or expand `/admin/pipeline/health` to add them alongside the mine stats (recommended — one endpoint, loud response, easy to consume).

**Problem B: zombie pool code.** ✅ **Shipped as PR #294 on 2026-04-10** — `PoolHealth` type, pool state, `/admin/pool/health` fetch, pool alarms, `poolStatusColor`/`poolStatusBg`, Bot Pool stats card, and the Pool action hint block all removed from `web-onboarding/src/app/admin/dashboard/page.tsx`. The dashboard no longer 404s. This section is kept for historical context; only Problem A and the expansion steps below are still pending.

**Build (A only, B is done):**
1. ~~Delete pool code from the dashboard component.~~ (Done — PR #294)
2. **Expand** `GET /admin/pipeline/health` (or build a new `/admin/dependencies/health`) to check: Postgres connectivity, Redis ping, each BullMQ worker in `api/src/workers/` (alive + recent heartbeat), Telegram webhook delivery (registered count vs active tenants), Serper×3 keys (the ones currently NOT checked anywhere), Gemini platform keys (platform + onboarding + emergency — NOT checked anywhere), Resend email (NOT checked anywhere), **Oxylabs** credentials + a test request, Stripe webhook (timestamp of last event received), OpenRouter circuit breaker state.
3. **Wire** the dashboard to call the dependency health endpoint (and separately render the mine stats from `/admin/pipeline/health`'s existing payload).
4. **Render** each dependency as a green/red row. Red surfaces as a loud alarm at the top of the dashboard. Never silently absent.

**Acceptance:** open the admin dashboard, every dependency from `/admin/pipeline/health` is visible, Oxylabs is on the list, no pool references anywhere in the dashboard component, no 404s in the browser network tab. `DAILY_CHECKS.md` item 1 becomes fully runnable from the dashboard.

---

### 7. Admin dashboard — mine health panel

Add a mine status card to the admin dashboard surfacing:
- Last run timestamp + duration
- Last run fact count
- Last 5 verbatims (read-only, for sanity check — is the data usable?)
- Worker error count since midnight (`factExtractionWorker`, `marketIntelligenceWorker`)
- Mine Gemini key identifier (dependent on item 3 above tracing the key first)

**Acceptance:** `DAILY_CHECKS.md` item 3 becomes fully runnable from the dashboard without manual `psql` queries.

---

## Strategic Review — Pending Decision

### Flavors strategy

The current flavor system (`api/src/config/flavors/`, 16 registered flavors, flavor-aware system prompts + ICP defaults + market-intelligence domain key mapping + wizard selector) may have become a distraction from the core product. It adds complexity to every code path that reads flavor-specific state: provisioner, system prompt builder, mine domain key, wizard flavor selector, tests, onboarding, voice examples.

**Decision needed:** reduce, postpone to v2+, or keep as-is. This is a think session, not a build task. Do not write code until the decision is made and documented in `SOTU.md`.

**Options:**
- **Keep all 16.** Current state. Cognitive load and test surface stays high.
- **Reduce to 1–3 core flavors.** Start with `network-marketer` only (the flavor being tested live right now) plus 1–2 others that have proven demand. Archive the rest.
- **Postpone flavors entirely to v2.** Collapse all flavors into a single configurable AI sales agent where the operator supplies ICP directly. Eliminates the flavor abstraction for v1.

**Sooner than later.** This blocks further flavor-specific work (voice examples per flavor, admin hatch defaults, mine domain keys) and may retroactively simplify several open items if reduced or postponed.

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

## Session Close Protocol

When this session ends:
1. Update `SOTU.md` with what actually shipped. Not what was planned.
2. Update `CLAUDE.md` Session State block — First Priority must reflect the NEXT work, not already-done work.
3. Update `STATE_OF_THE_TIGER_PATH_FORWARD.md`.
4. Update `NEXT_SESSION.md` with the real priorities for the session after this one.
5. Verify every merged PR with `gh pr view <number>` showing MERGED.
6. Verify deploy with `curl https://api.tigerclaw.io/health` returning 200.
7. No session is CLOSED until all four documents are in sync with each other and with git.
