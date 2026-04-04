# Tiger Claw — State of the Union

**Last updated:** 2026-04-04 (End of Session 7 — 10 critical bugs fixed, platform fully green)
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

## Cold Start Checklist (Do This First, Every Session)

1. Read this file top to bottom
2. Run `curl https://api.tigerclaw.io/health` — confirm postgres, redis, workers all OK
3. Check platform health: `GET /admin/platform-health` with admin token — all 10 services should be green
4. Pull current fleet: `GET /admin/fleet` with admin token
5. Do not touch anything until you know what is broken and what is not

**Admin token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
**DB (local):** port `5433`, user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`

---

## What This Product Is

AI sales agent SaaS. Customer pays on Stan Store → gets email with link → `wizard.tigerclaw.io/signup` → single-page form → bot hatches in ~2 minutes → bot prospects for them on Telegram around the clock.

**The value proposition:** Your bot hunts while you sleep.

**Confirmed working 2026-04-04:** Scout found 10 prospects, 1 qualified (score 80) on Facebook Groups. Bot responded intelligently, checked pipeline, surfaced a lead with Hive intelligence applied.

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
| Email | Resend | Domain verified. `RESEND_API_KEY` now in deploy script — emails live. |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Multi-region | `us-central1` (primary) + `asia-southeast1` | Global LB at `api.tigerclaw.io` (IP: `34.54.146.69`) |

---

## Live Service Status

Last verified 2026-04-04 (Session 7):

| Service | Status | Notes |
|---------|--------|-------|
| Cloud Run, Postgres, Redis | ✅ | Healthy |
| Workers | ✅ | ENABLE_WORKERS=true confirmed |
| Serper keys (x3) | ✅ | All confirmed working |
| Platform Gemini key | ✅ | Active |
| Platform onboarding key | ✅ | Active |
| Platform emergency key | ✅ | Renewed Session 7 |
| Admin Telegram bot | ✅ | @AlienProbeadmin_bot — alerts now firing correctly |
| Resend | ✅ | RESEND_API_KEY added to deploy script Session 7 — emails now live |
| Reddit (market miner) | ❌ | 403 from Cloud Run egress. Serper fallback active. Reddit API key awaiting approval. |
| Stripe | ❌ | Placeholder. Not used. |

---

## Current Tenant Fleet

Pull live data: `GET https://api.tigerclaw.io/admin/fleet` with admin token.

Last known state 2026-04-04:

| Slug | Status | Bot | Notes |
|------|--------|-----|-------|
| `brent-bryson-mnjd321r` | onboarding | @Testtigerfour_bot "Teddy" | Brent's test bot. Scout confirmed live. |

Jeff Mack and John (Thailand) were wiped from DB end of Session 7 for clean re-onboarding via wizard.

---

## Known Open Issues

| Item | Priority |
|------|----------|
| Jeff Mack and John need to complete wizard fresh | IMMEDIATE |
| Vercel auto-deploy broken — deploy wizard manually until Root Directory fixed | OPS |
| `nurture_check` now correctly calls tiger_nurture — monitor logs to confirm | VERIFY |
| Add per-tenant health indicators to admin dashboard fleet table | NEXT |
| Add per-tenant drill-down in admin dashboard | NEXT |
| source_url missing index on market_intelligence table | MEDIUM |
| factExtractionWorker failures produce no admin alert | MEDIUM |
| marketIntelligenceWorker failures produce no admin alert | MEDIUM |
| WIZARD_SESSION_SECRET not in deploy script — accidentally safe via MAGIC_LINK_SECRET fallback | LOW |
| Reddit 403 from Cloud Run egress — awaiting Reddit API approval | WAITING |
| Remove Zapier dead code | LOW |
| Remove Stripe dead code | LOW |
| Past customers owed bots: `chana.loh@gmail.com`, `nancylimsk@gmail.com`, `lily.vergara@gmail.com` | WHEN READY |
| **GitHub branch hygiene** — stale branches remain. Rule: delete branch on merge (now enforced). | CLEANUP |

---

## Session 7 — What Was Done (2026-04-04)

**Full audit by 6 parallel sub-agents** revealed 14 broken items including things broken since launch.

**PRs merged this session (#174–#183):**
- #174 — Serper fallback for market miner (Reddit dead 6 days)
- #175 — TELEGRAM_WEBHOOK_SECRET wired into deploy (post-deploy webhook fix now optional, not mandatory)
- #176 — RESEND_API_KEY in deploy, admin alert env var names fixed, nurture_check prompt fixed
- #177 — Dead key alerts routed through sendAdminAlert (not UUID)
- #178 — 72-hour duplicate account window removed
- #179 — Slug collision guard in wizard hatch
- #180 — Scoring ceiling fixed (engagement weight normalized)
- #181 — tiger_refine registered in toolsMap
- #182 — getTenant() wrapped in try/catch in webhook hot path
- #183 — CI test updated to match new rate limit message

**Platform state at session end:** All 10 services green. 412/412 tests passing. CI green.

---

## Post-Deploy Protocol (Mandatory Every Time)

```bash
# 1. Deploy API
GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh

# 2. Fix all webhooks (still good practice — now idempotent, not mandatory)
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

---

## Future Vision (Do Not Build Yet)

**Reflexion Loop:** Outcome signals (which approaches closed leads, which got ghosted) feed back into `fact_anchors` and `hive_signals`. Agent wakes up slightly smarter each morning. Build after 10+ agents have real outcome data.

**Agent Leaderboard:** Opt-in fleet ranking by leads surfaced, pipeline activity, conversion rate. Build after Reflexion Loop is live.

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
