# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-04-03 (Session 6)

**Read this first. Then read ARCHITECTURE.md if you need system detail. Do not read anything else until you have finished this file.**

**Standing orders: No lying. No assuming. No guessing. Do not mark anything working unless you have tested it live.**

---

## What Is Tiger Claw?

AI sales agent SaaS. Customer pays on Stan Store → gets email with link → `wizard.tigerclaw.io/signup` → single-page form → bot hatches in 60 seconds. Bot prospects for them on Telegram around the clock.

- **API:** `https://api.tigerclaw.io` — Cloud Run, `hybrid-matrix-472500-k5`, `us-central1` + `asia-southeast1`
- **Signup + Dashboard + Admin:** `wizard.tigerclaw.io` — Next.js on Vercel
- **Admin:** `wizard.tigerclaw.io/admin` — token via `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **DB:** Cloud SQL proxy port **5433** locally (NOT 5432), user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`
- **No AI agent pushes to main.** All changes via `feat/` branch + PR.

---

## Current Payment Flow

Stan Store is the merchant of record. No Zapier. No Stripe.

```
Customer pays on Stan Store
→ Stan Store sends confirmation email with link to wizard.tigerclaw.io/signup
→ Customer clicks link, enters purchase email
→ /auth/verify-purchase creates DB record on-demand if none exists
→ Customer completes single-page form and hatches
```

Stan Store needs to be replaced with Lemon Squeezy or Paddle for international VAT compliance. Not a current priority.

---

## What Is and Is Not Working Right Now

### ✅ Working
- Cloud Run API (postgres, redis, workers, queues all healthy)
- Platform Gemini key + onboarding key
- Telegram bot delivery
- Single-page `/signup` onboarding flow
- Admin dashboard (`wizard.tigerclaw.io/admin`)
- Magic links (short form: `api.tigerclaw.io/go/:code`)
- Scout runs (burst mode, correct default as of today)
- Morning hunt report (7 AM UTC)
- Slash commands (`/dashboard`, `/status`, `/help`)
- Customer dashboard (inline key update, leads view)

### ❌ Broken — Do Not Claim Otherwise
| What | Impact |
|------|--------|
| All 3 Serper keys (403) | Scout finds zero prospects on every tenant. Core product function is broken. |
| Platform emergency Gemini key (expired) | No AI fallback if platform key hits quota |
| Resend not in deploy script | Zero transactional emails in production |
| Vercel auto-deploy broken | Wizard must be deployed manually |
| nurture_check incorrectly calls tiger_scout | Wrong behavior, not yet fixed |
| Reddit returning 403 from Cloud Run | Scout source down, cause under investigation |

---

## Current Tenant Fleet

| Slug | Status | Bot | Notes |
|------|--------|-----|-------|
| `brent-bryson-mnjd321r` | onboarding | @Testtigerfour_bot "Teddy" | Brent's test bot |
| `john-69cd9564` | onboarding | @BGJN8_bot | John — webhook live, has ICP |
| `jeff-mack-69cd955d` | pending | Unassigned | Jeff Mack — magic link sent |
| `justagreatdirector-mne9xtna` | pending | Unassigned | Debbie — magic link sent |
| `john-mnic5pc1` | terminated | — | John's duplicate — terminated |

---

## What LINE Actually Requires

LINE requires a **LINE Official Account** — a business registration at developers.line.biz with a Channel Access Token and Channel Secret. Personal LINE accounts cannot connect to the API. This was the cause of the April 2 Zoom failure. LINE is **deferred to Phase 2/3**. Code is preserved but not exposed in the UI.

---

## Session History (PR Summary)

| Session | PRs | Key Work |
|---------|-----|---------|
| 1–2 | #93–#110 | Initial build |
| 3 | #111–#120 | Fire test fixes, market intel, voice |
| 4 | #121 | Remove trial system |
| 5 (2026-04-01) | #122–#131 | INTERNAL_API_URL fix, value-gap, voice overhaul, morning report, admin dashboard |
| 6 (2026-04-02/03) | #132–#170 | ENABLE_WORKERS fix, customer dashboard, slash commands, April 2 Zoom failure fixes, single-page signup, LINE deferred, TELEGRAM_WEBHOOK_SECRET trailing newline fix, scout waterfall |

---

## Open Work

| Item | Priority | Status |
|------|----------|--------|
| New Serper keys | CRITICAL | Blocked on Brent — get from serper.dev |
| Renew platform emergency Gemini key | HIGH | Update GCP secret |
| Add RESEND_API_KEY to deploy script | HIGH | One-line fix |
| Fix nurture_check calling tiger_scout | MEDIUM | Bug |
| Fix Vercel Root Directory setting | MEDIUM | Vercel project settings |
| Remove Zapier dead code | LOW | Cleanup when convenient |
| Stan Store → Lemon Squeezy migration | LOW | Not a current priority |

---

## Rules of Engagement

1. One PR per fix. No chaining unrelated changes.
2. Never push to main directly. Always `feat/` + PR.
3. Architecture is LOCKED. No RAG. No containers. No OpenClaw.
4. No new features without a customer asking for it.
5. No agent marks anything "COMPLETE" if known broken items remain.
6. Mandatory post-deploy: `POST /admin/fix-all-webhooks`
7. Wizard deploys manually — Vercel auto-deploy is broken.
