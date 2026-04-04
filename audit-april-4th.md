# Tiger Claw v4 — Full Reliability & Security Audit
**Date:** 2026-04-04 (Session 9 — Audit Session, no PRs merged)
**Auditor:** Claude Code with 5 parallel sub-agents across 5 domains
**Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
**Commit audited:** `bdccf43`
**Test suite at audit:** 455 tests, all passing

---

## How to Use This Document

This document is a complete record of the April 4th 2026 audit. It is written for AI agents reading it in a future session. If you are starting a new session, do the following:

1. Read SOTU.md first (always)
2. Read this file to understand the full audit backlog
3. Check the Phase 1 table — if any of those items are still unresolved, they are the highest priority before any other work
4. When a fix from this document is shipped and merged, update the status column in the relevant table from `OPEN` to `FIXED — PR #NNN`

Do not rework items already marked `FIXED`. Do not add features while Phase 1 items remain `OPEN`.

---

## Audit Scope

Five domains were audited in parallel:

| Domain | Files Examined |
|--------|---------------|
| AI Agent Loop & Tool Registry | `ai.ts`, `geminiGateway.ts`, `tiger_*.ts` (all 25 tools) |
| Provisioning Pipeline & BullMQ Queues | `provisioner.ts`, `queue.ts`, `wizard.ts`, migrations 001–022 |
| Database & Schema | `db.ts`, `subscriptions.ts`, `migrate.ts`, all 22 migrations |
| Security, Auth & Secrets | `auth.ts`, `admin.ts`, `webhooks.ts`, `keys.ts`, `secrets.ts`, `index.ts` |
| Market Mining, Serper & Scout | `market_miner.ts`, `market_intel.ts`, `tiger_scout.ts`, `reddit_scout.mjs`, `mining.ts` |

---

## Summary Counts

| Severity | Count |
|----------|-------|
| HIGH | 26 |
| MED | 22 |
| LOW | 9 |
| **Total** | **57** |

---

## PHASE 1 — Emergency (Fix Before Next Customer)

These must be resolved before any new customer onboards. Several are actively broken in production today.

| ID | Status | Severity | Issue | File | Fix |
|----|--------|----------|-------|------|-----|
| P1-1 | FIXED — PR #189 | HIGH | `bot_ai_keys.bot_id` was never renamed to `tenant_id` — every call to `addAIKey()` fails. Multi-key rotation is completely dead. | `db.ts:~925`, migration 005 | Write `api/migrations/023_rename_bot_ai_keys_column.sql` with one line: `ALTER TABLE bot_ai_keys RENAME COLUMN bot_id TO tenant_id;` |
| P1-2 | FIXED — PR #196 | HIGH | `activateSubscription` fires at `wizard.ts:L227` before `provisionQueue.add()` at `L276`. Redis failure between those lines = active subscription, no job ever queued, no recovery. | `wizard.ts:L227, L276` | Move `activateSubscription` inside `provisioner.ts` as the first step. Route only validates + enqueues. |
| P1-3 | FIXED — PR #193 | HIGH | `stan-store-onboarding` worker has zero retries despite comment claiming 5. First transient DB failure = permanent customer loss. | `queue.ts:~617` | Add `defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 10000 }, removeOnFail: false }` to `onboardingQueue` definition. |
| P1-4 | FIXED — PR #195 | HIGH | No Serper key rotation. `market_miner.ts` selects one key at startup. On 429, silently returns empty results. `SERPER_KEY_3` is never used in `market_miner.ts`. No call cap per run. | `market_miner.ts:43, 47` | Create `api/src/services/serper.ts` with a rotating key array across all 3 keys, 429-triggered rotation, and a per-run call cap of 50. Import this in both `market_miner.ts` and `tiger_scout.ts`. |
| P1-5 | FIXED — PR #195 | HIGH | `reddit_scout.mjs` (cluster node script) has zero Serper fallback. Reddit 403 on that path = total silence, zero leads. | `api/scripts/reddit_scout.mjs` | Add `fetchSerper(query)` function using same Serper key rotation from P1-4. Wrap every `fetchReddit(query)` call: `const posts = await fetchReddit(q) || await fetchSerper(q)`. |
| P1-6 | FIXED — PR #194 | HIGH | After the Gemini tool loop, if `accumulatedText` is empty, user receives complete silence. Only a `console.warn` fires. | `ai.ts` post-loop block | Add after the while loop: `if (!accumulatedText.trim()) { accumulatedText = "I ran into an issue — please try again."; void logAdminAlert('ai_empty_reply', { tenantId }); }` |
| P1-7 | FIXED — PR #191 | HIGH | Telegram webhook validation is skipped entirely when `TELEGRAM_WEBHOOK_SECRET` env var is absent — `console.warn` only. Any attacker can inject arbitrary Telegram payloads to any tenant. | `webhooks.ts:~223` | Change `else` branch to `return res.status(503).json({ error: 'Webhook validation not configured' })`. Add startup check in `index.ts`: `if (!process.env.TELEGRAM_WEBHOOK_SECRET) throw new Error(...)`. NOTE: SOTU says this was fixed in PR #175, but the code still has the conditional check — verify live behavior. |
| P1-8 | FIXED — PR #192 | HIGH | `verify-purchase` creates a full user account and issues a valid pro-tier session token for any submitted email. No purchase proof required. Also no rate limiting. | `auth.ts:L57-79` | (A) Add rate limiter (10 req/IP/min). (B) The "no purchase found" branch must return 403, not create an account. Only the Stan Store webhook should create purchase records. |
| P1-9 | FIXED — PR #190 | HIGH | `ADMIN_TOKEN` is in the `getSessionSecret()` fallback chain. If `WIZARD_SESSION_SECRET` is missing from GCP, user sessions are signed with the admin token. | `auth.ts:L18` | Remove `ADMIN_TOKEN` from `getSessionSecret()`. Throw in production if `WIZARD_SESSION_SECRET` is unset. Never allow cross-contamination between session signing and admin auth. |
| P1-10 | FIXED — PR #194 | HIGH | `fc.args` from Gemini is passed directly to `tool.execute()` with no null check or type guard. Malformed args cause silent retry loops that exhaust the tool call budget. | `ai.ts:~L957` | Add before dispatch: `if (!fc.args \|\| typeof fc.args !== 'object') { toolResult = { error: 'Invalid arguments from model' }; }` |

---

## PHASE 2 — This Sprint

High severity issues that don't immediately break production but will cause failures under load or adverse conditions.

| ID | Status | Severity | Issue | File | Fix |
|----|--------|----------|-------|------|-----|
| P2-1 | FIXED — PR #199 | HIGH | `createBYOKBot` inserts tenant row then creates schema in separate operations with no transaction. Failed schema = permanent ghost tenant. | `db.ts:~748` | Wrap in `withClient` transaction. Refactor `createTenantSchema` to accept an existing client. Rollback the tenant insert if schema creation fails. |
| P2-2 | FIXED — PR #196 | HIGH | No `jobId` on `provisionQueue.add()`. Zapier retry or double-submit fires two provisioning jobs for the same tenant. | `wizard.ts:L276` | Add `jobId: \`provision-${botId}\`` to the add options. BullMQ rejects duplicate jobIds. |
| P2-3 | FIXED — PR #197 | HIGH | No `stalledInterval` or `maxStalledCount` on any worker. Redis crash during active job = silent loss after BullMQ default 1 re-queue. | `queue.ts` all workers | Add `stalledInterval: 30000, maxStalledCount: 3, lockDuration: 60000` to every `new Worker(...)` options object. |
| P2-4 | FIXED — PR #201 | HIGH | Provisioner executes tenant create and status transition (`updateTenantStatus`) as separate DB operations. Crash between them leaves tenant stuck in `pending` with no alert. | `provisioner.ts:~100-220` | Wrap tenant upsert + status update in a single `withClient` block. Add `updateTenantStatus(tenantId, 'error')` in the terminal-failure catch path. Add `/admin/fleet/stuck` endpoint querying `WHERE status = 'pending' AND created_at < NOW() - INTERVAL '10 minutes'`. |
| P2-5 | FIXED — PR #200 | HIGH | Auth failures (401) during live Gemini API calls do not trigger key rotation. Dead BYOK key loops forever on every user message with no recovery. | `ai.ts` outer catch | On `classifyAIError(err) === 'key'`, call tiger_keys to mark key as invalid, then re-run `resolveAIProvider` and retry once with the next layer. |
| P2-6 | FIXED — PR #197 | HIGH | `removeOnFail: true` on most job-level adds. Failed provisioning-adjacent jobs (fact-extraction, ai-routines) vanish from Redis with zero audit trail. | `queue.ts:~205, 255, 431, 438` | Change `removeOnFail: true` to `removeOnFail: { count: 100 }` for provisioning-adjacent queues. Keep `true` only for high-volume per-message queues (telegram, line webhooks). |
| P2-7 | FIXED — PR #199 | HIGH | Migration 005 has FK reference to `bots(id)` but no migration creates a `bots` table. This FK is a phantom reference. | `005_multi_key_and_crm.sql:7` | Investigate whether `bots` table exists in production. If not, this FK silently failed and the column has no referential integrity. Write migration 024 to either create the proper FK or drop and replace it pointing to `tenants(id)`. |
| P2-8 | FIXED — PR #200 | HIGH | `tiger_postiz.ts` exports a complete tool but is not in `toolsMap`. If Gemini has ever seen a function declaration for it, every tool call attempt will error and retry silently. | `ai.ts` toolsMap, `tiger_postiz.ts` | Decision: if permanently removed, `git rm api/src/tools/tiger_postiz.ts`. If coming back later, add a comment but do not export the class until it is registered. |
| P2-9 | FIXED — PR #199 | MED | No `statement_timeout` on DB pools. Runaway query holds a connection indefinitely and can starve the pool under load. | `db.ts:~25` | Add `statement_timeout: 30000, query_timeout: 35000` to both pool configs. |
| P2-10 | FIXED — PR #197 | HIGH | `email-support` and `market-intelligence-batch` workers log failures but never fire admin alerts. Complete silent failure modes. | `queue.ts` | Add `void logAdminAlert(...)` calls to the `failed` event handlers for both workers. |
| P2-11 | FIXED — PR #200 | MED | Email subject + body injected unsanitized into Gemini prompt in `processEmailSupportMessage`. Live prompt injection surface. | `ai.ts` `processEmailSupportMessage` | Wrap user content in XML-delimited block with untrusted-input instruction. Truncate subject to 500 chars, body to 2000 chars. Strip `<>` characters. |
| P2-12 | FIXED — PR #198 | MED | `/keys/validate` is unauthenticated. Anyone can test arbitrary Gemini API keys for validity. Key material passed as query param (logged by Google). | `keys.ts:14` | Add `requireWizardSession` middleware. Move key from query string to POST body. Use `x-goog-api-key` header when calling Google, not query param. |
| P2-13 | FIXED — PR #198 | MED | Admin token compared with `===` not `timingSafeEqual`. Timing oracle. | `admin_shared.ts` | Replace with `timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))`. Add startup check: refuse to start if `ADMIN_TOKEN` is shorter than 32 characters. |
| P2-14 | FIXED — PR #198 | MED | `origin: true` CORS reflects all origins globally, including `/admin/*` routes. | `index.ts` | Apply stricter `cors({ origin: ['https://wizard.tigerclaw.io'] })` to `/admin` router specifically. Keep global `origin: true` for public routes. |
| P2-15 | OPEN | MED | Telegram and LINE webhook workers have zero retries. Transient Gemini 429 permanently drops a user message. | `queue.ts` telegramWorker, lineWorker | Add `attempts: 3, backoff: { type: 'exponential', delay: 2000 }` to every `telegramQueue.add()` and `lineQueue.add()` call. |
| P2-16 | FIXED — PR #201 | HIGH | Cloud SQL proxy down = hard 500s on all routes with no readiness signal to Cloud Run. | `index.ts`, `db.ts` | (A) Add retry loop (5x exponential backoff) around `runMigrations()` at startup. (B) Add `/health` route that `SELECT 1`s the DB and returns 503 if it fails. (C) Configure Cloud Run readiness probe to hit `/health`. |
| P2-17 | FIXED — PR #197 | MED | `bots.status` set to `'error'` on every retry attempt, not only on terminal failure. Bot shows broken in fleet while retries are still in progress. | `queue.ts:~120` | Move `UPDATE tenants SET status = 'error'` from the per-attempt catch to the `failed` event handler (terminal only). |
| P2-18 | FIXED — PR #201 | MED | Bot pool orphan: hard-deleted tenant leaves `bot_pool` entry in `status='assigned', tenant_id=NULL` forever. Never returns to pool. | `db.ts` assignBotToken flow | Add recovery query: `UPDATE bot_pool SET status='available', tenant_id=NULL WHERE status='assigned' AND tenant_id IS NULL`. Run at startup and expose via `/admin/fix-pool-orphans`. |

---

## PHASE 3 — Maintenance & Hardening

Medium and low severity. Address during regular sprint work over the next 2–4 weeks.

| ID | Status | Severity | Issue | File | Fix |
|----|--------|----------|-------|------|-----|
| P3-1 | FIXED — PR #202 | MED | Missing DB indexes on `subscriptions(user_id)`, `subscriptions(tenant_id)`, full `tenant_states(tenant_id, state_key)`, `tenant_leads(opted_out)`. | migration 001, 016 | Write `api/migrations/024_add_missing_indexes.sql` with all four index creates using `IF NOT EXISTS`. |
| P3-2 | FIXED — PR #204 | HIGH | Per-tenant PostgreSQL schema (`t_{tenantId}`) is never dropped on tenant termination or deletion. Accumulates permanently. | `db.ts` createTenantSchema | Write `dropTenantSchema(tenantId)` that validates UUID format, then `DROP SCHEMA IF EXISTS "t_..." CASCADE`. Call from admin delete route. |
| P3-3 | SKIPPED | MED | Hard-delete cascades the subscription row but does not cancel the Stripe/Stan Store subscription record. Customer keeps billing record active. | `admin.ts` tenant delete route | Requires Stan Store API docs — deferred. Manual process for now. |
| P3-4 | FIXED — PR #204 | MED | Serper URL variance (tracking params, redirects) produces duplicate market intelligence facts. `isAlreadyMined()` is exact-match on `source_url`. | `market_intel.ts:54` | Add `normalizeUrl(url)` that strips query params, hash, and trailing slash before the dedup check. |
| P3-5 | FIXED — PR #204 | MED | `SCORE_THRESHOLD = 80` hardcoded globally. Not configurable per flavor or per tenant. | `tiger_scout.ts:38` | Add `scoreThreshold?: number` to flavor config schema. Use `flavor?.scoreThreshold ?? 80` in the scout. |
| P3-6 | FIXED — PR #202 | MED | No "run started / run completed" audit record. Cannot detect incomplete mining runs from the database. | `queue.ts:~592` | Add `logAdminEvent('mine_started', { runId })` before `runMarketMining()` and `logAdminEvent('mine_complete', { runId, ...result })` after. Catch and log `mine_failed` on throw. |
| P3-7 | OPEN | MED | Burst enforcement stored in per-tenant file state (`scout_state.json`). TOCTOU race on multi-instance Cloud Run: two concurrent reads can both allow a scan. | `tiger_scout.ts:~530` | Replace file-based burst count with an atomic `INSERT ... ON CONFLICT DO UPDATE` increment in `tenant_states` table. Check returned count against limit. |
| P3-8 | FIXED — PR #204 | MED | `/mining/refine` route has no authentication. Bypasses all burst enforcement with a direct API call. | `mining.ts` | Added `requireAdmin` middleware to the route. |
| P3-9 | FIXED — PR #203 | MED | Operator onboarding fields (`botName`, ICP, identity) interpolated unsanitized into the Gemini system prompt. Compromised operator account = prompt injection. | `ai.ts` `buildSystemPrompt` | Add `sanitizePromptField(value, maxLen)` utility. Apply to `botName` (80 chars), `productOrOpportunity` (300 chars), ICP fields (300 chars each). Strip control characters. |
| P3-10 | FIXED — PR #203 | MED | `tiger_refine` interpolates caller-controlled `domain` and `extractionGoal` into Gemini prompt without sanitization. | `tiger_refine.ts` | Apply same `sanitizePromptField` (200 chars max each). |
| P3-11 | SKIPPED — acceptable risk | MED | `/admin/pool/tokens` returns plaintext bot tokens in HTTP response body, likely captured in Cloud Run access logs. | `admin.ts` | This is an intentional admin operation — acceptable. Mitigate by ensuring Cloud Run log redaction is configured, and document that this endpoint should never be called from browser-side code. |
| P3-12 | FIXED — PR #202 | MED | Raw Zapier payload (full body) logged verbatim on every Stan Store webhook — potential PII/payment data in Cloud Run logs. | `webhooks.ts` stan-store handler | Replace `console.log('[stan-store-webhook] Raw Zapier payload:', JSON.stringify(body))` with a redacted version logging only `body.email?.slice(0,3)***` and event type. |
| P3-13 | FIXED — PR #202 | LOW | `createTenantSchema` interpolates `tenantId` into SQL without a UUID format assertion. Currently safe (tenantId always comes from `gen_random_uuid()`), but fragile if call sites change. | `db.ts:~189` | Add `if (!/^[0-9a-f-]{36}$/.test(tenantId)) throw new Error(...)` before the interpolation. |
| P3-14 | FIXED — PR #202 | LOW | `findOrCreateBYOKBot` queries and inserts into a `bots` table that does not exist in the current schema. Dead code, landmine. | `db.ts:~764` | Delete the function. Search for callers and replace with `createBYOKBot`. |
| P3-15 | FIXED — PR #202 | LOW | `botToken` field in `HatchSchema` accepts any string. Invalid tokens waste all 5 provisioning retry attempts before failing. | `wizard.ts` HatchSchema | Add Zod regex: `.regex(/^\d+:[A-Za-z0-9_-]{35,}$/, 'Invalid Telegram bot token format')` to the optional `botToken` field. |
| P3-16 | FIXED — PR #202 | LOW | Migration 002 silently swallows all rename errors via bare `EXCEPTION` clause. Unexpected errors (FK violations, etc.) disappear. | `002_unify_tenants.sql` | Add `WHEN OTHERS THEN RAISE;` to each `EXCEPTION` block so only `undefined_column` errors are swallowed. |
| P3-17 | FIXED — PR #202 | LOW | All secret names logged to stdout at startup via `console.log('[secrets] Loaded secret "DATABASE_URL"...')`. Exposes secret inventory to log readers. | `secrets.ts` | Replace with a single `console.log('[secrets] Loaded N secrets from Secret Manager.')` after all secrets are loaded. |
| P3-18 | FIXED — PR #202 | LOW | `callGemini` has an unreachable `throw new Error('unreachable')` after the for-loop. Dead code, retry intent is ambiguous in the comments. | `geminiGateway.ts` | Remove the dead throw. Clarify comment to say "4 attempts (0-3), throws on attempt 3 or if error is not rate-type". |
| P3-19 | FIXED — PR #202 | LOW | Migration filename convention uses `005` and `005a` at the same sequence position. Sorting is lexicographic and fragile. Any future `005b` could disrupt ordering. | `api/migrations/` | Document the convention in a `api/migrations/README.md`. For all future migrations, use zero-padded sequential integers only (no letter suffixes). |

---

## Context: What Was NOT Broken (Confirmed Working)

Items the audit confirmed are implemented correctly — do not change these:

- **Gemini retry backoff** (`geminiGateway.ts`): 4 attempts, exponential backoff with jitter, capped at 15s. Correct.
- **Auth error handling** in `callGemini`: throws immediately on 401 (no wasted retries on bad keys). Correct.
- **LINE webhook HMAC validation**: Properly implemented with `crypto.timingSafeEqual` equivalent. Correct.
- **`withClient` connection management**: `finally` block always releases. No leak under normal operation. Correct.
- **`buildSystemPrompt()` async safety**: All three call sites properly `await` it. No sync callers. Correct.
- **Provisioner webhook registration idempotency**: `setWebhook` overwrites cleanly. Correct.
- **`activateSubscription` idempotency**: `WHERE status = 'pending_setup'` prevents double-activation. Correct.
- **Bot pool assignment locking**: `SELECT FOR UPDATE SKIP LOCKED` in `assignBotToken`. Correct.
- **Migration runner per-file transactions**: Each migration runs in `BEGIN/COMMIT/ROLLBACK`. Correct.
- **`TELEGRAM_WEBHOOK_SECRET` in deploy script**: Confirmed wired since PR #175. The code still has a conditional check (P1-7) but the env var is present in production.
- **Global error handler** (`index.ts`): Returns `{ error: "internal_server_error" }` only — no stack traces leak to clients. Correct.

---

## Highest-Risk Compound Failure Chains

### Chain A — Silent Serper Quota Drain
**Scenario:** Cloud Run's IP gets Reddit-blocked (already happening). All queries fall to Serper. No key rotation. No call cap. `reddit_scout.mjs` has no fallback. All three paths hit the same key with no ceiling.
**Result:** Monthly Serper quota drained in hours. Zero leads. No alert. No operator awareness.
**Fixes required:** P1-4 + P1-5 together.

### Chain B — Provisioning Orphan
**Scenario:** `activateSubscription` succeeds. Redis has a blip. `provisionQueue.add()` throws. Subscription is marked `active`. No job is ever enqueued. Tenant has no bot.
**Result:** Paying customer with active subscription and no service. No recovery path. No alert.
**Fixes required:** P1-2 + P1-3 + P2-2 together.

### Chain C — Multi-Key Rotation Illusion
**Scenario:** BYOK customer's primary Gemini key is revoked. System appears to have 4-layer fallback. In reality `addAIKey()` has never worked (P1-1) and auth errors don't trigger rotation (P2-5).
**Result:** Every message from that tenant returns an auth error. Customer thinks platform is broken. No auto-recovery.
**Fixes required:** P1-1 + P2-5 together.

---

## Recommended Fix Order (Minimum Viable Safe State)

If you can only ship one PR before the next customer, ship these in order:
1. P1-1 (one SQL line — migration 023)
2. P1-3 (add retry options to onboarding queue)
3. P1-7 (Telegram webhook startup check)
4. P1-9 (remove ADMIN_TOKEN from session signing)
5. P1-8A (rate limit verify-purchase)

These five changes together close the most dangerous open holes in under an hour of work.

---

## Session Context

This audit was run in Session 9 (April 4th, 2026) after Session 8 shipped PRs #186–#187. No code was changed in this session. This document is the entire output. The next session should begin by picking up Phase 1 items.

**The platform is green and serving real tenants.** Existing tenants are not actively impacted by most of these issues today. The risk materializes when:
- The next paying customer onboards (P1-2, P1-3, P1-8)
- A tenant's BYOK Gemini key expires (P1-1, P2-5)
- Cloud Run's Reddit 403 hits on a mining day (P1-4, P1-5)
- Any admin accidentally omits a GCP secret (P1-7, P1-9)
