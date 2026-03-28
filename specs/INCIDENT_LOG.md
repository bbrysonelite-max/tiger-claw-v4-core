# Tiger Claw — Incident Log
**Session:** 2026-03-27/28 (Pre-Zoom activation sprint)

---

## INC-001 — Silent message drop for all tenants (30 days)
**Severity:** Critical
**Affected:** All tenants (debbie-cameron, john-thailand, chana-loha + all others)
**Duration:** ~30 days

### What happened
Every Telegram message from every tenant was silently dropped. Bots never responded to a single message.

### Root cause
`api/src/routes/webhooks.ts:240` only accepted `status = 'active'` or `status = 'onboarding'`. All production tenants have `status = 'live'`. The `TenantStatus` TypeScript type also did not include `'live'`, so no compiler warning was raised.

The cron heartbeat in `queue.ts` had the same bug — `WHERE status = 'active'` — so no routines ever fired either.

### Fix applied
- `webhooks.ts`: added `'live'` to allowed statuses
- `queue.ts`: changed to `status IN ('active', 'live')` in both cron queries
- `db.ts`: added `'live'` to `TenantStatus` union type
- `tenants.ts`: added `'live'` to `VALID_STATUSES`
- PR #59 merged and deployed

### Prevention
Any new tenant status value added to the DB must also be added to:
1. `TenantStatus` in `db.ts`
2. The webhook gate in `webhooks.ts`
3. Both cron queries in `queue.ts`
4. `VALID_STATUSES` in `tenants.ts`

---

## INC-002 — DATABASE_URL secret mismatch causing all new deploys to fail
**Severity:** Critical
**Duration:** ~1.5 hours

### What happened
Every attempt to deploy a new Cloud Run revision failed with "Resource readiness deadline exceeded" or "startup probe failed." The running revision (00107) continued working but could not be replaced.

### Root cause (chain)
1. DB direct access was needed to update a tenant name
2. `botcraft` user password was reset to `TigerClaw2026!` to enable local psql connection
3. `tiger-claw-database-url` secret was updated to version 6 with the new password
4. DB password was then reset BACK to the original `TigerClaw2026MasterKey!`
5. Secret version 7 was added with `TigerClaw2026MasterKey!` — but the `!` character in double-quoted shell strings caused the secret to store incorrectly or Cloud Run to read it incorrectly
6. New revisions read the secret, failed DB auth at startup, called `exit(1)`
7. Running revision 00107 kept working because its existing PG connection pool connections were already authenticated and never re-authenticated

### Fix applied
- Set DB password to `TigerClaw2026Secure` (no special characters)
- Updated secret to version 8 with matching URL
- Verified via Cloud SQL Proxy that connection works
- Pinned Cloud Run to secret version 8 explicitly
- Revision 00112 deployed successfully

### Prevention
1. **Never use `!` in database passwords** stored in GCP Secret Manager — shell escaping is unpredictable
2. When resetting a DB password, update the secret and redeploy atomically — never leave them out of sync
3. Do not change the DB password of a running system without a rehearsed rollback plan
4. Use `printf` not `echo` when piping secrets to avoid shell expansion

---

## INC-003 — Missing `idealPerson` in onboard_state crashes tiger_scout
**Severity:** High
**Affected:** Phaitoon (phaitoon)

### What happened
Phaitoon completed the Telegram onboarding interview. The bot marked phase as `complete`. When the teenager triggered a hunt, `tiger_scout` threw `TypeError: Cannot read properties of undefined (reading 'idealPerson')`.

### Root cause
The onboarding interview captured `identity` fields (name, biggestWin, differentiator, etc.) but never asked for or saved `idealPerson` — the target customer profile. `tiger_scout`'s `hunt` action reads `onboard_state.idealPerson` without a null check.

### Fix applied
- Manually patched `idealPerson` into Phaitoon's `tenant_states.state_data` via Cloud SQL
- `idealPerson.description`: "Network marketers and entrepreneurs looking to automate and scale their recruiting"

### Prevention
1. The onboarding interview must include `idealPerson` as a required field before marking phase `complete`
2. `tiger_scout` hunt action should guard against missing `idealPerson` with a clear user-facing message: "Please complete your profile setup before hunting — I need to know who your ideal prospect is."
3. Add validation in `processSystemRoutine` or wherever `onboard_state` is marked complete

---

## INC-004 — Webhook not registered for bots in pool (Phaitoon)
**Severity:** High
**Affected:** Phaitoon

### What happened
After Phaitoon's status was set to `active` and bot assigned, messages sent to `@Tiger0000000008_bot` produced no response. No webhook hits appeared in Cloud Run logs.

### Root cause
The bot was in the pool as `assigned` but Telegram's setWebhook was never called for it after the tenant was activated via direct DB update (bypassing the normal provisioner flow).

### Fix applied
`POST /admin/fix-all-webhooks` — re-registered all 10 assigned bots with Telegram.

### Prevention
When activating a tenant via direct DB update (bypassing `/admin/provision`), always run `fix-all-webhooks` immediately after. Better: add webhook registration to the `PATCH /tenants/:id/status` route so it fires automatically when status changes to `active`.

---

*Last updated: 2026-03-28*
