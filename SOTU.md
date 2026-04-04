# Tiger Claw — State of the Union

**Last updated:** 2026-04-03 (End of Session 6 — scout live, first qualified lead found)
**This is the single source of truth. Read nothing else until you finish this file.**

---

## Standing Orders

**No lying. No assuming. No guessing.**
- Do not claim anything works unless you have tested it live.
- Do not mark a session complete if known broken items remain.
- The operator is running a real business. False confidence causes real damage.
- No AI agent pushes directly to `main`. All changes via `feat/` or `fix/` branch + PR.

---

## Cold Start Checklist (Do This First, Every Session)

1. Read this file top to bottom
2. Run `curl https://api.tigerclaw.io/health` — confirm postgres, redis, workers all OK
3. Check `wizard.tigerclaw.io/admin` — Platform Services panel shows green/red per service
4. Pull current fleet: `GET /admin/fleet` with admin token
5. Do not touch anything until you know what is broken and what is not

**Admin token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
**DB (local):** port `5433`, user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`

---

## What This Product Is

AI sales agent SaaS. Customer pays on Stan Store → gets email with link → `wizard.tigerclaw.io/signup` → single-page form → bot hatches in ~2 minutes → bot prospects for them on Telegram around the clock.

**The value proposition:** Your bot hunts while you sleep.

**Confirmed working 2026-04-03 7:18 PM:** Scout ran live, found 10 prospects, 1 qualified (score 80) on Facebook Groups. First end-to-end proof the core product function works.

---

## Current Payment Flow

Stan Store is the merchant. No Zapier. No Stripe (placeholder only).

```
Customer pays on Stan Store
→ Stan Store sends confirmation email with wizard.tigerclaw.io/signup
→ Customer enters purchase email on /signup
→ POST /auth/verify-purchase — creates DB record on-demand if none exists
→ Customer fills form: agent name, niche, ICP, Telegram bot token, Gemini key
→ POST /wizard/hatch
→ BullMQ tenant-provisioning job
→ Bot registered, webhook set, ICP loaded → status: onboarding
→ First message: confident intro, no interview
```

---

## Architecture (Locked)

| Layer | Technology | Notes |
|---|---|---|
| Compute | Google Cloud Run | Node.js/Express, port 4000, `tiger-claw-api` |
| Database | Cloud SQL PostgreSQL | `tiger_claw_shared`, proxy port **5433** locally (NOT 5432) |
| Cache / Queues | Cloud Redis + BullMQ | 8 queues. `ENABLE_WORKERS=true` required in deploy. |
| AI | Gemini 2.0 Flash | `@google/generative-ai` SDK — **LOCKED. Do not switch to 2.5-flash** (GCP function-calling bug) |
| Signup + Dashboard | Next.js, `web-onboarding/` | `wizard.tigerclaw.io` — Vercel. **Auto-deploy broken — deploy manually.** |
| Website | Static HTML | `tigerclaw.io` — separate repo |
| Payments | Stan Store | Direct. No Zapier. No Stripe. |
| Search / Scout | Serper | `SERPER_KEY_1/2/3` — all three updated 2026-04-03, confirmed working |
| Email | Resend | Domain verified. **`RESEND_API_KEY` not in deploy script — emails not sent in production.** |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Multi-region | `us-central1` (primary) + `asia-southeast1` | Global LB at `api.tigerclaw.io` (IP: `34.54.146.69`) |

---

## Live Service Status

Check `wizard.tigerclaw.io/admin` Platform Services panel for real-time green/red. This is the authoritative view — do not guess from this document.

Last known state as of 2026-04-03:

| Service | Status | Notes |
|---------|--------|-------|
| Cloud Run, Postgres, Redis | ✅ | Healthy |
| Serper keys (x3) | ✅ | Updated 2026-04-03, confirmed 200 |
| Platform Gemini key | ✅ | Active |
| Platform onboarding key | ✅ | Active |
| Platform emergency key | ❌ | Expired — must be renewed in GCP secrets |
| Admin Telegram bot | ✅ | @AlienProbeadmin_bot |
| Resend | ⚠️ | Domain verified, but `RESEND_API_KEY` not in deploy script — not live in production |
| Reddit (market miner) | ❌ | 403 from Cloud Run egress IP. Reddit API key applied for — awaiting approval (applied ~1 week ago, no response yet as of 2026-04-03). Mine cannot refill until approved. Follow up with Reddit. |
| Stripe | ❌ | Placeholder. `STRIPE_PRICE_BYOK=price_placeholder_replace_me`. Not used. |
| Zapier | ❌ | Dead code. Not used. |

---

## Current Tenant Fleet

Pull live data: `GET https://api.tigerclaw.io/admin/fleet` with admin token.

Last known state 2026-04-03:

| Slug | Status | Bot | Notes |
|------|--------|-----|-------|
| `brent-bryson-mnjd321r` | onboarding | @Testtigerfour_bot "Teddy" | Brent's test bot. Scout confirmed live. |
| `john-69cd9564` | onboarding | @BGJN8_bot | John (Thailand). Webhook live. ICP loaded. Short link sent. |
| `jeff-mack-69cd955d` | pending | — | Jeff Mack. Short link sent. |
| `justagreatdirector-mne9xtna` | pending | — | Debbie Cameron. Short link sent. |

Short provisioning links (expire 2026-04-07):
- Jeff: `https://api.tigerclaw.io/go/1c37637f22`
- John: `https://api.tigerclaw.io/go/6db1c80a1b`
- Debbie: `https://api.tigerclaw.io/go/95a641b8a2`

---

## Admin Dashboard — Known Work Needed

**URL:** `wizard.tigerclaw.io/admin` (not /admin/dashboard)

**What works:**
- Fleet table with tenant status, last active, message count
- Fix Webhooks button
- Platform Services panel (green/red per service) — added 2026-04-03
- Admin token persists in localStorage

**What needs work (in priority order):**
1. **Per-tenant health indicators in the fleet table** — each row should show a green/red for: webhook registered, AI key valid, bot token valid. Right now you cannot tell at a glance if a tenant's bot is actually functional.
2. **Per-tenant drill-down** — click a tenant to see their full state: ICP loaded, leads in pipeline, last scout run, key health, webhook status, recent errors.
3. **Alert inbox** — provisioning failures and suspension events fire admin Telegram alerts, but there's no in-dashboard log of them. An operator checking the dashboard should see these without Telegram.
4. **Scout status per tenant** — last run time, leads found, rate limit countdown.
5. **Resend email status** — `RESEND_API_KEY` needs to be added to the deploy script so emails actually go out. Until then, this is a silent failure.

---

## Known Open Issues

| Item | Priority |
|------|----------|
| Renew platform emergency Gemini key in GCP secrets | HIGH |
| Add `RESEND_API_KEY` to `deploy-cloudrun.sh` | HIGH — one line fix, emails currently not sent |
| `nurture_check` routine incorrectly calls `tiger_scout` | MEDIUM — wrong behavior |
| Reddit 403 from Cloud Run egress — awaiting Reddit API approval | MEDIUM — known, waiting |
| Vercel auto-deploy broken — deploy wizard manually until Root Directory fixed in Vercel settings | OPS |
| Remove Zapier dead code (`/webhooks/stan-store`, `ZAPIER_WEBHOOK_SECRET`) | LOW |
| Remove Stripe dead code | LOW |
| `bot_ai_keys` dead write (wizard writes here, runtime reads `bot_ai_config`) | LOW |
| Stan Store → Lemon Squeezy/Paddle (international VAT compliance) | DEFERRED |
| LINE (Phase 2/3) — requires LINE Official Account, not personal account | DEFERRED |
| Past customers owed bots: `chana.loh@gmail.com`, `nancylimsk@gmail.com`, `lily.vergara@gmail.com` | WHEN READY |

---

## Session 6 — What Was Done (2026-04-02 / 2026-04-03)

**April 2 post-Zoom failure:** Workers were silently off since launch (ENABLE_WORKERS never set). Fixed. Customer dashboard built. Slash commands added. Six bugs from the April 2 Zoom failure fixed (PRs #132–#143).

**April 3 root cause fixes:** fix-all-webhooks was joining bot_pool (wrong arch — returned 0 rows, registered nothing). Fixed. TELEGRAM_WEBHOOK_SECRET trailing newline fix (was silently killing all bots after every deploy). 8s timeout on Telegram validation. Admin suspension alerts. Phase 1 single-page signup built and tested. LINE removed from UI. (PRs #145–#170)

**April 3 evening (this session):**
- All 3 Serper keys replaced — scout now finds real prospects
- Scout mode default changed from `scheduled` to `burst` — user-triggered runs were blocked by 23h cooldown
- Scout rate limit output fixed — no longer asks operator what to do, now works the pipeline
- Platform health panel added to admin dashboard — green/red per service, live-tested
- Short magic links built (`/go/:code` — token hidden from shareable URL)
- Circuit breaker clear admin endpoint added
- Full live audit performed — results in Live Service Status section above
- All four core docs rewritten with honest current state
- **Scout confirmed live: 10 prospects found, 1 qualified (score 80), Facebook Groups**

---

## Post-Deploy Protocol (Mandatory Every Time)

```bash
# 1. Deploy API
GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh

# 2. Fix all webhooks immediately after (TELEGRAM_WEBHOOK_SECRET must be re-registered)
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Deploy wizard (manual — Vercel auto-deploy is broken)
# Use Vercel dashboard or CLI from web-onboarding/
```

---

## Engineering Constraints (Non-Negotiable)

- `main` is branch-protected. Always `feat/` or `fix/` branch + PR. No AI agent pushes to main.
- **Gemini 2.0 Flash only.** 2.5-flash has a GCP function-calling bug. Do not change.
- No Docker containers per tenant. No OpenClaw. No Mini-RAG. Gone permanently.
- `buildSystemPrompt()` is async. Always `await` it.
- New tools in `api/src/tools/` MUST be registered in `toolsMap` in `ai.ts`. Missing = infinite tool loop.
- Market intelligence domain key = flavor **displayName** (e.g. `"Real Estate Agent"`), NOT flavor key.
- `node-fetch` is not in `package.json`. Use native `fetch` (Node 18+).
- Cloud SQL proxy runs on port **5433** locally, not 5432.
- One PR per fix. Test before opening a PR.
- The Mac cluster at `192.168.0.2` is offline only. Cloud Run never calls it.

---

## Future Vision (Do Not Build Yet)

**Reflexion Loop:** Outcome signals (which approaches closed leads, which got ghosted) feed back into `fact_anchors` and `hive_signals`. Agent wakes up slightly smarter each morning. Build after 10+ agents have real outcome data.

**Agent Leaderboard:** Opt-in fleet ranking by leads surfaced, pipeline activity, conversion rate. Powerful for John's 21,000 LINE distributors. Build after Reflexion Loop is live.

Do not mention either publicly until built.

---

## Session Protocol

**Start of session:** Run cold start checklist above. Read this file. Do not code until you know what is broken.

**End of session:** Update this file before closing. Specifically:
1. Update "Last updated" line
2. Update Live Service Status if anything changed
3. Update Current Tenant Fleet from live data
4. Update Known Open Issues (mark resolved, add new)
5. Add a bullet to Session history above

A session that ends without updating this file leaves the next agent blind.
