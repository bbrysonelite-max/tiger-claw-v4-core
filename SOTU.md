# Tiger Claw — State of the Union

**Last updated:** 2026-04-04 (End of Session 9 — full reliability & security audit, no PRs merged, audit-april-4th.md written)
**This is the single source of truth. Read nothing else until you finish this file.**

---

## Standing Orders

**No lying. No assuming. No guessing.**
- Do not claim anything works unless you have tested it live.
- Do not mark a session complete if known broken items remain.
- The operator is running a real business. False confidence causes real damage.
- No AI agent pushes directly to `main`. All changes via `feat/` or `fix/` branch + PR.
- "I merged it" means nothing until confirmed. After every PR, verify with `gh pr view <number>` that state is `MERGED`. After every deploy, verify health endpoint returns 200 and check the logs. Do not tell the operator something is done until you have proof it is done.

---

## ⚠️ AUDIT BACKLOG — Read Before Touching Any Code

A full reliability & security audit was completed Session 9 (2026-04-04). **57 issues found (26 HIGH, 22 MED, 9 LOW).** The full document is at `audit-april-4th.md` in the repo root.

**Three items are actively broken in production right now:**
1. **`bot_ai_keys.bot_id` column wrong name** — `addAIKey()` fails on every call. Multi-key rotation is dead. Fix: migration 023, one SQL line. (`P1-1`)
2. **`activateSubscription` fires before queue job is enqueued** — Redis blip = paying customer with active subscription and no bot, no recovery. (`P1-2`)
3. **`stan-store-onboarding` worker has zero retries** — single DB hiccup permanently orphans a customer. (`P1-3`)

**Do not onboard new customers before P1-1, P1-2, P1-3 are shipped.**

Read `audit-april-4th.md` for the full phase-by-phase fix plan with exact file/line references and code-level instructions.

---

## Cold Start Checklist (Do This First, Every Session)

1. Read this file top to bottom
2. Run `curl https://api.tigerclaw.io/health` — confirm postgres, redis, workers all OK
3. Check platform health: `GET /admin/platform-health` with admin token — all services should be green
4. Pull current fleet: `GET /admin/fleet` with admin token
5. Do not touch anything until you know what is broken and what is not

**Admin token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
**DB (local):** port `5433`, user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`

---

## What This Product Is

AI sales agent SaaS. Customer pays on Stan Store → gets email with link → `wizard.tigerclaw.io/signup` → single-page form → bot hatches in ~2 minutes → bot prospects for them on Telegram around the clock.

**The value proposition:** Your bot hunts while you sleep.

**Confirmed working 2026-04-04:** Scout found prospects on Facebook Groups via Serper fallback. Bot responded intelligently, checked pipeline, surfaced leads with Hive intelligence applied. First production email ever delivered confirmed.

**Immediate go-to-market:** Operator (Brent) + Jeff Mack + John (Thailand) have access to ~60,000 NuSkin distributors. Target: get first 10 running, watch for one week, then expand to next 40.

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
| Search / Scout | Serper | `SERPER_KEY_1/2/3` — all confirmed working |
| Mine fallback | Serper KEY_2 | Reddit primary, Serper fallback when Reddit 403s |
| Email | Resend | Domain verified. `RESEND_API_KEY` in deploy script — emails live. |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Multi-region | `us-central1` (primary) + `asia-southeast1` | Global LB at `api.tigerclaw.io` (IP: `34.54.146.69`) |

---

## Live Service Status

Last verified 2026-04-04 (Session 8):

| Service | Status | Notes |
|---------|--------|-------|
| Cloud Run, Postgres, Redis | ✅ | Healthy. Revision 00310-pjx |
| Workers | ✅ | ENABLE_WORKERS=true confirmed |
| Serper keys (x3) | ✅ | All confirmed working |
| Platform Gemini key | ✅ | Active |
| Platform onboarding key | ✅ | Active |
| Platform emergency key | ✅ | Renewed Session 7 |
| Admin Telegram bot | ✅ | @AlienProbeadmin_bot — alerts firing correctly |
| Resend | ✅ | RESEND_API_KEY in deploy script — first production email confirmed delivered |
| TELEGRAM_WEBHOOK_SECRET | ✅ | In deploy script since #175 — secretWired: true confirmed post-deploy |
| Reddit (market miner) | ❌ | 403 from Cloud Run egress. Serper fallback active. Reddit API key awaiting approval. |
| Stripe | ❌ | Placeholder. Not used. |
| Vercel auto-deploy | ❌ | Root Directory not set correctly — deploy wizard manually |

---

## Current Tenant Fleet

Pull live data: `GET https://api.tigerclaw.io/admin/fleet` with admin token.

Last known state 2026-04-04:

| Slug | Status | Bot | Notes |
|------|--------|-----|-------|
| `brent-bryson-mnjd321r` | onboarding | @Testtigerfour_bot "Teddy" | Brent's test bot. Scout confirmed live. |
| `justagreatdirector-mne9xtna` | pending | — | Debbie — needs to complete wizard |

Jeff Mack and John (Thailand) were wiped from DB end of Session 7 for clean re-onboarding via wizard. They have not re-onboarded yet.

**Active agents (status = 'active' or 'live'):** 0 — Teddy is in `onboarding` status, not yet `active`.

---

## Tool Registry (25 tools — as of Session 8)

All tools live in `api/src/tools/`. All must be registered in `toolsMap` in `ai.ts` or Gemini enters an infinite loop.

**Registered in toolsMap:**
tiger_onboard, tiger_scout, tiger_contact, tiger_aftercare, tiger_briefing, tiger_convert, tiger_export, tiger_email, tiger_hive, tiger_import, tiger_keys, tiger_lead, tiger_move, tiger_note, tiger_nurture, tiger_objection, tiger_score, tiger_score_1to10, tiger_search, tiger_settings, tiger_drive_list, tiger_strike_harvest, tiger_strike_draft, tiger_strike_engage, tiger_refine

**Intentionally NOT registered (tool files exist but Gemini cannot call them):**
- `tiger_gmail_send` — removed Session 8. Gemini must never send from operator's personal Gmail without human approval.
- `tiger_postiz` — removed Session 8. Social media broadcasting is not Tiger's job.

---

## Known Open Issues

**IMPORTANT:** The full audit backlog (57 issues, phased fix plan) is in `audit-april-4th.md`. The items below are a summary of the highest-priority items plus the pre-existing backlog.

### Audit Phase 1 — Fix Before Next Customer (all OPEN)
| Item | ID |
|------|----|
| `bot_ai_keys.bot_id` column never renamed — `addAIKey()` broken, multi-key rotation dead | P1-1 |
| `activateSubscription` fires before `provisionQueue.add()` — orphaned subscriptions on Redis blip | P1-2 |
| `stan-store-onboarding` worker has zero retries despite claiming 5 | P1-3 |
| No Serper key rotation — 429 = silent empty results, `SERPER_KEY_3` unused in miner | P1-4 |
| `reddit_scout.mjs` has zero Serper fallback | P1-5 |
| Empty AI reply sends user silence — no fallback message | P1-6 |
| Telegram webhook validation skipped when env var unset (code check; env var IS wired in prod) | P1-7 |
| `verify-purchase` issues session tokens for any email, no purchase proof, no rate limit | P1-8 |
| `ADMIN_TOKEN` in session-signing fallback chain | P1-9 |
| `fc.args` not validated before Gemini tool dispatch — malformed args cause silent retry loops | P1-10 |

### Pre-Existing Backlog
| Item | Priority |
|------|----------|
| Jeff Mack and John need to complete wizard fresh | IMMEDIATE |
| Debbie (justagreatdirector) needs to complete wizard | IMMEDIATE |
| Vercel auto-deploy broken — deploy wizard manually until Root Directory fixed | OPS |
| Add per-tenant health indicators to admin dashboard fleet table | NEXT |
| Add per-tenant drill-down in admin dashboard | NEXT |
| Reddit 403 from Cloud Run egress — awaiting Reddit API approval | WAITING |
| Past customers owed bots: `chana.loh@gmail.com`, `nancylimsk@gmail.com`, `lily.vergara@gmail.com` | WHEN READY |
| Affiliate/referral tracking — Max Steingart deal (30% affiliate). Hold until he sells first 10. | DEFERRED |
| Remove Stripe dead code | LOW |

---

## Session 9 — What Was Done (2026-04-04)

Full reliability & security audit across 5 domains using 5 parallel sub-agents. No PRs merged this session. Output is `audit-april-4th.md` in the repo root.

**Findings:** 26 HIGH, 22 MED, 9 LOW. Three issues are actively broken in production right now (P1-1 through P1-3 above). Platform is green and serving current tenants but is not safe for new customer onboarding until Phase 1 items are shipped.

**Audit domains:** AI Agent Loop & Tool Registry · Provisioning Pipeline & BullMQ Queues · Database & Schema · Security/Auth/Secrets · Market Mining/Serper/Scout

**Platform state at session end:** All services green. 455/455 tests passing. No code changed.

---

## Session 8 — What Was Done (2026-04-04)

Continued from Session 7. Platform was fully green at session start.

**PRs merged this session (#186–#187):**
- #186 — Mine engine controls in admin dashboard: `GET /admin/mine/status`, `POST /admin/mine/run`, live running indicator + Run Now button, mine_complete admin event logging
- #187 — Tool safety audit + broken window cleanup:
  - Tests added for all 5 previously untested tools (tiger_email, tiger_gmail_send, tiger_drive_list, tiger_postiz, tiger_refine, tiger_score_1to10) — 43 new tests, 455 total
  - `tiger_gmail_send` removed from toolsMap — Gemini must not send from operator's personal Gmail
  - `tiger_postiz` removed from toolsMap — social broadcasting is not Tiger's job
  - `/admin/metrics` activeTenants fixed — was counting 'onboarding' as active, now only counts 'active' and 'live'
  - tiger_strike_draft test fixed — FK check mock was missing

**Also discussed this session:**
- White label / affiliate deal with Max Steingart — holding at referral model until he sells first 10
- Platform scaling ceiling is ~500 active bots before DB needs attention — plenty of runway
- Immediate go-to-market focus: get first 10 from Brent/Jeff/John NuSkin network running for one week

**Platform state at session end:** All services green. 455/455 tests passing. CI green. Revision 00310-pjx live.

---

## Post-Deploy Protocol (Mandatory Every Time)

```bash
# 1. Deploy API
GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh

# 2. Fix all webhooks (now idempotent — TELEGRAM_WEBHOOK_SECRET is in deploy script)
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
- One PR per fix. Test before opening a PR. Delete branch after merge.
- The Mac cluster at `192.168.0.2` is offline only. Cloud Run never calls it.
- `tiger_gmail_send` and `tiger_postiz` are NOT in toolsMap by design. Do not re-add them without explicit operator approval.

---

## Future Vision (Do Not Build Yet)

**Reflexion Loop:** Outcome signals (which approaches closed leads, which got ghosted) feed back into `fact_anchors` and `hive_signals`. Agent wakes up slightly smarter each morning. Build after 10+ agents have real outcome data.

**Agent Leaderboard:** Opt-in fleet ranking by leads surfaced, pipeline activity, conversion rate. Build after Reflexion Loop is live.

**Affiliate tracking:** Simple `?ref=` tag on signup URL, stored on subscription. Build when Max actually sends his first customer.

Do not mention any of these publicly until built.

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
