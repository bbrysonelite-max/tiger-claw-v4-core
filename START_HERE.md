# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-04-02 (Session 6 — customer dashboard, slash commands)
**Author:** Claude Sonnet 4.6

---

## What Is Tiger Claw?

AI sales agent SaaS. Customers buy on Stan Store, walk through a 5-step wizard to configure their bot + AI key + customer profile, hit "Hatch," and get a live AI sales agent. Built on Cloud Run, PostgreSQL, Redis/BullMQ, Gemini/OpenAI.

- **API:** Cloud Run (us-central1), project `hybrid-matrix-472500-k5`
- **Wizard + Admin:** Next.js on Vercel at `wizard.tigerclaw.io`
- **Customer Dashboard:** `wizard.tigerclaw.io/dashboard?slug=their-slug`
- **Admin Dashboard:** `wizard.tigerclaw.io/admin` — token via `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **Architecture:** BYOB (customer's Telegram token) + BYOK (customer's AI key)
- **DB:** Cloud SQL proxy port **5433** locally (NOT 5432), user `botcraft`, DB `tiger_claw_shared`, password `TigerClaw2026Secure`

---

## Current State: LAUNCH DAY — PAYING CUSTOMERS BEING ACTIVATED

### Customers Ready to Hatch (pending_setup, wizard link sent)

| Customer | Email | Paid | Channel |
|----------|-------|------|---------|
| Debbie | `justagreatdirector@outlook.com` | $97 Mar 10 | Telegram |
| Jeff Mack | `jeffmackte@gmail.com` | $147 Mar 26 (Pro) | Telegram |
| John (Thailand) | `vijohn@hotmail.com` | $97 Feb+Mar | LINE (th-th) |

All three: send `wizard.tigerclaw.io` — wizard finds their purchase by email.

### Other Stan Store customers owed agents (not yet in DB)
- `chana.loh@gmail.com` — paid $97 twice
- `nancylimsk@gmail.com` — paid $97 Mar 2
- `lily.vergara@gmail.com` — paid $97 twice

---

## Session 6 PRs (2026-04-02)

| PR | What It Fixed |
|----|--------------|
| #133 | Customer dashboard — inline key update form (replaces wizard redirect), recent leads section, fix key write to `bot_ai_config` |
| #134 | Slash commands — `/dashboard`, `/status`, `/help` intercept before Gemini; `setMyCommands` registers menu at hatch |

---

## Session 5 PRs (2026-04-01) — reference

| PR | What It Fixed |
|----|--------------|
| #122 | value-gap JOIN type cast — `varchar = uuid` crash |
| #123 | `INTERNAL_API_URL` missing from deploy script |
| #124 | bot_pool removed from `/health` |
| #125 | Relevance gate in data refinery |
| #126 | Tiger voice overhaul — 5 conversation examples replace 40-line rules wall |
| #127 | tiger_scout rate limit reason hidden from Gemini |
| #128 | Only `output` string sent to Gemini |
| #129 | Morning hunt report at 7 AM UTC |
| #130 | Admin dashboard timeout fix |
| #131 | Admin dashboard UX — localStorage token, 5min refresh |

---

## Customer Dashboard

**URL pattern:** `wizard.tigerclaw.io/dashboard?slug=their-slug`

Delivered to customers:
1. **Wizard completion screen** — "Access Admin Dashboard" button appears after hatch (already wired)
2. **Slash command** — customer types `/dashboard` in their bot, gets the URL back instantly
3. **Manually** — for Debbie/Jeff/John who hatched before PR #134, look up their slug and send directly:
   ```sql
   SELECT slug FROM tenants WHERE email IN ('justagreatdirector@outlook.com','jeffmackte@gmail.com','vijohn@hotmail.com');
   ```

Dashboard features:
- Inline AI key update (no wizard redirect) — provider selector + key input + Save
- Key validated server-side, encrypted, stored in `bot_ai_config`
- Recent leads section (last 5, score + status + time found)
- LINE setup modal
- Bot status + channel health

---

## Slash Commands (PR #134)

New file: `api/src/services/slashCommands.ts`

| Command | Response |
|---------|---------|
| `/start` or `/dashboard` | Dashboard URL + one-line prompt |
| `/status` | Key health · lead count · last active |
| `/help` | Full command list |

Commands intercept in `queue.ts` before Gemini — zero AI cost. Unknown commands pass through normally.
`registerBotCommands()` called at provisioner hatch → menu appears in Telegram automatically.

**Existing bots (Debbie/Jeff/John):** need `registerBotCommands` called manually against their tokens. Either wait for re-provision or run one-off.

---

## The Woody Response Fix (Session 5 Context)

Three layers were causing "I can't do that for 23 more hours" type responses:
1. **System prompt** (PR #126): Replaced 40-line rules wall with 5 conversation examples.
2. **Tool data leak** (PRs #127, #128): Only `{ output }` passed to Gemini now — raw data fields stripped.
3. **SOUL.md** intact, loaded in every prompt.

---

## Morning Hunt Report (Live)

`daily_scout` fires at 7 AM UTC. Tiger scouts, composes a morning message, sends via Telegram or LINE. Language of Hope fires if pipeline empty.

---

## Admin Dashboard

**URL:** `wizard.tigerclaw.io/admin`
**Token:** see above (gcloud command). Stored in localStorage — no re-entry on refresh.
**Refresh:** every 5 minutes.

---

## Wizard Flow (5 Steps)

1. **StepIdentity** — niche, bot name, operator name, email
2. **StepChannelSetup** — Telegram + LINE (at least one required)
3. **StepAIConnection** — BYOK key + validation
4. **StepCustomerProfile** — ICP data
5. **StepReviewPayment** — "Hatch"

Post-hatch: ICP fast-path sends confident intro, skips calibration interview.

---

## Open Work (Session 7)

| Item | Priority |
|------|----------|
| Merge PR #134 (slash commands) | HIGH |
| Activate remaining Stan Store customers (chana, nancy, lily) | HIGH |
| Confirm Debbie / Jeff / John complete wizard and hatch | HIGH |
| Register slash commands on pre-#134 bots manually | MEDIUM |
| `bot_ai_keys` dead write cleanup | LOW |
| Navigation recovery — dashboard link kills wizard state | LOW |

---

## Active Business

| Deal | Contact | Status |
|------|---------|--------|
| White Label | Max Steingart | 30% affiliate via Stan Store. Must sell 10 first. |
| LINE Distribution | John / Bryson International Group | 21,000 LINE distributors in Thailand |
| Pro customer | Jeff Mack | $147 paid, pending_setup |

---

## Rules of Engagement

1. One PR per fix. No chaining.
2. Never push to main directly. Always `feat/` + `gh pr create`.
3. Architecture is LOCKED. No RAG, no containers, no OpenClaw.
4. No new features without a customer asking for it.
5. The mission: paying customers get a live bot that works.
