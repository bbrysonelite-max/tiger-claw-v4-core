# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-04-06 (Session 14)

**Read SOTU.md first. That is the single source of truth. This file is a fast orientation — SOTU has the details.**

**Standing orders: No lying. No assuming. No guessing. Do not mark anything working unless you have tested it live.**

---

## The Most Important Thing to Know

**This system has never run in production. Not once.**

No agent has ever had a real conversation with a real prospect. The code is built, the tests pass, the infrastructure is healthy — but the loop has never closed on a live person. That is day zero. Act accordingly.

---

## What Is Tiger Claw?

AI sales agent SaaS. Operator brings their own Telegram bot token and Gemini API key. They go through a one-page signup wizard. Their agent hatches knowing their ICP. The agent prospects while the operator sleeps.

**The value proposition: Your bot hunts while you sleep.**

- **API:** `https://api.tigerclaw.io` — Cloud Run, `hybrid-matrix-472500-k5`, `us-central1` + `asia-southeast1`
- **Wizard + Dashboard + Admin:** `wizard.tigerclaw.io` — Next.js on Vercel
- **Admin panel:** `wizard.tigerclaw.io/admin` — token via `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **DB:** Cloud SQL proxy port **5433** locally (NOT 5432), user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`
- **No AI agent pushes to main.** All changes via `feat/` or `fix/` branch + PR.

---

## Current Onboarding Path (Fragmented — 3 pieces)

```
Operator pays on Stan Store
-> Stan Store confirmation email includes wizard.tigerclaw.io/signup?email= link
-> Operator fills signup form: agent name, niche, ICP, Telegram bot token, Gemini key
-> POST /wizard/hatch -> BullMQ job -> bot registered, webhook set, ICP loaded
```

**Payment gate is open (C4).** Anyone who navigates directly to `/signup` gets a free bot.
Fix: re-wire Zapier -> `/webhooks/stan-store`. Paddle application pending. Stripe fallback available.

**Active channel: Telegram only.** LINE is future.

---

## What Is and Is Not Working Right Now

### Infrastructure — OK
- Cloud Run API healthy (revision 00353-947)
- Postgres, Redis, Workers all OK
- Telegram webhook delivery + TELEGRAM_WEBHOOK_SECRET wired
- Serper keys (x3) round-robin rotation active
- Resend email confirmed working
- Admin dashboard operational (`wizard.tigerclaw.io/admin`)
- Vercel auto-deploy working
- 449/449 tests passing

### Not Working / Not Yet Proven
| What | Status |
|------|--------|
| Reddit scout | Blocked — 403 from Cloud Run egress. Serper fallback active. Oxylabs fix pending. |
| Real conversation | Never happened. Day zero. |
| Payment gate | Open — C4. Zapier re-wire is the fix. |
| LINE provisioning | Not active. Future only. |
| PR #233 deployed | Merged, not yet deployed to Cloud Run. |

---

## Current Flavor Registry (9 customer-facing)

network-marketer, real-estate, health-wellness, airbnb-host, lawyer, plumber, sales-tiger, interior-designer, mortgage-broker

Simplified from 13 this session. Files for cut flavors remain on disk (dormant).

---

## First Priority This Session

Observe one real conversation. One operator, one real prospect, one real exchange — without human intervention. That is the only proof that matters right now.

---

## Open Work

| Item | Priority |
|------|----------|
| Deploy PR #233 to Cloud Run | IMMEDIATE |
| Observe first live conversation | IMMEDIATE |
| C4: Re-wire Zapier -> /webhooks/stan-store + harden verify-purchase | NEXT |
| H2: Oxylabs Realtime API for Reddit 403 | HIGH |
| tiger_drive_list: confirmed safe to remove from toolsMap | LOW |
| Past customers owed service: chana.loh@gmail.com, nancylimsk@gmail.com, lily.vergara@gmail.com | WHEN READY |

---

## Rules of Engagement

1. One PR per fix. No chaining unrelated changes.
2. Never push to main directly. Always `feat/` or `fix/` + PR.
3. Architecture is LOCKED. No RAG. No containers. No OpenClaw. No switching from Gemini 2.0 Flash.
4. Do not add features until the loop closes on a real person.
5. No agent marks anything complete if known broken items remain.
6. `tiger_gmail_send` and `tiger_postiz` are intentionally NOT in toolsMap. Do not re-add.
7. Post-deploy: run `POST /admin/fix-all-webhooks` (idempotent).
8. 449 tests must pass before any PR is opened.
