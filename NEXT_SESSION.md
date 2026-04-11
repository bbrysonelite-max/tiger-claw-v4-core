# Next Session Priorities

**Read SOTU.md first. Then this file. Then run `DAILY_CHECKS.md` before any other work. No exceptions.**

**No lying. No assuming. No guessing. Do not claim anything works until tested live.**

**This file is deletion-only. Closed items are removed, not marked ✅. If you finish an item, delete it from this file in the same PR that closed it.**

---

## Context — Where We Are

Session 20 closed with ground truth fully reconciled, a new revenue contract on the table, and the 6→4 doc collapse shipped. PRs #292–#298 merged. State now lives only in `SOTU.md` and `NEXT_SESSION.md`.

**Two items are ready to execute immediately — do them before anything else:**

1. **SSDI Ticket to Work flavor build** — Pat Sullivan (co-founder of ACT! CRM, 1987) invested in the business. His client pays $20K/month for SSDI leads. Full spec is written and approved. Health-wellness flavor is the base. This is first paid revenue.
2. **Mine surgery** — 3 self-referential rows to delete, 1 bad scout query to remove, source blocklist to add. Do NOT run the mine until this is done or the next run will compound the pollution.

`brents-tiger-01-mns7wcqk` (Tiger Proof / Nu Skin) is still the only active bot. Cloud Run revision `tiger-claw-api-00456-9rb` is live and healthy.

---

## Do These In Order. Do Not Skip Ahead.

---

### 1. SSDI Ticket to Work flavor build — FIRST (revenue)

**Contract:** $20,000/month for SSDI Ticket to Work leads. Partner: Pat Sullivan (co-founder of ACT! CRM, 1987).

**Base flavor:** health-wellness (`api/src/config/flavors/health-wellness.ts`). Repurpose it — swap the guts, keep the wiring.

**What gets replaced entirely:**
- `displayName` → `"SSDI Ticket to Work"`
- `description`, `professionLabel`, `defaultKeywords`, `intentSignals`, `scoutQueries` → SSDI signals (see below)
- `soul` → warm, empathetic, hopeful guide. NOT a salesperson. Brings good news.
- `conversion` → single oar, goal = qualified lead capture
- `objectionBuckets` → SSDI-specific (fear of losing benefits, "I tried before", "I don't qualify")
- `onboarding` → qualification gates (4 yes/no gates) + lead data capture

**ICP (replace entirely):**
People who are disabled and DON'T KNOW about the SSA Ticket to Work program. Not current participants. People who need it and haven't heard of it.

Mine signals to hunt:
- "I want to work but I'll lose my benefits"
- Financial stress on fixed disability income
- Feeling stuck, wanting purpose or contribution
- Life transitions: newly disabled, recently stabilized, recovery milestones
- Posts in disability communities about employment fears
- "Is this all there is" energy

Subreddits: r/disability, r/SSDI, r/disabilitybenefits, r/ChronicIllness, r/mentalhealth, r/Anxiety, r/ChronicPain, r/careerguidance

**Knowledge base (wire into soul/system prompt):**
- Ticket to Work: free, voluntary SSA program, ages 18–64
- Work WITHOUT losing SSDI/SSI benefits
- Trial Work Period: earn any amount, keep full benefits
- Medicare continues 7+ years while working
- Benefits restart without new application if disability stops them working
- 11 million+ eligible, most have never engaged
- Helpline: 1-866-968-7842 | Website: choosework.ssa.gov

**Qualification gates (4 yes = qualified lead):**
1. Do they have a disability?
2. Currently receiving or likely qualify for SSDI/SSI?
3. Age 18–64?
4. Interested in exploring work?
Any no → educate, nurture, don't discard.

**Lead data capture:**
- Full name, phone, state of residence
- General disability category (physical, mental health, cognitive, sensory — no medical details)
- What kind of work interests them
- Biggest concern about working
- Channel source

**BYOK:** Brent is the operator — use his Gemini key. No architectural changes needed.

**After building:** hatch a test bot via admin hatch, send it a test message from a fresh chatId, verify it responds as an SSDI guide not a salesperson.

---

### 2. Mine surgery — fix before next mine run

**Do NOT run the mine until these three things are done.**

**A. Delete 3 self-referential rows:**
```sql
DELETE FROM market_intelligence
WHERE id IN (
  '67cb7c2a-...', -- OpenClaw Mastered $15/mo server fee (conf=100)
  '07d6e010-...', -- OpenClaw Mastered $27 front-end price (conf=100)
  '1550c182-...'  -- OpenClaw described as "Agentic AI" (conf=90)
);
```
Get full UUIDs first: `SELECT id, LEFT(fact_summary, 60) FROM market_intelligence WHERE fact_summary ILIKE '%OpenClaw%';`
Back up first: `CREATE TABLE market_intelligence_backup_20260411 AS SELECT * FROM market_intelligence WHERE fact_summary ILIKE '%OpenClaw%' OR fact_summary ILIKE '%Tiger Claw%';`

**B. Fix network-marketer.ts scout queries:**
Remove: `"subreddit:Entrepreneur OR subreddit:WorkFromHome network marketing direct sales home business"`
Replace with: `"subreddit:antiwork OR subreddit:jobs I need to find a way out tired of this job"`

**C. Add source blocklist to research_agent.ts:**
Before the `isAlreadyMined` check, skip URLs matching:
- `reddit.com/r/u_adam20141977`
- `reddit.com/r/u_softtechhubus`
- `reddit.com/r/LoyaltyDraw`
- `reddit.com/r/ValueInvesting`
- `reddit.com/r/TargetedSolutions`
- `reddit.com/r/cscareeradvice`

---

### 3. Research agent classifier audit — investigation, blocks trust in mine data

**Why this is separate from item 2 mine surgery:** item 2 deletes the 3 known self-referential rows, swaps 1 bad scout query, and adds a source blocklist. That handles the known pollution and tightens the input side. It does NOT explain why the classifier assigned `domain="Network Marketer"` at conf=100 to content that is obviously off-topic:

- Row `3c6a9bf5` (conf 100): *"The individual expects to pay between $950 and $1500 per month for housing."* (student budget thread)
- Row `fa29d39a` (conf 100): *"The salary range for the Senior Specialty Solutions Engineer – Network position is $175,000 – $275,000 annually."* (job listing — the literal word "Network" appears to have triggered classification)
- Row `25d1fa74` (conf 98): *"The individual reports having $50,200 in savings and is almost 21 years old."*

A loose scout query explains how off-topic content gets scraped. It does NOT explain conf=100 on a student housing budget or on a salary listing for a Network *Engineer*. The classifier itself is assigning domains incorrectly. If the classifier is broken, the next mine run will produce fresh pollution even after item 2's surgical fixes. **Item 2 is necessary but not sufficient. Do NOT run the mine until this audit closes.**

**Investigation (do not write fixes — read and report):**
1. Trace the research agent code from `captured_by='research-agent'` rows in `market_intelligence`. Likely lives in `api/src/services/orchestrator.ts` or an agent file in `api/src/services/`.
2. Find where `domain` is assigned to each extracted fact. Determine the mechanism:
   - (a) LLM-based classification prompt ("Is this fact about X domain?")
   - (b) Keyword matching against a list
   - (c) Domain inherited from the scout query that produced the fact, with no post-extraction content verification
3. For each of the 3 evidence rows above, trace **why** it got `domain="Network Marketer"`. Identify the specific prompt text, keyword list, or inheritance path responsible.
4. Report back with: file paths, mechanism (a/b/c), and the per-row trace. **Do not fix until Brent has reviewed.** The fix approach depends on the mechanism (tighter classifier prompt, content-verification pass after extraction, source allowlist, or re-extraction from scratch).

**Dependency:** item 2 mine surgery is execution-ready and can run independently of this audit. Item 3 is read-only investigation — no code changes. Both must close before the next mine run. Strike draft generation reads `market_intelligence` directly; if the classifier is broken, Strike drafts for any flavor will cite noise.

---

### 4. Voice examples for network-marketer flavor

The bot now responds intelligently. It does NOT yet respond in Brent's actual voice. The system prompt is still generic "helpful assistant" tone. This is prompt engineering, not architecture.

**Brent writes the examples in his own voice.** Claude Code wires them into the network-marketer flavor system prompt. Then re-test from a fresh chatId with "I'm tired of my job" and compare against the late-night baseline.

The examples should cover at minimum:
- Opening response to a transition-stage prospect (unhappy at current job)
- Qualifying question that surfaces network-marketing fit without sounding like a pitch
- Handling "tell me more about the product" without becoming a product brochure
- Soft close toward a Zoom call

Do not write code until Brent has provided the example text. This is a pair-programming task, not a solo task.

---

### 5. Verify the mine has a dedicated Gemini key

Suspected during the late-night diagnosis but not confirmed. Trace the mine's intelligence path: when `marketIntelligenceWorker` or `factExtractionWorker` runs, which Gemini key does it use? Is it (a) a dedicated mine key, (b) a platform fallback key, or (c) the first tenant's key it finds?

If the mine is borrowing a tenant's key, that's a billing leak and a silent failure risk (if that tenant's key dies, the mine dies with it).

Report findings. Do not fix until Brent has decided the architecture.

---

### 6. Verify admin hatch + all callers use new field names

PR #281 renamed `icpBuilder` → `icpProspect` and `icpCustomer` → `icpProduct` at 19:06 PDT on 2026-04-09. The admin hatch route `fdfc803` was still sending the OLD field names at 18:12 PDT — and continued to run at 19:41 PDT (18 minutes after the rename merged), which is how the lobotomy was created.

**Audit required:** grep the codebase for `icpBuilder` and `icpCustomer`. Every hit that is not in a migration file, archived doc, or test fixture should be fixed. Verify the admin hatch client (wherever it lives — dashboard, Claude Code session, a script) is sending the new field names.

---

### 7. Integrate Stripe — replace Paddle

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

### 8. Admin dashboard — build dependency health endpoint

**There is no dependency health endpoint on the backend at all.** `GET /admin/pipeline/health` at `api/src/routes/admin.ts:906` looks like it should be one based on its name, but it is actually a **mine statistics** endpoint — it returns `totalFacts`, `factsLast24h`, `byVertical`, `byRegion`, `byCapturedBy`, and a single `healthy` boolean computed from "did any facts land in the last 24h AND newest fact within 48h". It does NOT check Serper, Gemini platform keys, Resend, Oxylabs, Postgres connectivity (beyond the query implicitly needing the DB), Redis, any BullMQ worker, Telegram webhook delivery, Stripe webhook, or OpenRouter. The dashboard UI (`web-onboarding/src/app/admin/dashboard/page.tsx`) does not call it either.

Either build a new `GET /admin/dependencies/health` endpoint for the real dependency checks, or expand `/admin/pipeline/health` to add them alongside the mine stats (recommended — one endpoint, loud response, easy to consume).

**Build:**
1. **Expand** `GET /admin/pipeline/health` (or build a new `/admin/dependencies/health`) to check: Postgres connectivity, Redis ping, each BullMQ worker in `api/src/workers/` (alive + recent heartbeat), Telegram webhook delivery (registered count vs active tenants), Serper×3 keys (the ones currently NOT checked anywhere), Gemini platform keys (platform + onboarding + emergency — NOT checked anywhere), Resend email (NOT checked anywhere), **Oxylabs** credentials + a test request, Stripe webhook (timestamp of last event received), OpenRouter circuit breaker state.
2. **Wire** the dashboard to call the dependency health endpoint (and separately render the mine stats from `/admin/pipeline/health`'s existing payload).
3. **Render** each dependency as a green/red row. Red surfaces as a loud alarm at the top of the dashboard. Never silently absent.

**Acceptance:** open the admin dashboard, every dependency is visible, Oxylabs is on the list, no 404s in the browser network tab. `DAILY_CHECKS.md` item 1 becomes fully runnable from the dashboard.

---

### 9. Admin dashboard — mine health panel

Add a mine status card to the admin dashboard surfacing:
- Last run timestamp + duration
- Last run fact count
- Last 5 fact summaries (read-only, for sanity check — is the data usable?)
- Worker error count since midnight (`factExtractionWorker`, `marketIntelligenceWorker`)
- Mine Gemini key identifier (dependent on item 5 above tracing the key first)

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

## Session Close Protocol (4-doc model)

When this session ends:
1. Update `SOTU.md` with what actually shipped. Not what was planned.
2. **Delete** closed items from `NEXT_SESSION.md`. Do not mark ✅. Do not leave `ALREADY IN PLACE` annotations. Remove.
3. Verify every merged PR with `gh pr view <number>` showing MERGED.
4. Verify deploy with `curl https://api.tigerclaw.io/health` returning 200.
5. No session is CLOSED until SOTU and NEXT_SESSION are in sync with each other and with git.

**That's it. Two files. No `CLAUDE.md` session block update. No `PATH_FORWARD` update. No `START_HERE` update. Those files are either deleted, archived, or carry no state.**
