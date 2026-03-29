# STAN STORE AUDIT (2026-03-29)

## PART 1 — WEBHOOK URL CONFIGURATION (CRITICAL)

The fire test failed because the webhook never reached the Tiger Claw API.

### Required Configuration in Stan Store Dashboard:
1. **Target URL:** `https://api.tigerclaw.io/webhooks/stripe`
2. **Event:** `checkout.session.completed` (or equivalent "Purchase" event)
3. **Secret Verification:** Verify the Stripe signing secret matches the `tiger-claw-stripe-webhook-secret` in GCP Secret Manager.

*Note: If Stan Store handles Stripe directly, the webhook must be configured in the Stripe Dashboard connected to Stan Store.*

---

## PART 2 — PRODUCT DESCRIPTIONS UPDATE

### Product 1: Tiger-Claw Pro ($147/mo)
**URL:** [Tiger-Claw Pro](https://stan.store/brentbryson/p/tired-of-manually-searching-for-leads-)

**Proposed New Description:**
> **The Ultimate AI Director of Operations for High-Volume Distributors.**
>
> Stop answering the same 5 questions every day. Tiger-Claw Pro gives you a 24/7 AI agent that clones your expert leadership, handles prospect objections, and trains your team while you sleep.
>
> **The Intelligence Layer:**
> Tiger Claw IS the brain. We provide the 18 function-calling tools, the memory architecture, and the cross-tenant "Hive Intelligence" that makes your agent a top-tier closer from day one.
>
> **BYOB + BYOK Model:**
> - **Bring Your Own Bot:** Connect your own Telegram or LINE bot in seconds.
> - **Bring Your Own Key:** Use your own AI API key (Gemini, OpenAI, Grok, etc.) for full privacy and zero markup on computation costs.
>
> **Features:**
> - 15 Pre-Trained Industry Flavors
> - Bulletproof Objection Handling
> - Simultaneous Multi-Agent Logic
> - 130+ Languages Supported Natively
> - 4-Step "Hunter Workbench" Setup (under 60 seconds)
>
> **Guarantee:** 7-Day Money-Back Guarantee. No questions asked.

### Product 2: Industry Agent ($197/mo)
**URL:** [Industry Agent](https://stan.store/brentbryson/p/custom-agent-flavor)

**Proposed New Description:**
> **Deep-Domain Intelligence for Specialized Industries.**
>
> Deploy a highly-specialized AI agent pre-trained for specific high-ticket industries. Whether it's Real Estate, Mortgage Brokering, or Health & Wellness, your agent hits the ground running with the exact scripts and domain knowledge required to convert.
>
> **The v5 Data Refinery:**
> Your agent is powered by our autonomous market-mining engine, processing thousands of real-world intent signals every 24 hours to keep your scripts ahead of the market.
>
> **BYOB + BYOK Model:**
> - Full control over your bot and your AI provider.
> - Enterprise-grade encryption (AES-256-GCM).
> - Set primary and backup keys for zero downtime.
>
> **Included:**
> - All 18 Sales & Prospecting Tools
> - "Tiger Hive" Collective Intelligence
> - Multi-Channel Support (Telegram + LINE)
> - Fast-Track Priority Support
>
> **Guarantee:** 7-Day Money-Back Guarantee. No questions asked.

---

## PART 3 — WEBSITE LINKS (tiger-bot-website)

Verified `tiger-bot-website/index.html` links:
- Pro: `https://stan.store/brentbryson/p/tired-of-manually-searching-for-leads-` ✅ (Matched)
- Industry: `https://stan.store/brentbryson/p/custom-agent-flavor` ✅ (Matched)

No updates needed to website slugs at this time.
