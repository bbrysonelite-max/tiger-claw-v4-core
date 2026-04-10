# START HERE — Tiger Claw Session Brief

**Last Updated:** 2026-04-10 late-night (Session 19 close + data fix verified live — revision 00456-9rb)

**Read SOTU.md first. This file is a fast orientation. SOTU has the details.**

**Standing orders: No lying. No assuming. No guessing. Do not claim anything works unless you have tested it live.**

---

## Current State (Verified 2026-04-10)

- **1 active bot:** `brents-tiger-01-mns7wcqk` (Tiger Proof, Nu Skin) — webhook set, onboard_state corrected and **verified live 2026-04-10 00:49 UTC** (first real-intelligence prospect response).
- **No open PRs.**
- **Cloud Run:** healthy, revision `tiger-claw-api-00456-9rb`
- **Tests:** 456/456 passing

---

## What Tiger Claw Is

AI sales agent SaaS. Operator brings their own Telegram bot token (BYOB — from BotFather) and their own Gemini API key (BYOK). Bot hatches knowing its ICP. The agent prospects while the operator sleeps.

- **API:** `https://api.tigerclaw.io` — Cloud Run, `hybrid-matrix-472500-k5`, `us-central1`
- **Admin dashboard:** `wizard.tigerclaw.io/admin/dashboard`
- **Admin token:** `gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5"`
- **DB (local):** Cloud SQL proxy port **5433** (NOT 5432), user `botcraft`, DB `tiger_claw_shared`
- **No AI agent pushes to main.** All changes via `feat/` or `fix/` branch + PR.

---

## Onboarding Path (Paddle)

```
Operator pays via Paddle checkout
→ Paddle fires POST /webhooks/paddle (transaction.completed)
→ Webhook: creates user + bot + subscription (pending_setup)
→ Operator navigates to wizard.tigerclaw.io
→ Wizard: flavor selection → agent name → Telegram bot token → Gemini key
→ POST /wizard/hatch → BullMQ job → bot registered, webhook set, onboard_state pre-seeded
→ Bot immediately operational — no interview required
```

**Paddle product + price not yet created.** No checkout URL exists. This must be done before the full flow can be tested.

**Payment gate is open (C4).** Direct wizard access bypasses payment. Fix after Paddle loop proven.

---

## Admin Hatch (Provision a Bot Directly)

For founding members, comped bots, and operator's own bot. Requires `product` to get real identity:

```bash
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/hatch \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "<BotFather token>",
    "name": "<bot persona name>",
    "flavor": "network-marketer",
    "email": "bbryson@me.com",
    "aiKey": "<Gemini key>",
    "product": "<what they sell — required for bot to have real identity>"
  }'
```

**`product` is required.** Without it, the bot wakes in `phase="identity"` and cannot represent the operator until identity is completed. This is intentional — a bot with no identity gives broken responses.

**BotFather rate limit:** ~1 new bot per 8 minutes.

---

## First Priorities Tomorrow Morning

1. **Verify prospect conversation quality at scale.** Tonight proved intelligence exists with 2–3 messages. Run a proper verification pass with 5–10 realistic prospect openings (transition scenarios, skeptics, quick "what is this?" questions, objection openers, multi-language). The result is the diagnostic that tells us where the voice examples need to focus.
2. **Write voice examples for the network-marketer flavor.** Bot now responds intelligently but in a generic "helpful assistant" tone. Brent writes examples in his own voice; Claude Code wires them into the flavor system prompt. Test again with the same prompts from step 1 and compare.
3. **Restore Gemini key validation at wizard hatch.** Key tester was removed in the one-page rewrite and never restored. MUST be back in before any paid customer hatches.
4. **Confirm mine has a dedicated Gemini key.** Suspected missing during tonight's diagnosis. Trace the mine's intelligence path.
5. **Verify admin hatch route uses new field names + wider dead-schema audit.** fdfc803 was sending `icpBuilder`/`icpCustomer` 18 minutes after PR #281 renamed them. Audit current admin hatch + any other callers still sending old schema. **Also audit `specs/PHASE_1_SIGNUP.md`** — contains current-tense references to `customerProfile` (line 110, line 218) as if the field still exists and is still read by `buildSystemPrompt()`. It does not — deleted in PR #282, cleaned up in PR #288. Spec doc needs current-tense rewrite to reflect `icpProspect`/`icpProduct`. This is a drift landmine for anyone reading the spec to build against it.
6. **Create Paddle product + price** — no checkout URL exists. Paddle payment path completely unproven.

---

## What Works (Verified)

| System | Status |
|--------|--------|
| Cloud Run API | ✅ Healthy |
| Postgres, Redis, Workers | ✅ All OK |
| Telegram webhook delivery | ✅ Wired |
| Serper keys (×3) | ✅ Active |
| Oxylabs mine | ✅ 684 facts on last run |
| Resend email | ✅ Working |
| Admin fleet dashboard | ✅ Operational |
| Vercel auto-deploy | ✅ Working |
| Paddle webhook | ✅ Live |
| Tiger Strike pipeline | ✅ Confirmed: 20 engagement links on first run |
| Prospect engagement mode | ✅ Deployed (PR #270) |
| 456 tests | ✅ All passing |

## What Does Not Work

| Item | Status |
|------|--------|
| Paddle checkout | No product/price created — no URL exists |
| Reddit scout | 403 from Cloud Run egress — Oxylabs + Serper fallback active |
| Admin alert markdown | Fails when error text contains underscores |
| Payment gate (C4) | Open — anyone can access wizard without paying |
| Cal.com booking | Built (`tiger_book_zoom`). Inactive pending architecture decision. |
| LINE | Deferred — requires LINE Official Account |

---

## Rules of Engagement

1. One PR per fix. No chaining.
2. Never push to main. Always `feat/` or `fix/` + PR.
3. Architecture is LOCKED. No RAG. No containers. No OpenClaw. Gemini 2.0 Flash only.
4. No features without a customer asking.
5. **456 tests** must pass before any PR is opened.
6. `tiger_gmail_send` and `tiger_postiz` are intentionally NOT in toolsMap. Do not re-add.
7. Post-deploy: run `POST /admin/fix-all-webhooks` (idempotent).
8. Read Cloud Run logs before diagnosing anything.
9. After every PR merge: update SOTU.md and STATE_OF_THE_TIGER_PATH_FORWARD.md.
10. BYOB only. There is no bot pool. See RULES.md Rule 15.
