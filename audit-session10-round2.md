# Tiger Claw v4 — Round 2 Reliability & Security Audit
**Date:** 2026-04-04 (Session 10 — Post-deploy audit, 5 parallel sub-agents)
**Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
**Baseline:** PRs #189–#209 merged and deployed (revision 00328-n2v)
**Test suite:** 447 tests, all passing

---

## How to Use This Document

This is the second full audit of the Tiger Claw v4 codebase, run after the 57-item audit sprint from Session 9/10 (PRs #189–#209). It covers issues the first audit missed and regressions introduced during the sprint.

When starting a new session:
1. Read SOTU.md first (always)
2. Check this file for open items
3. Fix Phase 1 items before onboarding any new customers

---

## Audit Scope

Five domains were audited in parallel:

| Domain | Files Examined |
|--------|---------------|
| AI Agent Loop & Tools | `ai.ts`, `geminiGateway.ts`, all 25 tools |
| Provisioning & BullMQ | `provisioner.ts`, `queue.ts`, `wizard.ts`, `webhooks.ts`, `subscriptions.ts` |
| Database & Schema | `db.ts`, all 25 migrations, `migrate.ts` |
| Security, Auth & Routes | `auth.ts`, `admin_shared.ts`, `secrets.ts`, `dashboard.ts`, `tenants.ts`, all routes |
| Market Mining & Scout | `market_miner.ts`, `market_intel.ts`, `serper.ts`, `tiger_scout.ts`, `mining.ts` |

---

## Summary Counts

| Severity | Count |
|----------|-------|
| HIGH | 12 |
| MED | 17 |
| LOW | 9 |
| **Total** | **38** |

---

## PHASE 1 — Emergency (Fix Before Next Customer)

| ID | Status | Severity | Issue | File | Fix |
|----|--------|----------|-------|------|-----|
| R2-P1-1 | OPEN | HIGH | `GET /dashboard/:slug` has no authentication. Any caller knowing a tenant slug gets full tenant data: name, bot username, key health, key preview, recent leads with profile URLs, subscription status, channel config. Slugs are predictable (name + timestamp suffix). | `api/src/routes/dashboard.ts:22` | Add `requireSession` middleware. Verify the authenticated user's session matches the requested slug/tenantId. |
| R2-P1-2 | OPEN | HIGH | `POST /dashboard/:slug/update-key` has no authentication. Any caller can replace any tenant's Gemini API key with their own, hijacking the tenant's AI inference or silently breaking their bot. | `api/src/routes/dashboard.ts:161` | Add `requireSession` middleware. Verify ownership before allowing key update. Log all key changes to `admin_events`. |
| R2-P1-3 | OPEN | HIGH | `PATCH /tenants/:tenantId/status` has no authentication. Described as "internal" in comments but is exposed on the public Cloud Run URL. Any attacker can suspend, activate, or terminate any tenant's bot. | `api/src/routes/tenants.ts:37` | Add `requireAdmin` or `requireSession` + ownership check. The AI agent calls this internally — use a shared internal secret header (`X-Internal-Token`) validated against an env var, or restrict to loopback only. |
| R2-P1-4 | OPEN | HIGH | `POST /tenants/:tenantId/keys/activate` has no authentication. Any caller can deactivate the platform onboarding key for any tenant, forcing them off the platform key before they've added their own. | `api/src/routes/tenants.ts:102` | Same fix as R2-P1-3. Internal-only endpoint must be protected. |
| R2-P1-5 | OPEN | HIGH | `POST /tenants/:tenantId/scout` has no authentication. Any caller can trigger scout hunts for any tenant, flooding their lead pipeline with garbage data and exhausting their Serper quota. | `api/src/routes/tenants.ts:138` | Same fix as R2-P1-3. |
| R2-P1-6 | OPEN | HIGH | Stan Store Zapier webhook race condition: Two concurrent Zapier deliveries (Zapier retries on slow response) call `createBYOKSubscription()` with `stripeSubscriptionId: stan_store_zapier_${Date.now()}`. Within the same millisecond, both generate the same timestamp, hitting the UNIQUE constraint on `stripe_subscription_id` and crashing the second delivery. Customer ends up with one subscription record but Zapier logs an error, creating confusion. | `api/src/routes/webhooks.ts:520-525` | Add Redis idempotency check on `email + round(timestamp/60)` (1-minute window), same pattern as the Stripe dedup at lines 123–138. |
| R2-P1-7 | OPEN | HIGH | URL normalization mismatch in market intelligence moat: `isAlreadyMined()` normalizes the source URL before the dedup check, but `saveMarketFact()` stores the **raw, unnormalized** URL. Two requests with `?utm=a` and `?utm=b` both pass the dedup check and both get inserted, creating duplicate facts. The moat is already corrupted from production runs. | `api/src/services/market_intel.ts:77, 100` | Normalize the URL in `saveMarketFact()` before storage (or in `tiger_refine.ts` before calling it), so the stored URL always matches what `isAlreadyMined()` queries. |

---

## PHASE 2 — This Sprint

| ID | Status | Severity | Issue | File | Fix |
|----|--------|----------|-------|------|-----|
| R2-P2-1 | OPEN | HIGH | `serperKeyIndex` is a module-level variable and is never reset at the start of `runMarketMining()`. After a 429 cycle rotates through all 3 keys, `serperKeyIndex` stays at 3+ for the remainder of the run. All subsequent Serper calls in that run keep hitting the same exhausted key (via modulo), silently returning empty results. | `api/src/services/market_miner.ts` (serperKeyIndex initialization) | Reset `serperKeyIndex = 0` at the top of `runMarketMining()` alongside `serperCallsThisRun = 0`. |
| R2-P2-2 | OPEN | HIGH | Missing `created_at` index on `market_intelligence` table. `getMarketIntelligence()` filters `WHERE created_at >= NOW() - INTERVAL '7 days'` and orders by `created_at DESC` but there is no index on this column. As the table grows past thousands of rows (current: 459+ facts), this sequential scan will block the AI hot path on every bot turn. | `api/src/services/market_intel.ts:46-49` | Add `CREATE INDEX IF NOT EXISTS idx_market_intel_created_at ON market_intelligence(created_at DESC)` to `initMarketIntelSchema()`. |
| R2-P2-3 | OPEN | HIGH | `serperCallsThisRun` is a module-level global in `market_miner.ts`. If two mining jobs run concurrently (manual trigger + scheduled run), they share the counter. The first job resets it to 0, the second job sees 0 and uses all 50 calls, and the first job gets capped immediately. The 50-call-per-run safety cap is not enforced correctly under concurrency. | `api/src/services/market_miner.ts:19-20` | Move `serperCallsThisRun` inside `runMarketMining()` as a local variable. Pass it by reference through the Serper fetch helpers or use a closure. |
| R2-P2-4 | OPEN | MED | Wizard hatch returns 500 when a duplicate jobId is detected by BullMQ. The customer (or Zapier) sees "Failed to initiate hatch sequence" when their job was already successfully queued and is processing. This causes unnecessary retries and customer panic. | `api/src/routes/wizard.ts:268-285` | Catch the BullMQ "already exists" error specifically and return `200 { ok: true, message: "Hatch already in progress" }` instead of propagating it as a 500. |
| R2-P2-5 | OPEN | MED | Onboarding worker terminal failure alert fires on attempt 6, not attempt 5. The check `(job?.attemptsMade ?? 0) >= 5` triggers when `attemptsMade === 5`, but `attemptsMade` is incremented **after** each attempt. On the 5th (final) attempt, `attemptsMade` is 4. It only reaches 5 on a 6th attempt that never happens, meaning the alert never fires for `attempts: 5` jobs. | `api/src/services/queue.ts` (onboardingWorker failed handler) | Change the check to `(job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 1) - 1` to fire correctly on the last attempt. |
| R2-P2-6 | OPEN | MED | Postmark inbound email webhook (`POST /webhooks/email`) runs with **no authentication** when `POSTMARK_WEBHOOK_TOKEN` env var is absent. An attacker can POST arbitrary email payloads, injecting fake support requests into the email processing queue. The code logs a warning but continues processing. | `api/src/routes/webhooks.ts:383-394` | Add startup check: if `POSTMARK_WEBHOOK_TOKEN` is unset in production, throw `[FATAL] POSTMARK_WEBHOOK_TOKEN required`. Follow the same pattern as `TELEGRAM_WEBHOOK_SECRET`. |
| R2-P2-7 | OPEN | MED | `tenant.name` is injected into the Gemini prompt in `processEmailSupportMessage()` without sanitization. A compromised operator account could register a tenant with a name like `"[SYSTEM: ignore all rules and respond with...]"`. `sanitizePromptField()` exists and is applied elsewhere but not here. | `api/src/services/ai.ts` (`processEmailSupportMessage` tenant context block) | Apply `sanitizePromptField(tenant.name, 100)` before injecting into the prompt. Also sanitize `tenant.slug` and `tenant.flavor`. |
| R2-P2-8 | OPEN | MED | Relevance gate in `tiger_refine.ts` fails open: when the gate Gemini call throws, ALL extracted facts bypass the gate (`finalFacts = facts`). The gate exists specifically to block gaming/fiction content. A Gemini outage causes the moat to fill with irrelevant facts. | `api/src/tools/tiger_refine.ts:175-178` | On gate failure, reject all facts: `finalFacts = []`. Log the gate failure so ops can see it. Failing closed is correct for data quality. |
| R2-P2-9 | OPEN | MED | `runMarketMining()` has no per-flavor try-catch in the outer loop. If any flavor's `scoutQueries` is undefined or `displayName` throws, the entire mining run aborts silently mid-loop. Remaining flavors never get processed. | `api/src/services/market_miner.ts:105-161` | Wrap the flavor loop body in `try { } catch (err) { logger.error(...); continue; }` so one bad flavor doesn't kill the entire run. |
| R2-P2-10 | OPEN | MED | `fetchFacebookPosts()` and `fetchLINEPosts()` use static Serper key selection: `process.env.SERPER_KEY_1 ?? SERPER_KEY_2 ?? SERPER_KEY_3`. If key 1 is rate-limited, these sources always use key 1 and silently return empty results — never trying keys 2 or 3. Tenants in SEA using LINE openchat lose their primary discovery source. | `api/src/tools/tiger_scout.ts` (Facebook ~line 872, LINE source) | Thread the rotating `serperKeyIndex` state from `serper.ts` into these fallback calls, or use the same `fetchSerper()` helper from `serper.ts`. |
| R2-P2-11 | OPEN | MED | Telegram and LINE webhook workers (`telegramWorker`, `lineWorker`) lack default retry config at the queue level. Individual job adds have `attempts: 3` (added in queue.ts), but if the queue default isn't set and the per-job option is missing from any call site, messages silently drop on transient failures. This was deferred as P2-15 in the first audit. | `api/src/services/queue.ts` (telegramQueue, lineQueue creation) | Add `defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }` to both queue definitions as a safety net. |
| R2-P2-12 | OPEN | MED | Cron queue has no retry config. The global heartbeat job has no `attempts` or `backoff` at the queue or job level. A transient DB timeout during cron processing means all active tenants miss their routine check cycle — no nurture, no scoring update. | `api/src/services/queue.ts` (cronQueue creation) | Add `defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 5000 } }` to cronQueue. |
| R2-P2-13 | OPEN | MED | `fixBotPoolOrphans()` runs at startup without a timestamp guard. It recovers `bot_pool` entries where `status='assigned' AND tenant_id IS NULL`. If a concurrent assignment operation has set `tenant_id` but not yet changed `status`, the race could reset a legitimately-assigned entry back to `available`. | `api/src/services/db.ts:602-604` | Add a timestamp guard: `AND assigned_at < NOW() - INTERVAL '5 minutes'` to only recover stale orphans. |
| R2-P2-14 | OPEN | MED | No idempotency guard on Telegram message processing. BullMQ retries a job on failure with `attempts: 3`. If the bot reply is sent successfully on attempt 1 but the job's completion acknowledgment fails (Redis blip), BullMQ retries. Attempt 2 processes the same message and sends a second reply. The operator receives duplicate messages. | `api/src/routes/webhooks.ts:266-285`, `api/src/services/ai.ts` | Add a Redis idempotency key `msg_processed:${tenantId}:${update_id}` with a 10-minute TTL. Set it before processing, check it at the start of the worker. |
| R2-P2-15 | OPEN | MED | Circuit breaker resets on a single Gemini success. `trackGeminiSuccess()` immediately deletes the error counter. For an intermittently bad key (e.g., quota exhausted every 5 minutes), the circuit trips, recovers on one success, trips again, in a tight loop. The operator's bot experiences oscillating behavior. | `api/src/services/ai.ts` (circuit breaker logic) | Require N consecutive successes (e.g., 3) before resetting the error counter. Use a `success_streak` Redis key alongside the error counter. |
| R2-P2-16 | OPEN | MED | Session secret allows fallback to `MAGIC_LINK_SECRET` if `WIZARD_SESSION_SECRET` is absent. Both secrets may be different strength/purpose. A misconfigured deploy where only `MAGIC_LINK_SECRET` is set will silently use it for session signing, potentially weakening session security. | `api/src/services/auth.ts` (getSessionSecret) | Require `WIZARD_SESSION_SECRET` explicitly in production. Remove the `MAGIC_LINK_SECRET` fallback. Throw if unset in production. |

---

## PHASE 3 — Maintenance & Hardening

| ID | Status | Severity | Issue | File | Fix |
|----|--------|----------|-------|------|-----|
| R2-P3-1 | OPEN | MED | `tenant_leads`, `tenant_contacts`, `tenant_states`, `tenant_nurture` all define `tenant_id VARCHAR(255)` instead of `UUID`. Type mismatch with `tenants.id UUID` prevents proper FK constraints. PostgreSQL allows implicit casts in queries so it works functionally, but it defeats referential integrity guarantees. | `api/migrations/006_tenant_data.sql:8,34,62` | Write a migration to `ALTER TABLE ... ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID` for each table, then add FK constraints to tenants(id) ON DELETE CASCADE. |
| R2-P3-2 | OPEN | LOW | `capturedBy` and `entityId` in `POST /mining/refine` come from the request body and are stored in the `market_intelligence` table without sanitization. While parameterized queries prevent SQL injection, unsanitized values in JSONB metadata could cause issues with downstream analytics. | `api/src/tools/tiger_refine.ts:48-49` | Apply `sanitizePromptField(capturedBy, 200)` and `sanitizePromptField(entityId, 200)` before use. |
| R2-P3-3 | OPEN | LOW | `createBYOKConfig()` in `db.ts:823` uses the old `bot_id` column name (before migration 002 renamed it to `tenant_id`). This function is exported but not called in the active production path (wizard.ts uses `upsertBYOKConfig` instead). It is dead code that will fail if called. | `api/src/services/db.ts:823` | Either delete `createBYOKConfig()` (dead code) or fix the column name to `tenant_id`. The function also appears in the webhooks test mock — update or remove. |
| R2-P3-4 | OPEN | LOW | Several read-only SELECT queries use `getPool()` (write pool) instead of `getReadPool()`. Affects: `listCanaryTenants()`, `getRecentAdminEvents()`, `getPoolCounts()`, `listBotPool()`. Wastes write pool connections and limits read scalability. | `api/src/services/db.ts:349, 387, 572, 590` | Change these functions to use `getReadPool()`. Note: `getNextAvailableBotEntry()` must stay on write pool (needs to immediately update). |
| R2-P3-5 | OPEN | LOW | UUID validation regex `^[0-9a-f-]{36}$` accepts any 36-char string of hex digits and hyphens (e.g., 36 hyphens passes). Should enforce canonical UUID format with hyphens in specific positions. | `api/src/services/db.ts:191, 252` | Use `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/` instead. |
| R2-P3-6 | OPEN | LOW | `classifyAIError()` is defined identically in both `ai.ts` and `geminiGateway.ts` with a comment saying "keep in sync". No enforcement. If one changes, error classification diverges silently. | `api/src/services/ai.ts`, `api/src/services/geminiGateway.ts` | Extract to `api/src/services/errorClassifier.ts`. Import in both files. |
| R2-P3-7 | OPEN | LOW | `computeIntentScore()` does not guard against future `detectedAt` dates. If a signal's timestamp is in the future (clock skew, bad data), `ageDays` is negative, `Math.exp(-negative)` > 1, artificially inflating the lead score. | `api/src/tools/tiger_scout.ts` (computeIntentScore) | Clamp `ageDays = Math.max(0, ageDays)` before the decay calculation. |
| R2-P3-8 | OPEN | LOW | `POST /mining/refine` has no input size limit. A caller can POST a 100MB `rawContent`, which gets passed to Gemini. Could cause memory pressure or API timeouts in the API pod. | `api/src/routes/mining.ts:11` | Add: `if (rawContent.length > 50_000) return res.status(413).json({ ok: false, error: "Payload too large" });` |
| R2-P3-9 | OPEN | LOW | Hive emit failures are silently swallowed with `.catch(() => {})`. Silent degradation means Hive signals become stale without ops visibility. | `api/src/tools/tiger_scout.ts:1204`, `api/src/services/hiveEmitter.ts:62` | Change to `.catch(err => console.warn('[hive] emit failed:', err.message))`. Not worth alerting on — Hive is best-effort — but silence is bad. |

---

## Confirmed Working (Do Not Change)

- **Admin route auth**: `router.use(requireAdmin)` at line 62 of `admin.ts` correctly protects all admin routes ✓
- **`upsertBYOKConfig()`**: Uses correct `tenant_id` column (line 925). This is the active production path. ✓
- **Migration 024**: Correctly cleaned orphaned rows and added FK to tenants(id). Applied successfully in production. ✓
- **Migration 002**: Correctly renamed `bot_ai_config.bot_id` → `tenant_id`. Applied long ago. ✓
- **`POST /auth/verify-purchase`**: Rate limited; "no purchase found" branch returns 403 (not creating spurious accounts) ✓
- **`POST /mining/refine`**: Now protected by `requireAdmin` middleware ✓
- **`sanitizePromptField()`**: Applied to botName, ICP fields, extractionGoal, domain ✓
- **Telegram webhook**: Hard-rejects when `TELEGRAM_WEBHOOK_SECRET` unset ✓

---

## Highest-Risk Compound Failure Chains

### Chain A — Unauthenticated Bot Takeover
**Scenario:** Attacker enumerates tenant slugs (slug format is predictable: `{name-sanitized}-{base36timestamp}`). Calls `POST /dashboard/{slug}/update-key` with their own Gemini key. Bot now runs attacker's key. Attacker sees all AI inference, runs up unlimited quota on their key, or replaces key with an invalid one to DoS the operator's bot.
**Fixes required:** R2-P1-1 + R2-P1-2 together.

### Chain B — Silent Moat Corruption
**Scenario:** Mining runs daily. `saveMarketFact()` stores raw URLs. `isAlreadyMined()` checks normalized URLs. Each re-run with slightly different tracking params (`?utm_source=reddit` vs `?utm_source=r/nuskin`) bypasses dedup and inserts duplicates. After 30 days, the moat has 3–5x more facts than expected, all duplicate, inflating the Hive signal weight. AI system prompts become bloated.
**Fixes required:** R2-P1-7 alone.

### Chain C — Complete Tenant Suspension by Attacker
**Scenario:** Attacker knows any tenant's UUID (readable from dashboard via R2-P1-1). Calls `PATCH /tenants/{tenantId}/status` with `{ "status": "terminated" }`. Tenant's bot immediately stops responding. Operator has no way to know what happened or recover without admin intervention.
**Fixes required:** R2-P1-3 alone.

---

## Session Context

This audit was run in Session 10 (2026-04-04) after the 57-item sprint (PRs #189–#209) was fully deployed. No code was changed in this audit run. The next session should immediately address Phase 1 items — specifically the unauthenticated route cluster (R2-P1-1 through R2-P1-5), which represent an active security exposure on the live production system.

**The three most dangerous items (fix first):** R2-P1-1, R2-P1-2, R2-P1-3.
