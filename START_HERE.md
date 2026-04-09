# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-04-09 (Session 17 close — PRs #263–#272 merged)

**Read SOTU.md first. That is the single source of truth. This file is a fast orientation — SOTU has the details.**

**Standing orders: No lying. No assuming. No guessing. Do not mark anything working unless you have tested it live.**

---

## The Most Important Thing to Know

**Check prospect conversations FIRST. Two people were messaging @Brentstiger01_bot at session close (11:40 PM PT). Results unknown. Read their conversations before touching any code.**

**Brents Tiger 01 is live with prospect engagement mode deployed.** Bot description: "Let me take you by the hand and lead you to your brighter future." /start ends with "What's going on for you right now?" Tool names blocked. Internal state blocked.

The full loop (pay → provision → hatch → scout → contact → reply with a real prospect) has not yet closed. That remains day zero. No confirmed successful prospect conversation yet.

**Tiger Strike pipeline confirmed working.** First successful run produced 20 engagement links. Operator received Telegram alert. Fires automatically after 2 AM UTC mine cycle.

---

## What Is Tiger Claw?

AI sales agent SaaS. Operator brings their own Telegram bot token (BYOB) and Gemini API key (BYOK). One-page signup. Agent hatches knowing its ICP — **no interview, no questions asked**. The agent prospects while the operator sleeps.

**The value proposition: Your bot hunts while you sleep.**

- **API:** `https://api.tigerclaw.io` — Cloud Run, `hybrid-matrix-472500-k5`, `us-central1` + `asia-southeast1`
- **Wizard + Dashboard + Admin:** `wizard.tigerclaw.io` — Next.js on Vercel
- **Admin fleet dashboard:** `wizard.tigerclaw.io/admin/dashboard` — token via `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **DB:** Cloud SQL proxy port **5433** locally (NOT 5432), instance `hybrid-matrix-472500-k5:us-central1:tiger-claw-postgres-ha`, user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`
- **No AI agent pushes to main.** All changes via `feat/` or `fix/` branch + PR.

---

## Current Onboarding Path (Paddle — as of Session 16)

```
Operator pays via Paddle checkout (product/price not yet created — do this first)
→ Paddle fires POST /webhooks/paddle (transaction.completed)
→ Webhook provisions user + bot + subscription (pending_setup)
→ Operator navigates to wizard.tigerclaw.io
→ Wizard starts at flavor selection (no email step — Paddle already provisioned)
→ Operator provides: agent name, Telegram bot token, Gemini key
→ POST /wizard/hatch → BullMQ job → bot registered, webhook set, onboard state pre-seeded
→ Bot is immediately operational — no interview required
```

**Payment gate still open (C4):** Direct wizard access bypasses payment. Fix after Paddle loop is proven.

**Active channel: Telegram only.** LINE is future.

---

## Admin Hatch (Operator's Own Fleet)

```bash
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/hatch \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "<BotFather token>",
    "name": "Brents Tiger 02",
    "flavor": "network-marketer",
    "email": "bbryson@me.com",
    "aiKey": "<Gemini key>",
    "product": "Nuskin"
  }'
```

**BotFather rate limit:** ~1 new bot per 8 minutes.

---

## What Is and Is Not Working Right Now

### Infrastructure — OK
- Cloud Run API healthy (revision **00434-c6h** — deployed 2026-04-09)
- Postgres, Redis, Workers (11) all OK
- Telegram webhook delivery + TELEGRAM_WEBHOOK_SECRET wired
- Serper keys (x3) round-robin rotation active
- Oxylabs working — 1,684+ facts per mine run
- Resend email confirmed working
- Admin fleet dashboard operational (`wizard.tigerclaw.io/admin/dashboard`)
- Vercel auto-deploy confirmed working
- Paddle webhook live (`POST /webhooks/paddle`)
- 462/462 tests passing
- Daily mine: Orchestrator → 8 Research Agents (parallel) → Reporting Agent → Strike Pipeline — running at 2 AM UTC
- **Tiger Strike pipeline:** confirmed firing. 20 engagement links generated. Admin alert delivered.
- **Dashboard contrast:** fixed. All labels, sub-text, and buttons readable on dark backgrounds.
- **Prospect engagement mode:** deployed. Bot never exposes internal state, tool names, or operator management language to prospects.

### Not Working / Not Yet Proven
| What | Status |
|------|--------|
| Reddit scout | Blocked — 403 from Cloud Run egress. Oxylabs + Serper fallback active. |
| Paddle checkout | Webhook live but no product/price yet. No checkout URL. |
| Real prospect conversation | Prospect mode deployed but no CONFIRMED successful conversation yet. Two people messaged at session close — check first thing. |
| Payment gate | Open — C4. Fix after Paddle loop proven. |
| Admin alerts | Partial — fail when error message contains underscores (Markdown bug). |
| Cal.com booking | `tiger_book_zoom` built. Deferred — needs platform booking architecture decision first. |
| LINE provisioning | Not active. Future only. |

---

## Current Flavor Registry (8 customer-facing)

network-marketer, real-estate, health-wellness, airbnb-host, lawyer, plumber, sales-tiger, mortgage-broker

Interior-designer removed (was a one-off, not a platform flavor). Files remain on disk dormant.

---

## First Priority This Session

1. **CHECK PROSPECT CONVERSATIONS** — Two people were messaging at session close. Read what they got before touching anything.
2. **Validate prospect engagement mode** — was the conversation warm and human, or did they still get broken responses?
3. **Create Paddle product + price** → get checkout URL. No Paddle path without this.
4. **Fix admin alert markdown bug** — underscores in error messages break Telegram Markdown parser.

---

## Open Work

| Item | Priority |
|------|----------|
| Check overnight prospect conversations — read before coding | DAY ZERO / IMMEDIATE |
| Validate prospect engagement mode end-to-end | IMMEDIATE |
| Create Paddle product + price → get checkout URL | HIGH |
| Fix admin alert markdown bug (underscores break Telegram Markdown) | HIGH |
| Terminate orphan tenant `brents-tiger-01-mnpcril3` | LOW |
| Clean up test debris: FiretestApril5, Teddy Tiger Claw, Tigertest100, etc. | LOW |
| Tiger Test 102 + orphan already suspended — terminate when convenient | LOW |
| C4: Harden payment gate | NEXT (after Paddle loop proven) |
| Past customers owed service: chana.loh@gmail.com, nancylimsk@gmail.com, lily.vergara@gmail.com | WHEN PLATFORM PROVEN |

---

## Rules of Engagement

1. One PR per fix. No chaining unrelated changes.
2. Never push to main directly. Always `feat/` or `fix/` + PR.
3. Architecture is LOCKED. No RAG. No containers. No OpenClaw. No switching from Gemini 2.0 Flash.
4. Do not add features without a customer asking.
5. No agent marks anything complete if known broken items remain.
6. `tiger_gmail_send` and `tiger_postiz` are intentionally NOT in toolsMap. Do not re-add.
7. Post-deploy: run `POST /admin/fix-all-webhooks` (idempotent).
8. **462** tests must pass before any PR is opened. Run `npm test` from `api/`.
9. Read logs before diagnosing. Cloud Run logs are the ground truth.
10. After every PR merge: update RULES.md and SOTU.md.
