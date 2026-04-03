# Phase 1 — Self-Serve Signup
## Product Requirements Document

**Status:** Approved for build
**Decision date:** 2026-04-03
**Author:** Brent Bryson + Claude Sonnet 4.6

---

## The Goal

A paying customer receives a link after purchasing on Stan Store. They click it, land on one page, fill it out, and hit Launch. Their bot is live. Brent is not involved. The customer never needs help.

This replaces the 5-step wizard entirely for new customers.

---

## Definition of Done

A customer in Thailand or Spain, who has never spoken to Brent, can:
1. Click the link from their Stan Store receipt email
2. Land on the signup page
3. Configure their agent in under 10 minutes
4. Hit Launch
5. Receive a confirmation that their bot is live
6. Open Telegram, message their bot, and get a response

If that works without Brent in the room, Phase 1 is complete.

---

## Payment Platform Note (Read Before Building)

Stan Store will be replaced with Lemon Squeezy or Paddle in Phase 2 (merchant of record — required for international VAT compliance). That migration may change the entry point entirely and could remove the email verification step below. **Build the email gate as an isolated, removable component.** The rest of the page must not depend on it structurally.

---

## Entry Point

**No change to the Stan Store → Zapier → webhook flow.** That works.

After payment, Stan Store sends the customer an email. The link in that email goes to `wizard.tigerclaw.io` with no parameters — Stan Store cannot pass the email in the URL. This was confirmed by testing on 2026-04-03.

The page opens with a single gate field before the form renders:

> **Welcome to Tiger Claw.**
> Enter the email you used to purchase and we'll get your agent configured.
> `[ your@email.com ]` `[ Continue → ]`

On Continue, the page calls `/wizard/auth/verify-purchase?email={email}`. If the purchase is valid, the gate disappears and the full form renders. If not: "No purchase found for this email. Check your Stan Store receipt or contact support."

**Build this gate as a standalone isolated component.** When the platform migrates to Lemon Squeezy or Paddle in Phase 2, this gate will likely be removed or replaced. The form sections below must not depend on it structurally.

The customer never creates a password. The email they type is the key.

---

## The Page — Section by Section

The page is a single scrollable form. All sections are visible at once. No steps. No progress bar. No state to lose.

---

### Section 1 — Choose Your Agent Type

**Headline:** `What kind of agent do you want?`

A grid of cards. One tap selects a flavor. The selected card highlights. Nothing else happens until they tap one — it's the first thing on the page and it sets the tone for everything below.

**Available flavors (14 cards):**

| Key | Display Name |
|---|---|
| `network-marketer` | Network Marketer |
| `real-estate` | Real Estate Agent |
| `health-wellness` | Health & Wellness |
| `personal-trainer` | Personal Trainer |
| `mortgage-broker` | Mortgage Broker |
| `lawyer` | Lawyer / Attorney |
| `airbnb-host` | Airbnb Host |
| `interior-designer` | Interior Designer |
| `dorm-design` | Dorm & Small Space Designer |
| `baker` | Baker / Pastry Chef |
| `candle-maker` | Candle Maker / Artisan |
| `gig-economy` | Gig Economy Guide |
| `plumber` | Plumber / Trades Professional |
| `sales-tiger` | Sales Tiger |

Each card shows the display name and a one-line description of what the bot hunts for (pulled from the flavor config `description` field).

No "other" option in Phase 1. If their niche isn't listed, they pick the closest one. New flavors can be added server-side with no frontend changes required.

---

### Section 2 — Name Your Agent

**Headline:** `Give your agent a name`

One field:
- **Agent name** — `What should your agent be called?` (e.g. "Tiger", "Max", "Scout")

This becomes the Telegram bot's display name via `setMyName` during provisioning. Keep it short. Plain text input, 30 character max.

---

### Section 3 — Describe Your Ideal Customer

**Headline:** `Who are you trying to reach?`

Three plain-English fields. Not a form. Not a survey. Three sentences they write about their own business.

1. **Who they are** — `Describe your ideal customer in one sentence.`
   *Example: "Ambitious women 30–50 who are tired of their 9-to-5 and want financial independence."*

2. **What they want** — `What problem are they trying to solve, or what do they want more of?`
   *Example: "They want a side income they can run from their phone without quitting their job."*

3. **Where they are** — `Where do they spend time online?`
   *Example: "Facebook groups, Instagram, TikTok, LinkedIn."*

These three fields populate `customerProfile` in `onboard_state`, which `buildSystemPrompt()` reads on every message. This is the fine-tuning. This is where the customer's effort goes. Do not reduce it further — the thought they put in here directly determines how well their bot performs.

Helper text beneath the section:
> *Your agent reads this before every conversation. The more specific you are, the better it hunts.*

---

### Section 4 — Connect Telegram

**Headline:** `Connect your Telegram bot`

One field with inline validation (already built and deployed in PR #146):
- **Bot token** — `Paste your bot token from @BotFather`

Inline validation fires 700ms after they stop typing. Shows spinner → checkmark (valid) or error (invalid/timeout).

Guidance shown above the field at all times (not hidden behind a tooltip):
> **Step 1:** Open [@BotFather](https://t.me/botfather) in Telegram
> **Step 2:** Send `/newbot` — choose a name, then a username ending in `bot`
> **Step 3:** Copy the HTTP API token BotFather gives you and paste it here

The @BotFather link opens in a new tab. On mobile it opens the Telegram app directly.

---

### Section 5 — AI Key

**Headline:** `Add your AI key`

One field:
- **Gemini API key** — `Paste your Google Gemini API key`

Guidance shown above the field at all times:
> **Get a free key in 60 seconds:**
> 1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
> 2. Sign in with your Google account
> 3. Click **Create API key** — copy it and paste it here
>
> *You need a Google account. Most people already have one (Gmail, YouTube, Android).*

Key is validated on submit (not inline — avoid extra round trips). If invalid, the Launch button shows an error pointing at this field.

Supported provider in Phase 1: **Gemini only.** The field auto-detects `AIza...` prefix and sets provider to `google`. No provider selector UI. Other providers (OpenAI, Grok, OpenRouter) available in Phase 2 via the customer dashboard.

---

### The Launch Button

Full-width button at the bottom of the form:

```
[ LAUNCH MY AGENT → ]
```

On click:
1. Validate all required fields client-side (flavor selected, agent name filled, 3 ICP fields filled, bot token valid, AI key present)
2. Show loading state: spinner + `"Launching your agent..."`
3. Call backend (see Backend Integration below)
4. On success → Success State (below)
5. On error → show specific error inline at the field that caused it

Required fields: flavor, agent name, all 3 ICP fields, bot token (validated), AI key.
Optional: nothing. Everything listed is required.

---

## Success State

The form is replaced (same page, no redirect) with:

```
✅ Your agent is live.

[Agent Name] is ready to hunt.

Open Telegram and message @[botusername] to meet your agent.

→ [Open Telegram]
```

The "Open Telegram" button is a `tg://resolve?domain=[botusername]` deep link — opens the Telegram app directly on mobile, opens Telegram Web on desktop.

A second line beneath:
> *Your agent will send you a morning report every day. Expect your first one tomorrow at 7 AM.*

That's it. No dashboard redirect. No account to log into. No next steps. The customer opens Telegram and meets their bot.

---

## Backend Integration

This page calls three existing endpoints in sequence:

**On page load:**
```
GET /wizard/auth/verify-purchase?email={email}
```
If valid → unlock form. If not → show error.

**On Launch:**
```
POST /wizard/hatch
{
  botId: string,           // from verify-purchase response
  name: string,            // agent name (Section 2)
  flavor: string,          // flavor key (Section 1)
  telegramBotToken: string, // validated token (Section 4)
  aiKey: string,           // Gemini key (Section 5)
  customerProfile: {       // ICP fields (Section 3)
    whoTheyAre: string,
    whatTheyWant: string,
    whereTheyAre: string,
  },
  preferredChannel: "telegram",
  region: "us-en",         // default
  language: "en",          // default
}
```

The existing `/wizard/hatch` endpoint handles provisioning, webhook registration, ICP pre-load, and status → onboarding. No backend changes required for Phase 1.

---

## What Is Explicitly NOT in Phase 1

| Item | Decision | When |
|---|---|---|
| LINE channel | Out. Code preserved, do not delete. Customers bring their own Channel Access Token + Channel Secret. | Phase 2/3, when there's demand |
| Multiple AI providers (OpenAI, Grok, OpenRouter) | Out. Gemini only. | Phase 2 via customer dashboard |
| Custom flavor / "none of these fit me" | Out. Pick closest. | Phase 2 — new flavors added server-side |
| Platform-provided AI key (we pay) | Out. BYOK required. | Possible Phase 2 business model decision |
| Email/password account creation | Out. Link is the key. | Not planned |
| Customer dashboard | Out. That is Phase 2. | Phase 2 |
| Mobile-specific UI | In scope — must be fully usable on mobile, but no native app |

---

## Build Notes for the Implementing Agent

1. **This is a new page, not a modification of the existing wizard.** Create `web-onboarding/src/app/signup/page.tsx`. The 5-step wizard at `web-onboarding/src/components/wizard/` is untouched — it remains for any existing customers or admin use.

2. **The Telegram validation component already exists** (`StepChannelSetup.tsx` — 8s timeout, AbortController, clear error states). Extract the token input + validation logic into a shared component. Do not duplicate it.

3. **The flavor cards** need display name + one-line description. Both are in the flavor config (`displayName` and `description` fields). Fetch them from `GET /admin/flavors` or import directly in the frontend — do not hardcode copy.

4. **The page must work on mobile.** Most customers will click the Stan Store email link on their phone. Test at 390px width minimum.

5. **Error states must be specific.** "Something went wrong" is not acceptable. Every error points at the field that caused it with a plain-English explanation.

6. **The success state bot username** comes from the `/wizard/hatch` response (the provisioner returns `tenant.slug` and the bot's Telegram username after `setMyName` runs). Wire it through.

7. **No new dependencies** without a strong reason. This is a form. It does not need a form library.

---

## Open Questions (Resolved)

| Question | Decision |
|---|---|
| How does customer arrive? | Stan Store link with email param. Existing verify-purchase flow. No change. |
| AI key required or optional? | Required. Guided with direct link to AI Studio. Gemini only. |
| LINE in Phase 1? | No. Deliberately deferred. Code preserved. |
| Right amount of friction? | Zero on entry, guided on token + key, intentional on ICP. |
