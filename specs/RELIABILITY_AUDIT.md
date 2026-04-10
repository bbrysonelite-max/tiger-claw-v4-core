# Tiger Claw — Application Layer Reliability Audit
**Date:** 2026-03-28
**Scope:** Catch blocks, tenant status filtering, onboarding validation, queue retry, webhook registration
**Agent:** Claude (Task #5 from STATE_OF_THE_TIGER_PATH_FORWARD.md)

---

## Summary

| Category | CRITICAL | HIGH | MED | OK |
|----------|----------|------|-----|-----|
| Catch blocks (silent failures) | 1 | 2 | 0 | 1 |
| Tenant status filtering | 1 | 2 | 1 | 0 |
| Onboarding (ICP) validation | 1 | 1 | 1 | 0 |
| Queue retry/backoff | 0 | 0 | 0 | 5 |
| setWebhook on activation | 1 | 2 | 1 | 0 |
| **TOTAL** | **4** | **7** | **3** | **6** |

---

## 1. Catch Blocks — Silent Failures in Message Path

### 🔴 CRITICAL — Stripe webhook provisioning error not escalated
- **File:** `api/src/routes/webhooks.ts:200-207`
- **Issue:** Catch block calls `sendAdminAlert().catch(() => {})` — if the alert itself fails, the provisioning error is silently lost. No queue job created, no retry.
- **Fix:** Log with `[ALERT]` prefix before alert dispatch; do not suppress alert errors.

### 🟠 HIGH — LINE webhook async block swallows errors
- **File:** `api/src/routes/webhooks.ts:345`
- **Issue:** `setImmediate()` async block catch only calls `console.error`. No BullMQ retry, no admin alert.
- **Fix:** Replace `setImmediate` direct processing with queue enqueue (same as Telegram). Add `sendAdminAlert` in catch.

### 🟠 HIGH — Telegram queue enqueue failure not alerted
- **File:** `api/src/routes/webhooks.ts:261-263`
- **Issue:** Catch block returns 500 (correct for Telegram retry), but no admin alert. After 3 Telegram retries the message is lost with no ops notification.
- **Fix:** Add `sendAdminAlert` when enqueue fails, or after 2+ failures.

### ✅ OK — AI service catch blocks have [ALERT] logging
- **File:** `api/src/services/ai.ts`
- **Status:** 15+ catch blocks with `[ALERT]` severity. `processTelegramMessage`, `processSystemRoutine`, `processLINEMessage` all log properly.

---

## 2. Tenant Status Filtering

### 🔴 CRITICAL — Cron heartbeat excludes 'onboarding' tenants
- **File:** `api/src/services/queue.ts:410-413`
- **Query:** `WHERE status IN ('active', 'live')` — 'onboarding' excluded.
- **Impact:** Onboarding tenants never receive value-gap check-ins, daily scouts, or nurture checks during their first days. Violates CLAUDE.md "Radical Value Delivery" mandate.
- **Fix:** Change query to `WHERE status IN ('active', 'live', 'onboarding')`.

### 🟠 HIGH — Value-gap detection query also excludes 'onboarding'
- **File:** `api/src/services/queue.ts:485`
- **Query:** `AND t.status IN ('active', 'live')` — same gap as above in the value-gap check block.
- **Fix:** Same: add 'onboarding' to the IN list.

### 🟡 MED — Status allowlist not explicit in webhook
- **File:** `api/src/routes/webhooks.ts:240`
- **Issue:** Uses negation (`!== active && !== live && !== onboarding`) instead of explicit allowlist.
- **Risk:** Future status additions (e.g., 'updating', 'paused') could bypass or incorrectly block messages.
- **Fix:** Replace with `if (!['active', 'live', 'onboarding'].includes(tenant.status))`.

---

## 3. Onboarding Field Validation (idealPerson)

### 🔴 CRITICAL — phase="complete" set without ICP validation
- **File:** `api/src/tools/tiger_onboard.ts` — `handleNaming()` function
- **Issue:** `state.phase = "complete"` set unconditionally without checking `idealPerson` is non-empty.
- **Impact:** Tenant can complete onboarding with empty ICP. System prompt says "ideal customer: —" forever. Scout targets nobody.
- **Fix:**
  ```typescript
  if (!state.icpProspect?.idealPerson?.trim() && !state.icpProduct?.idealPerson?.trim()) {
    return reply("⚠️ Please complete your Ideal Customer Profile before finishing setup.");
  }
  ```

### 🟠 HIGH — ICP confirmation step doesn't validate data
- **File:** `api/src/tools/tiger_onboard.ts` — `handleICPPhase()`
- **Issue:** User can reply "yes" to confirm an empty ICP profile and proceed.
- **Fix:** Before allowing confirmation transition, assert `idealPerson` is non-empty string.

### 🟡 MED — SOUL.md generated with "—" placeholders
- **File:** `api/src/tools/tiger_onboard.ts:725,737`
- **Issue:** SOUL.md uses `?? "—"` fallback; file is written even when ICP is incomplete.
- **Impact:** System prompt references "ideal customer: —". Not a crash, but produces poor AI behavior.
- **Fix:** Block SOUL.md creation until `idealPerson` is populated.

---

## 4. Queue Failure / Retry / Backoff

All five critical queues are correctly configured:

| Queue | File | Retry Config |
|-------|------|-------------|
| Telegram webhook | webhooks.ts:254 | 3 attempts, exponential 2s |
| LINE webhook | webhooks.ts:340 | 3 attempts, exponential 2s |
| Email support | webhooks.ts:392 | 3 attempts, exponential 5s |
| Provisioning | queue.ts | BullMQ default backoff |
| Market mining | market_intel.ts | 3 attempts, exponential 1s |

✅ **No action needed.** All queues have retry/backoff.

---

## 5. setWebhook on Status Change to Active

### 🔴 CRITICAL — setWebhook NOT called when onboarding → active
- **File:** `api/src/services/provisioner.ts:204-208` vs `tiger_onboard.ts:865`
- **Issue:** `setWebhook` fires in `provisionTenant()` during 'onboarding' transition. When `setTenantActive()` transitions to 'active', NO webhook re-registration happens.
- **Risk:** If Telegram invalidates the webhook during the onboarding window, the bot silently goes deaf at activation. User sees status=active but bot never responds.
- **Fix:** Call `setWebhook` in `setTenantActive()` or add a webhook health check at activation time.

### 🟠 HIGH — resumeTenant() doesn't validate webhook response
- **File:** `api/src/services/provisioner.ts:355-359`
- **Issue:** `setWebhook` called in `resumeTenant()` but response `tgData.ok` not checked (unlike `provisionTenant()` at line 211).
- **Impact:** Silent failure possible on resume — bot stays deaf after unsuspend.
- **Fix:** Check `if (!tgData.ok)` and log `[ALERT]` + call `sendAdminAlert`.

### 🟠 HIGH — Webhook secret not re-applied on resume
- **File:** `api/src/services/provisioner.ts:348-359`
- **Issue:** `resumeTenant()` calls `setWebhook` without `secret_token`. If the secret was originally set (which `fix-all-webhooks` does), removing it on resume breaks webhook signature validation.
- **Fix:** Include `TELEGRAM_WEBHOOK_SECRET` in the resume setWebhook body (same as `fix-all-webhooks` at line 101).

### 🟡 MED — Webhook idempotency check missing on activation
- **File:** `api/src/services/provisioner.ts`
- **Issue:** No mechanism to verify webhook is still live before marking tenant active.
- **Fix:** `GET /getWebhookInfo` Telegram call before activation; re-register if URL doesn't match.

---

## 6. Additional Findings

### 🟠 HIGH — Stripe webhook Redis idempotency fails open
- **File:** `api/src/routes/webhooks.ts:123-128`
- **Issue:** If Redis is unreachable, `redis.get()` returns null via catch — allowing duplicate provisioning of the same session.
- **Fix:** Fail closed: return 503 when Redis check throws, instead of proceeding.

### 🟠 HIGH — Email webhook doesn't validate sender is a known tenant
- **File:** `api/src/routes/webhooks.ts:358-399`
- **Issue:** Any email to `support@tigerclaw.io` queues an AI processing job, regardless of whether the sender is a tenant.
- **Fix:** Before queueing, look up `fromEmail` in tenants table. Accept all emails for support purposes (non-tenants go to human queue), but don't run AI processing for unknown senders.

---

## Prioritized Fix Queue

### Sprint 1 (Before Next Demo)

1. **Add 'onboarding' to cron status filter** — `queue.ts:410-413` and `:485` — one-line fix, zero risk.
2. **Fix Stripe Redis idempotency to fail closed** — `webhooks.ts:123` — prevents duplicate provisioning.
3. **Add webhook validation in resumeTenant** — `provisioner.ts:355-359` — check `tgData.ok`, add secret.
4. **Add [ALERT] to LINE webhook error handler** — `webhooks.ts:345` — log + admin alert.

### Sprint 2

5. **ICP validation before phase=complete** — `tiger_onboard.ts` — prevents empty-profile completions.
6. **setWebhook re-registration on activation** — `provisioner.ts + tiger_onboard.ts` — closes silent-deaf-bot risk.
7. **Replace status negation with allowlist** — `webhooks.ts:240` — defensive coding, no breaking change.

---

*Audit produced 2026-03-28. See `specs/INCIDENT_LOG.md` for related incident history.*
