# Tiger Claw — Launch Readiness Assessment
**Generated:** 2026-03-26 (session ending ~midnight)
**Engineer:** Claude Sonnet 4.6 + Brent Bryson
**Target event:** Founding Member Zoom call — Thursday 2026-03-27, 7 PM Pacific\n**Current time:** ~midnight Wednesday morning (2026-03-26)\n**Runway:** Full Wednesday + Thursday until 7 PM — approximately 2 working days

---

## Go / No-Go Verdict

**GO — with two P1 items to handle before the Zoom call.**

The platform is live, tested end-to-end, and will work for the founding member cohort. The gaps are known, documented, and none are platform-killers at this scale.

---

## Phase 1: Smoke Test (Do Before Zoom Call — 15 min)

Run this exact sequence the morning of the call. If any step breaks, stop and fix it before opening the room.

1. Make a test Stan Store purchase (use a real card — refund after)
2. Confirm magic link email arrives via Resend
3. Open wizard, complete onboarding (name, AI key, flavor)
4. Confirm Telegram bot responds to a message
5. Open `wizard.tigerclaw.io/admin/dashboard` — confirm tenant appears as active
6. Check Cloud Run logs for any `[ALERT]` lines

---

## Phase 2: Pre-Launch Checklist

```
Infrastructure
[ ] Cloud Run service is running — check GCP console > Cloud Run > tiger-claw-api
[ ] Redis (Memorystore) is healthy
[ ] Cloud SQL is healthy, automatic backups enabled
[ ] PLATFORM_ONBOARDING_KEY is current (renewed 2026-03-25 — check again if >30 days old)
[ ] ADMIN_TOKEN is a strong random value (not a dev placeholder)
[ ] Resend API key is valid — send a test email
[ ] Admin Telegram alerts working — trigger one manually via a test API call

Capacity
[ ] Bot pool has enough tokens for launch cohort
    Current: ~41 available. Each new tenant consumes 1.
    If cohort > 35, replenish before the call.
[ ] Cloud Run min-instances set to 1
    Without this, first message after idle = 5-10s cold start.
    Fix: GCP Console > Cloud Run > tiger-claw-api > Edit > Min instances = 1
    Or: gcloud run services update tiger-claw-api --min-instances=1 --region=us-central1

Security
[ ] Stan Store webhook secret is set and validated in the webhook handler
[ ] ADMIN_TOKEN is not exposed in any public repo or log
```

---

## Known Weaknesses — Prioritized

### P0 — Platform-killers
None currently. Platform is stable.

### P1 — Fix before launch (real risk)

**1. Feedback loop cron fires dead routine types**
- The cron at 8 AM UTC enqueues `weekly_checkin`, `feedback_reminder`, `feedback_pause`
- `processSystemRoutine()` in `ai.ts` does not handle these types — they fail silently
- Risk: feedback loop logic never executes; no customer impact visible but the feature is broken
- Fix: wire the handlers in `processSystemRoutine` OR remove the feedback loop cron block
- File: `api/src/services/queue.ts` lines ~437-462
- Effort: 30 minutes

**2. Cloud Run min-instances = 0 (cold start)**
- First message after idle period hits a 5-10 second delay
- Founding member's first impression of their bot may be a slow response
- Fix: `gcloud run services update tiger-claw-api --min-instances=1 --region=us-central1`
- Effort: 2 minutes

### P2 — Accept for launch, fix in sprint 2

**3. No rate limiting on public webhook endpoints**
- Anyone who knows a tenant's Telegram webhook URL can spam it and drain their AI key
- Risk at launch scale (20-50 customers): very low — not a known attack surface yet
- Fix: Cloudflare in front of API, or express-rate-limit on webhook routes
- Effort: 2-4 hours

**4. No cryptographic payment verification on `/wizard/hatch`**
- Wizard trusts a `sessionId` UUID from the magic link URL
- If someone intercepts a magic link, they can provision a free bot
- Risk: low (link delivered to purchaser's email only), but not zero
- Fix: sign the magic link with HMAC; verify signature on `/hatch`
- Effort: 3-4 hours

**5. LINE tenants pre-PR #32 may have auto-reply still on**
- LINE's built-in auto-reply fires alongside Tiger Claw responses (double message)
- Affects: any LINE tenant who set up before 2026-03-25
- Fix: contact them individually; wizard now warns new tenants automatically
- Effort: manual outreach per tenant

**6. `john-noon` tombstone tenant consuming a pool token**
- Suspended tenant, webhook conflict with `john-thailand`
- Wastes one bot pool slot
- Fix: `POST /admin/fleet/{id}/deprovision` to recycle the token
- Effort: 5 minutes (get tenant ID from admin dashboard first)

**7. `resolveGoogleKey` dead code in `ai.ts`**
- Old 4-layer key resolver still exists alongside the correct `resolveAIProvider`
- Not called by any message path — pure confusion risk for future sessions
- Fix: delete `resolveGoogleKey` and its callers (only `resolveGoogleKey` tests remain)
- Effort: 20 minutes

### P3 — Tech debt, not launch risk

**8. `createBYOKBot` inserts into `tenants` table despite its name**
- Naming mismatch — no runtime impact, high confusion impact
- Leave for a clean-up sprint

**9. `bots` table appears to be legacy / mostly unused**
- V3 artifact. Some webhook code still writes to it but it's not read by anything critical
- Leave for a clean-up sprint

**10. LINE E2E test doc is stale**
- `docs/testing/LINE-E2E-TEST.md` references OpenClaw/Docker
- Rewrite for V4 when LINE becomes a significant revenue channel

---

## Architecture Snapshot (as of 2026-03-26)

| Component | Status |
|---|---|
| API | Cloud Run, `us-central1`, `https://api.tigerclaw.io` |
| DB | Cloud SQL PostgreSQL HA, `tiger_claw_shared` |
| Cache/Queue | Cloud Memorystore Redis HA + BullMQ (6 queues) |
| AI Engine | Gemini 2.0 Flash (locked — 2.5 Flash has GCP function-calling bug) |
| Wizard | Next.js on Vercel, `wizard.tigerclaw.io` |
| Website | Static HTML on Vercel, `tigerclaw.io` |
| Payments | Stan Store (purchase gating + checkout) |
| Email | Resend |
| Bot Pool | ~41 available Telegram tokens, AES-256-GCM encrypted |
| Admin | `wizard.tigerclaw.io/admin/dashboard` |

---

## What Was Shipped This Session (2026-03-25/26)

| PR | What | Impact |
|---|---|---|
| #30 | Drop doctor flavor (compliance), tighten all 10 | Risk reduction |
| #32 | LINE wizard auto-reply warning, token length fix, website copy | Customer-facing |
| #33 | Differentiated error messages, platform key health check (cron 8AM) | Ops visibility |
| #34 | Botpool ingestion fix — real telegramBotId, ADMIN_TOKEN warning | Data integrity |
| #35 | Delete `/admin/demo` (dead + unprotected) and `seed_tenant.ts` | Security |
| #36 | Fleet dashboard — pool health, alarms, suspend/resume, per-tenant detail | Ops tooling |

**Also validated:**
- LINE integration proven end-to-end (webhook → BullMQ → onboarding → Hive injection)
- Platform key expiry incident discovered and resolved (renewed, health check added)
- Botpool ingestion pipeline fully audited and corrected
- Comprehensive codebase audit — 10 issues identified and categorized

---

## Sprint 2 Priorities (After Launch)

1. Wire or remove the feedback loop cron routine types (P1 above)
2. Rate limiting on webhook endpoints
3. HMAC-signed magic links
4. Reflexion Loop tooling on Mac cluster (offline, read-only, non-blocking)
5. Bot pool replenishment (activate Android phones, run `auth_session.ts` per SIM)
6. Clean up `resolveGoogleKey` dead code
7. Rewrite LINE E2E test doc

---

## How to Start the Next Session

1. Read `START_HERE.md` — complete resurrection briefing
2. Read this file — readiness status and open items
3. Read `STATE_OF_TIGER_CLAW.md` — architecture and PR history
4. Check `wizard.tigerclaw.io/admin/dashboard` — live fleet status
5. Run `npm test` in `api/` — should be 382/382

Do not trust your base-model memory. Trust the repo.
