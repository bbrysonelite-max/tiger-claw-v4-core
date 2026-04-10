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

### 3. Verify the mine has a dedicated Gemini key

Suspected during the late-night diagnosis but not confirmed. Trace the mine's intelligence path: when `marketIntelligenceWorker` or `factExtractionWorker` runs, which Gemini key does it use? Is it (a) a dedicated mine key, (b) a platform fallback key, or (c) the first tenant's key it finds?

If the mine is borrowing a tenant's key, that's a billing leak and a silent failure risk (if that tenant's key dies, the mine dies with it).

Report findings. Do not fix until Brent has decided the architecture.

---

### 4. Verify admin hatch + all callers use new field names

PR #281 renamed `icpBuilder` → `icpProspect` and `icpCustomer` → `icpProduct` at 19:06 PDT on 2026-04-09. The admin hatch route `fdfc803` was still sending the OLD field names at 18:12 PDT — and continued to run at 19:41 PDT (18 minutes after the rename merged), which is how the lobotomy was created.

**Audit required:** grep the codebase for `icpBuilder` and `icpCustomer`. Every hit that is not in a migration file, archived doc, or test fixture should be fixed. Verify the admin hatch client (wherever it lives — dashboard, Claude Code session, a script) is sending the new field names.

---

### 5. Create Paddle product + price

No checkout URL exists. The Paddle webhook is live but there is nothing to purchase. Create the product and price in the Paddle dashboard. Then test the full flow end to end:

```
Checkout → Paddle fires transaction.completed → POST /webhooks/paddle → user + bot + subscription created → Wizard hatch → bot live
```

This is the entire business model. It has never been tested end to end. Cannot take a paying customer without this.

---

### 6. Admin dashboard — expand dependency monitoring + delete dead pool code

Two related problems, one PR.

**Problem A: almost no dependencies are surfaced on the admin dashboard.** The backend has a partial check at `GET /admin/pipeline/health` (`api/src/routes/admin.ts:906`) covering Serper×3, Gemini platform×3, and Resend. It does NOT cover Postgres, Redis, any BullMQ worker, Telegram webhook delivery, **Oxylabs** (added recently), Paddle webhook, or OpenRouter. The dashboard UI (`web-onboarding/src/app/admin/dashboard/page.tsx`) does not even call the endpoint that exists.

**Problem B: zombie pool code.** The dashboard still fetches `/admin/pool/health` on line 159 of the same file — PR #274 deleted that route. It 404s on every refresh. The `PoolHealth` type, `poolStatusColor()`, `poolStatusBg()`, and the pool branches of `computeAlarms()` are all dead code. This is a direct violation of the "NO BOT POOL. EVER." rule in `CLAUDE.md` — it should have been deleted in PR #274 and was missed.

**Build:**
1. **Delete** the `PoolHealth` type, all pool state, all pool alarms, the `/admin/pool/health` fetch, `poolStatusColor()`, and `poolStatusBg()` from the dashboard component.
2. **Expand** `GET /admin/pipeline/health` to also check: Postgres connectivity, Redis ping, each BullMQ worker in `api/src/workers/` (alive + recent heartbeat), Telegram webhook delivery (registered count vs active tenants), **Oxylabs** credentials + a test request, Paddle webhook (timestamp of last event received), OpenRouter circuit breaker state.
3. **Wire** the dashboard to call `/admin/pipeline/health` instead of `/admin/pool/health`.
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
