# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-04-06 (Session 15)

**Read SOTU.md first. That is the single source of truth. This file is a fast orientation — SOTU has the details.**

**Standing orders: No lying. No assuming. No guessing. Do not mark anything working unless you have tested it live.**

---

## The Most Important Thing to Know

**This system has never run in production. Not once.**

No agent has ever had a real conversation with a real prospect. The Paddle webhook is live and provisioning works end-to-end — but the full loop (pay → provision → hatch → scout → contact → reply) has never closed on a real person. That is day zero. Act accordingly.

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

## Current Onboarding Path (Paddle — as of Session 15)

```
Operator pays via Paddle checkout (product/price not yet created — do this first)
-> Paddle fires POST /webhooks/paddle (transaction.completed)
-> Webhook provisions user + bot + subscription (pending_setup)
-> Operator navigates to wizard.tigerclaw.io
-> Wizard starts at flavor selection (no email step — Paddle already provisioned)
-> Operator fills form: agent name, ICP, Telegram bot token, Gemini key
-> POST /wizard/hatch -> BullMQ job -> bot registered, webhook set, ICP loaded
```

**Payment gate still open (C4):** Direct wizard access bypasses payment. Fix after Paddle loop is proven.

**Active channel: Telegram only.** LINE is future.

---

## What Is and Is Not Working Right Now

### Infrastructure — OK
- Cloud Run API healthy (revision 00372-mg2)
- Postgres, Redis, Workers all OK
- Telegram webhook delivery + TELEGRAM_WEBHOOK_SECRET wired
- Serper keys (x3) round-robin rotation active
- Oxylabs working — 209 posts on last mine run
- Resend email confirmed working
- Admin dashboard operational (`wizard.tigerclaw.io/admin`)
- Vercel auto-deploy confirmed working
- Paddle webhook live (`POST /webhooks/paddle`)
- 458/458 tests passing

### Not Working / Not Yet Proven
| What | Status |
|------|--------|
| Reddit scout | Blocked — 403 from Cloud Run egress. Oxylabs + Serper fallback active. |
| Real conversation | Never happened. Day zero. |
| Paddle checkout | Webhook live but no product/price yet. No checkout URL. |
| Payment gate | Open — C4. Fix after Paddle loop proven. |
| Admin alerts | Partial — fail when error message contains underscores (Markdown bug). |
| LINE provisioning | Not active. Future only. |

---

## Current Flavor Registry (9 customer-facing)

network-marketer, real-estate, health-wellness, airbnb-host, lawyer, plumber, sales-tiger, interior-designer, mortgage-broker

Simplified from 13 this session. Files for cut flavors remain on disk (dormant).

---

## First Priority This Session

Close the Paddle payment loop end-to-end. Create a Paddle product + price. Buy it. Watch the webhook provision a bot. Go through the wizard. Watch the bot scout and send a first message. That is the only proof that matters right now.

---

## Open Work

| Item | Priority |
|------|----------|
| Create Paddle product + price → get checkout URL | IMMEDIATE |
| Prove full loop: pay → provision → hatch → scout → contact | IMMEDIATE |
| Fix admin alert markdown bug (underscores break Telegram Markdown) | HIGH |
| C4: Harden payment gate — wizard should require Paddle pre-provisioning | NEXT |
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
