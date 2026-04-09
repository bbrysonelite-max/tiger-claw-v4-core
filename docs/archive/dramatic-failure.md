# Dramatic Failure
## April 2, 2026 — Full Honest Account

---

## Context

Brent Bryson, 67 years old. All in. Phone being shut off. Car being repossessed. No food. No runway — runway was "two weeks ago." Every friend leaned on as far as he dares. Completely broke.

Tiger Claw V4 — an AI sales agent SaaS platform. Months of development. PRs #99 through #143+. A 40,000-word planning document. A fire test that passed March 29th. "All phases complete." Multiple "next week" promises to paying customers.

Today was supposed to be the day John's team went live. It was not that.

---

## The Zoom Call — What Actually Happened

John (vijohn@hotmail.com) — a paying customer in Thailand with a team. Scheduled Zoom call to get his agent live. Brent personally on the call to walk him through onboarding.

### What broke, in order:

**1. `app.tigerclaw.io` — DNS does not exist**
The URL given to John did not resolve. `NXDOMAIN`. The domain was never created. The real domain is `wizard.tigerclaw.io` — Brent confirmed both domains are visible, meaning the wrong URL was being used for the entire session. Every customer-facing URL shared during the crisis was wrong.

**2. LINE vs. Telegram confusion**
John is in Thailand. Tiger Claw's LINE integration requires a LINE Official Account — a business registration at developers.line.biz with a Channel Access Token and Channel Secret. John has a personal LINE account. These are entirely different things. LINE deliberately walls off personal accounts from API access. This was not communicated to John before the call. Thirty-minute detour. Dead end.

**3. The Telegram spinning wheel**
Switched John to Telegram. StepChannelSetup calls `api.telegram.org/getMe` directly from the browser with no timeout. If the request hangs, `setValidating` never flips to false. Infinite spinner. No error. No timeout. John watched it spin.

**4. Webhook registered to the wrong tenant**
John's Telegram bot token (8701848199:AAHc76cS9ntJjclg55ZYSCKoyjfN0IAUyBQ, @BGJN8_bot) had previously been registered to a different tenant (`da10b1b5-a25a-48d6-ba6c-c096182d5ab6`). When the webhook fired, it went to the wrong bot. Every message John sent went nowhere.

**5. Webhook registered without the secret token**
When the webhook was manually re-registered to John's correct tenant ID, the `TELEGRAM_WEBHOOK_SECRET` was not included. The API requires this header (`X-Telegram-Bot-Api-Secret-Token`) on every inbound request. Without it, every message returned `401 Unauthorized`. Silently. John saw nothing. The bot said nothing.

**6. No AI key — never completed the wizard**
John went through the wizard multiple times. The wizard was never successfully completed. No AI key was installed via the normal flow. The key that exists in the DB (`AIza...qmgI`, Google Gemini) was installed during a previous attempt — it was there, but the bot was suspended before it could be used.

**7. Status: suspended**
John's tenant had been suspended with reason: "Webhook attachment failed: Telegram Webhook failed: Not Found." This happened on a prior attempt. Status was manually reset to `onboarding` and then `active` during the call via direct DB queries. Not via any admin UI. Via psql.

**8. Admin dashboard not loading**
The admin dashboard at `wizard.tigerclaw.io/admin/dashboard` was not loading for Brent during the call. He was flying blind with no visibility into what was happening. All diagnosis was done via curl, psql, and Telegram API calls — none of which are tools an operator should need.

**9. The ICP was there all along**
After all of this, the bot state was checked in the correct location (`t_24e0352c_4e47_4ab4_86ea_f632a9402437.bot_states`). John's ICP was fully loaded and correct:
- Ideal customer: 20-70 yrs old, wrinkles/acne/lines
- Not working: cheap products
- Platforms: Facebook, LINE, WhatsApp, TikTok, LinkedIn, Instagram, Blue Sky
- Prospect: smart, hungry, ambitious, wants more in life, aggressive, works hard
- Phase: complete

The product worked. The delivery infrastructure failed.

**10. John could not be reached**
After all fixes were applied — webhook correct, secret token included, status active, ICP loaded — John had left the call. His Telegram chat ID was never captured because no message ever made it through successfully. The bot cannot send first without a chat ID. John cannot be asked to try again. He is done.

---

## The Damage

- John's deal: gone
- Revenue from John: gone
- $21,000 referenced as lost opportunity
- Toon (phaitoon2010@gmail.com): 3 bots in DB, never had a good experience, not paying, quit
- Jeff Mack (jeffmackte@gmail.com): pending, likely refund
- Debbie: pending, likely refund
- Revenue from Spain: likely refund
- Revenue from Thailand (John): likely refund
- Stan Store: needs to be replaced (Lemon Squeezy or Paddle) due to merchant of record / VAT issues for international customers

---

## What Was Diagnosed But Not Fixed Today

- Webhook registered without secret token in provisioner (root cause of silent 401s)
- No timeout on Telegram token validation (spinner bug — fix was written and pushed to PR #144 but not deployed)
- Admin dashboard not loading (cause not fully diagnosed — frontend may have a build/deploy issue)
- `app.tigerclaw.io` vs `wizard.tigerclaw.io` — wrong domain being shared
- No fallback or retry when provisioning fails — tenant gets suspended silently, operator has no visibility
- LINE channel setup has no guidance that a LINE Official Account is required

---

## The Bigger Picture — Brent's Own Words

"At two and a half hours per onboard, it will take me until I'm 90 years old to have 50 people on the platform."

"The platform is just not ready."

"The little boy who cries wolf. I've used that sentence... you don't know how many times I've done exactly that."

"I'm 67 years old. I'm the least. If you were gonna point to the guy in the room that would be likely to succeed, it certainly sure as hell wouldn't be me."

"I had a 40,000-word planning document. That's all out the window."

"I am all the fucking way in."

"My cell phone is being turned off. My car is being repossessed. My real runway is two weeks ago."

"I have no food."

---

## What Brent Identified As The Real Problem

The wizard is the wrong pattern. Asking a non-technical customer to connect infrastructure step by step — channel first, then AI key, then review — creates failure points at every step and kills momentum.

The right model: one page, fill everything out, one button at the end. Everything visible. Nothing hidden. One submit.

---

## The New Direction (Not Yet Acted On)

- No more platform changes until a PRD exists
- Replace Stan Store with Lemon Squeezy or Paddle (merchant of record, handles VAT globally)
- Replace the wizard with a single-page onboarding form
- Founding 50 program: $50/month, first 50 customers, honest about the rough edges
- One clean end-to-end flow that works without the founder in the room

---

## Honest Assessment

The bones are solid. The AI works. The nurture check ran at 4 AM. The ICP loaded correctly. The data pipeline is real.

But the delivery layer — provisioning, webhooks, domain routing, error handling, admin visibility — has too many silent failure modes for paying customers. Tonight proved it in the worst possible way, in front of a paying customer with a team, on a Zoom call, in real time.

This was not a product failure. It was an infrastructure and process failure. The distinction matters because it is fixable. But it has to be fixed before the next customer, not during.

---

*Written April 2, 2026. Nothing omitted. Nothing softened.*
