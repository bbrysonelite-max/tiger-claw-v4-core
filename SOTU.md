# Tiger Claw — State of the Union

**Last updated:** 2026-04-05 (Session 13 COMPLETE — Doc sync, C3+M2 fixed, refund policy added. PRs #221–#222 on main, NOT YET DEPLOYED.)
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

## Current Platform State

**Revision:** `tiger-claw-api-00353-947` — deployed 2026-04-06
**Health:** postgres ✅ redis ✅ workers ✅ disk ✅
**Tests:** 447/447 passing
**Wizard:** `wizard.tigerclaw.io/signup` — 200 OK

**Session 13 changes (PRs #220–#222 + website PR #1) — ALL DEPLOYED:**
- ✅ #220 — Docs: MODULE_ASSESSMENT + SOTU updated to reflect Session 12 resolved items.
- ✅ #221 — Hatch email personalized (agent name + flavor, Tiger's voice, null-safe botUsername).
- ✅ #222 — Serper: per-invocation call counter in market_miner; key rotation in tiger_scout.
- ✅ Website #1 — Refund policy section added to tigerclaw.io for Paddle compliance.

**Session 12 fixes merged and live (PRs #212–#219):**
- ✅ #212 — `fact_anchors` now read back into `buildSystemPrompt()`. Agents compound over time.
- ✅ #213 — Customer dashboard auth fixed. Session token stored at signup, sent on dashboard requests.
- ✅ #214 — Delta scan: `sinceTimestamp` filter prevents rescanning same content.
- ✅ #215 — `nurture_check` skips LLM when tenant has zero leads. Token burn eliminated.
- ✅ #216 — Oxylabs proxy scaffolded (dormant — activates when env vars set).
- ✅ #217 — Lemon Squeezy webhook scaffolded (dormant — activates when env var set).
- ✅ #218 — Success screen redesigned. "[AgentName] is ready to hunt." + Telegram CTA.
- ✅ #219 — Gemini context caching for tool declarations.
- ✅ Vercel root directory misconfiguration fixed. Auto-deploy now works.

---

## ⚠️ OPEN CRITICAL ISSUES

| # | Issue | Priority |
|---|---|---|
| DEPLOY | ✅ PRs #221/#222 deployed — revision 00353-947 live 2026-04-06 | DONE |
| REVIEW | Agent behavior flagged as broken window — review before onboarding any customer | IMMEDIATE |
| C4 | Payment gate open — fix path: re-wire Zapier → `/webhooks/stan-store` + harden `verify-purchase` to 403 on no pre-existing record | NEXT SESSION |
| H2 | Reddit returns 403 on every scout run — Oxylabs account needed | HIGH |
| R2-P1-6 | Stan Store Zapier race — duplicate webhook fires hit UNIQUE constraint — fix in same session as C4 | MED |

**Payment processor status:**
- Stan Store: active front door. Confirmation email sends wizard link with `?email=` param. C4 gap closes when Zapier is re-wired (next session).
- Zapier: `/webhooks/stan-store` handler exists in codebase (legacy, dormant). Re-wire Stan Store → Zapier → this endpoint to pre-create purchase records. Then harden `verify-purchase` to 403 if no pre-existing record. Fixes C4 without Paddle.
- Lemon Squeezy: REJECTED — "services fulfilled outside Lemon Squeezy". Webhook code dormant in repo. Dead end.
- Paddle: provisionally approved. Domains approved. Business info submitted 2026-04-05 — awaiting final approval. When approved: build `/webhooks/paddle` using existing LS handler as template. Replaces Zapier long-term.
- Stripe: operator has account. Fallback if Paddle declines. Same webhook pattern — `checkout.session.completed`, HMAC verify, pre-create record. Dead code placeholder already in repo.
- Refund policy: live at tigerclaw.io/#refund-policy (deployed 2026-04-05, tiger-bot-website PR #1).

Full assessment: `MODULE_ASSESSMENT.md` in repo root.
Full audit backlog: `audit-session10-round2.md` and `audit-april-4th.md`.

---

## Cold Start Checklist (Do This First, Every Session)

1. Read this file top to bottom
2. Run `curl https://api.tigerclaw.io/health` — confirm postgres, redis, workers all OK
3. Read `MODULE_ASSESSMENT.md` — complete 8-module ground-truth assessment of what was built
4. Pull current fleet: `GET /admin/fleet` with admin token
5. Do not touch anything until you know what is broken and what is not

**Admin token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
**DB (local):** port `5433`, user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`

---

## What This Product Is

Stateless agent hatchery for network marketing recruiting. Customer brings their own Telegram bot token (BYOB) and their own Gemini API key (BYOK). One-page signup. Agent hatches knowing its ICP. Agent prospects while operator sleeps. Hive gets smarter with every run.

**The value proposition:** Your bot hunts while you sleep.

**Two products (strict separation):**
- **Tiger Strike** (Hunter) — finds leads, facilitates first public reply or DM, fires webhook to TigerClaw on positive reply
- **TigerClaw** (Closer) — receives webhook payload, triggers SMS outreach and nurture sequence

**Current focus:** TigerClaw only. Tiger Strike is the data layer feeding it.

---

## Current Payment Flow

Stan Store is the merchant. No Zapier. No Stripe (placeholder only).

```
Customer pays on Stan Store
→ Stan Store sends confirmation email with link: wizard.tigerclaw.io/signup?email=customer@email.com
→ Customer clicks link — email pre-populates in EmailGate
→ POST /auth/verify-purchase — creates DB record on-demand (NO payment verification — known gap C4)
→ Customer fills form: agent name, niche, ICP, Telegram bot token, Gemini key
→ POST /wizard/hatch — validates key inline, writes ICP to onboard_state.json
→ BullMQ tenant-provisioning job
→ Bot registered, webhook set, slash commands registered, ICP loaded → status: onboarding
```

**⚠️ Payment gate is open.** Anyone who navigates directly to `/signup` can get a free bot.
Fix path: Paddle (application submitted 2026-04-05). When approved, build `/webhooks/paddle` using same pattern as existing Lemon Squeezy handler.

---

## Architecture (Locked)

| Layer | Technology | Notes |
|---|---|---|
| Compute | Google Cloud Run | Node.js/Express, port 4000, `tiger-claw-api` |
| Database | Cloud SQL PostgreSQL | `tiger_claw_shared`, proxy port **5433** locally (NOT 5432) |
| Cache / Queues | Cloud Redis + BullMQ | 8 queues. `ENABLE_WORKERS=true` required in deploy. |
| AI | Gemini 2.0 Flash | `@google/generative-ai` SDK — **LOCKED. Do not switch to 2.5-flash** (GCP function-calling bug) |
| Signup + Dashboard | Next.js, `web-onboarding/` | `wizard.tigerclaw.io` — Vercel. Auto-deploy now fixed. |
| Website | Static HTML | `tigerclaw.io` — separate repo |
| Payments | Stan Store (draft mode) | Paddle application pending. LS rejected. |
| Search / Scout | Serper | `SERPER_KEY_1/2/3` — all confirmed working |
| Mine fallback | Serper KEY_2 | Reddit primary, Serper fallback when Reddit 403s |
| Email | Resend | Domain verified. `RESEND_API_KEY` in deploy script — emails live. |
| GCP Project | `hybrid-matrix-472500-k5` | |
| Multi-region | `us-central1` (primary) + `asia-southeast1` | Global LB at `api.tigerclaw.io` (IP: `34.54.146.69`) |

---

## Live Service Status

Last verified 2026-04-05 (Session 12):

| Service | Status | Notes |
|---------|--------|-------|
| Cloud Run | ✅ | Revision 00353-947 |
| Postgres | ✅ | Healthy |
| Redis | ✅ | Healthy |
| Workers | ✅ | ENABLE_WORKERS=true confirmed |
| Serper keys (x3) | ✅ | All confirmed working |
| Platform Gemini key | ✅ | Active |
| Admin Telegram bot | ✅ | @AlienProbeadmin_bot — alerts firing correctly |
| Resend | ✅ | First production email confirmed delivered |
| TELEGRAM_WEBHOOK_SECRET | ✅ | In deploy script — secretWired: true confirmed |
| Vercel (`wizard.tigerclaw.io`) | ✅ | Root directory fixed. 200 OK confirmed. |
| Reddit (market miner) | ❌ | 403 from Cloud Run egress. Serper fallback active. Oxylabs pending. |
| Stripe | ❌ | Placeholder only. Not used. |

---

## Module Assessment Summary

Full details in `MODULE_ASSESSMENT.md`. Read that file for the complete picture.

| Module | Status | Fatal gaps |
|---|---|---|
| 1. Scout | Degraded — Reddit 403, no pre-classification | No |
| 2. Hive | Working — 313 facts on first run, dedup fixed | No |
| 3. Cognitive Architecture | Backend (self-improvement.ts) works. File layer missing. | No |
| 4. Hatchery | Working — BYOB/BYOK/ICP flow solid | No proactive first message |
| 5. Orchestration | Working — daily scout, nurture, value gap, feedback loop | Nurture token burn fixed ✅ |
| 6. Skills | 25 tools working. All loaded every turn (token waste). | No |
| 7. Memory | Short-term ✅ Hive ✅ fact_anchors wired ✅ | No |
| 8. Payment/Dashboard/SOUL | Dashboard auth fixed ✅ SOUL solid ✅ Payment gate open ❌ | C4 open |

---

## Tool Registry (25 tools)

All tools live in `api/src/tools/`. All must be registered in `toolsMap` in `ai.ts` or Gemini enters an infinite loop.

**Registered:**
tiger_onboard, tiger_scout, tiger_contact, tiger_aftercare, tiger_briefing, tiger_convert, tiger_export, tiger_email, tiger_hive, tiger_import, tiger_keys, tiger_lead, tiger_move, tiger_note, tiger_nurture, tiger_objection, tiger_score, tiger_score_1to10, tiger_search, tiger_settings, tiger_drive_list, tiger_strike_harvest, tiger_strike_draft, tiger_strike_engage, tiger_refine

**Intentionally NOT registered:**
- `tiger_gmail_send` — Gemini must never send from operator's personal Gmail without human approval.
- `tiger_postiz` — Social broadcasting is not Tiger's job.

---

## Known Open Issues

| Item | Priority |
|------|----------|
| ~~Deploy PRs #221/#222 to Cloud Run~~ | ~~IMMEDIATE~~ — ✅ DONE 2026-04-06 |
| Agent behavior review — conversational quality, SOUL injection, runToolLoop() | IMMEDIATE (before John/Jeff/Debbie) |
| C4: Re-wire Zapier → `/webhooks/stan-store`; harden `verify-purchase` to 403 on no pre-existing record | NEXT SESSION |
| R2-P1-6: Fix Zapier race condition (UNIQUE on duplicate webhook) — same session as C4 | NEXT SESSION |
| H2: Reddit 403 — Oxylabs account needed | HIGH |
| Paddle final approval — business info submitted, awaiting response | HIGH |
| UX overhaul — tigerclaw.io + wizard + dashboard: unify end-to-end after Paddle resolves | AFTER PADDLE |
| Past customers owed bots: `chana.loh@gmail.com`, `nancylimsk@gmail.com`, `lily.vergara@gmail.com` | WHEN READY |
| Affiliate/referral tracking — Max Steingart deal (30%). Hold until he sells first 10. | DEFERRED |
| Remove Stripe dead code | LOW — hold until Stripe fallback decision is final |

---

## Session 13 — What Was Done (2026-04-05)

Doc sync + targeted fixes. No deploy yet — PRs are on main.

**PRs merged:**
- #220 — Docs: MODULE_ASSESSMENT Priority Fix List and module narratives updated to reflect Session 12 resolved items (C1/C2/H1/H3/M1/M3 marked resolved with PR numbers). SOTU stale open items removed.
- #221 — fix/C3: Hatch email (`sendProvisioningReceipt`) now personalized — agent name and flavor in subject and body, Tiger's voice, sends regardless of botUsername. Dead admin-only `triggerProactiveInitiation` block removed from provisioner.
- #222 — fix/M2: `market_miner.ts` refactored `fetchSerper` into `makeSerperFetcher()` factory — per-invocation call counter, no cross-run interference. `tiger_scout.ts` — `getSerperKey()` round-robin rotator added, replaces hardcoded KEY_1 lookups.

**Website:**
- `tiger-bot-website` PR #1: Refund policy section added to tigerclaw.io for Paddle merchant application compliance. 4-card layout covering 7-day money-back, statutory withdrawal rights, subscription cancellation, processing time. Paddle MoR disclosure included.

**Paddle status:**
- Domains approved. Everything else approved. Business name had typos in the application — operator cannot find correction path in portal. Token likely available but deferred. Waiting on final approval.

**Flagged for next session:**
- Deploy PRs #221/#222 to Cloud Run before any customer onboards.
- Agent behavior review — operator flagged conversational quality as a "broken window." Must review `runToolLoop()`, SOUL injection in `buildSystemPrompt()`, and overall agent response quality before John/Jeff/Debbie go through the wizard.

---

## Session 12 — What Was Done (2026-04-05)

Full 8-module ground-truth assessment of the codebase against all foundation documents (Swarm Blueprint, Cognitive Architecture spec, Heartbeat spec, Essential Root Documentation). Results in `MODULE_ASSESSMENT.md`.

**PRs merged:**
- #212 — `fact_anchors` wired into `buildSystemPrompt()` — agents now compound over time
- #213 — Dashboard auth: session token stored at signup, sent on all dashboard API calls
- #214 — Delta scan: `sinceTimestamp` filter in `tiger_scout.ts` — no more rescanning same content
- #215 — `nurture_check` pre-checks `tenant_leads` count — skips LLM when zero leads

**Also fixed:** Vercel root directory misconfiguration — manual deploys now work from CLI.

**Deployed:** Revision `tiger-claw-api-00345-525`. Health confirmed. Wizard 200 OK.

**Key finding:** The product works. Agents hatch, know their ICP, prospect, have personality. The Hive accumulates. The cron fires daily reports. Payment gate and dashboard auth were the two things breaking the customer experience — both now fixed or in flight.

---

## Session 11 — What Was Done (2026-04-04)

Round 2 audit Phase 1 fixes. 5 security holes closed. PR #210 merged and deployed.

- GET/POST /dashboard/:slug were fully unauthenticated
- PATCH/POST /tenants routes were unauthenticated
- saveMarketFact() URL normalization mismatch causing moat duplicates
- All 5 documentation files updated (SOTU, ARCHITECTURE, STATE_OF_THE_TIGER_PATH_FORWARD, CLAUDE.md, SOUL.md)

**Platform state at session end:** 447/447 tests. Revision 00330-6ml.

---

## Post-Deploy Protocol (Mandatory Every Time)

```bash
# 1. Deploy API
gcloud run deploy tiger-claw-api \
  --source ./api \
  --region us-central1 \
  --project hybrid-matrix-472500-k5 \
  --quiet

# 2. Health check
curl https://api.tigerclaw.io/health

# 3. Fix all webhooks
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Deploy wizard (from web-onboarding/ directory)
npx vercel deploy --prod --yes
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
- `tiger_gmail_send` and `tiger_postiz` are NOT in toolsMap by design. Do not re-add them.
- 447 tests must pass before any PR is opened. Run `npm test` from `api/`.

---

## Future Vision (Do Not Build Yet)

**Reflexion Loop:** Outcome signals (which approaches closed leads, which got ghosted) feed back into `fact_anchors` and `hive_signals`. Agent wakes up slightly smarter each morning. Build after 10+ agents have real outcome data.

**Agent Leaderboard:** Opt-in fleet ranking by leads surfaced, pipeline activity, conversion rate. Build after Reflexion Loop is live.

**Affiliate tracking:** Simple `?ref=` tag on signup URL, stored on subscription. Build when Max actually sends his first customer.

Do not mention any of these publicly until built.

---

## Session Protocol

**Start of session:** Run cold start checklist above. Read this file. Read `MODULE_ASSESSMENT.md`. Do not code until you know what is broken.

**End of session:** Update this file before closing. Specifically:
1. Update "Last updated" line
2. Update Live Service Status if anything changed
3. Update Known Open Issues (mark resolved, add new)
4. Add a session summary above

A session that ends without updating this file leaves the next agent blind.
