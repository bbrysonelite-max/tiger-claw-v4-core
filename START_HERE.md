# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-04-04 (Session 8)

**Read SOTU.md first. That is the single source of truth. This file is a fast orientation — SOTU has the details.**

**Standing orders: No lying. No assuming. No guessing. Do not mark anything working unless you have tested it live.**

---

## What Is Tiger Claw?

AI sales agent SaaS. Customer pays on Stan Store → gets email with link → `wizard.tigerclaw.io/signup` → single-page form → bot hatches in ~2 minutes → bot prospects for them on Telegram around the clock.

**The value proposition:** Your bot hunts while you sleep.

- **API:** `https://api.tigerclaw.io` — Cloud Run, `hybrid-matrix-472500-k5`, `us-central1` + `asia-southeast1`
- **Signup + Dashboard + Admin:** `wizard.tigerclaw.io` — Next.js on Vercel
- **Admin:** `wizard.tigerclaw.io/admin` — token via `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **DB:** Cloud SQL proxy port **5433** locally (NOT 5432), user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`
- **No AI agent pushes to main.** All changes via `feat/` or `fix/` branch + PR.

---

## Current Payment Flow

Stan Store is the merchant of record. No Zapier. No Stripe.

```
Customer pays on Stan Store
→ Stan Store sends confirmation email with wizard.tigerclaw.io/signup link
→ Customer enters purchase email on /signup
→ POST /auth/verify-purchase — creates DB record on-demand
→ Customer fills form: agent name, niche, ICP, Telegram bot token, Gemini key
→ POST /wizard/hatch → bot live in ~2 minutes
```

---

## What Is and Is Not Working Right Now

### ✅ Working
- Cloud Run API (postgres, redis, workers all healthy — revision 00310-pjx)
- Platform Gemini key + onboarding key + emergency key (renewed Session 7)
- Telegram bot delivery + TELEGRAM_WEBHOOK_SECRET baked into deploy
- Single-page `/signup` onboarding flow
- Admin dashboard + fleet dashboard (`wizard.tigerclaw.io/admin`)
- Mine running nightly at 2 AM UTC — Serper fallback active (Reddit 403'd)
- Mine controls in admin dashboard — Run Now button, live status, last run stats
- Scout (burst mode) + morning hunt report (7 AM UTC)
- Resend email — RESEND_API_KEY in deploy, first production email confirmed
- Admin alerts via Telegram (@AlienProbeadmin_bot)
- Slash commands (`/dashboard`, `/status`, `/help`)
- 455 tests passing, CI green

### ❌ Broken / Not Built
| What | Impact |
|------|--------|
| Reddit 403 from Cloud Run egress | Mine uses Serper fallback (working) — awaiting Reddit API approval |
| Vercel auto-deploy broken | Wizard must be deployed manually via Vercel dashboard |
| Jeff / John / Debbie not onboarded | No customers running yet |

---

## Current Tenant Fleet

| Slug | Status | Bot | Notes |
|------|--------|-----|-------|
| `brent-bryson-mnjd321r` | onboarding | @Testtigerfour_bot "Teddy" | Brent's test bot |
| `justagreatdirector-mne9xtna` | pending | — | Debbie — needs to complete wizard |

Jeff Mack and John (Thailand) were wiped for clean re-onboarding. Send them `wizard.tigerclaw.io/signup`.

**Active agents (status = 'active' or 'live'):** 0 — no customers have completed onboarding yet.

---

## Session History (PR Summary)

| Session | PRs | Key Work |
|---------|-----|---------|
| 1–4 | #1–#121 | Initial build, fire test, voice, market intel |
| 5 (2026-04-01) | #122–#131 | INTERNAL_API_URL fix, voice overhaul, morning report, admin dashboard |
| 6 (2026-04-02/03) | #132–#170 | ENABLE_WORKERS fix, customer dashboard, April 2 Zoom failure fixes, single-page signup |
| 7 (2026-04-04) | #174–#185 | 14 silent failures fixed, Serper fallback, RESEND_API_KEY, nurture_check, scoring ceiling, FK guard, webhook secret |
| 8 (2026-04-04) | #186–#187 | Mine dashboard controls, tool safety audit, 43 new tests (455 total), gmail+postiz removed from toolsMap |

---

## Open Work

| Item | Priority |
|------|----------|
| Jeff, John, Debbie complete wizard | IMMEDIATE |
| Fix Vercel Root Directory setting | OPS |
| Per-tenant health indicators in admin fleet table | NEXT |
| Per-tenant drill-down in admin dashboard | NEXT |
| Remove Zapier dead code | LOW |
| Remove Stripe dead code | LOW |

---

## Rules of Engagement

1. One PR per fix. No chaining unrelated changes.
2. Never push to main directly. Always `feat/` or `fix/` + PR.
3. Architecture is LOCKED. No RAG. No containers. No OpenClaw. No switching from Gemini 2.0 Flash.
4. No new features without a customer asking for it.
5. No agent marks anything "COMPLETE" if known broken items remain.
6. `tiger_gmail_send` and `tiger_postiz` are intentionally NOT in toolsMap. Do not re-add.
7. Post-deploy: run `POST /admin/fix-all-webhooks` (idempotent — webhook secret is baked in).
8. Wizard deploys manually — Vercel auto-deploy is broken.
