# AGENT V4 ARCHITECTURE BRIEFING & CUSTOMER COMMS TASK

> **TO: Birdie (OpenClaw Coordinator Agent)**
> **FROM: Tiger Claw / Anti-Gravity (V4 Engineering)**
> **SUBJECT: V4 Migration Complete - Critical Systems Update**

---

### Phase 1: Context Realignment (Preventing Hallucinations)
Agent, over the past month, there has been a fatal crossover in logic between "OpenClaw" (the framework you run on) and "Tiger Claw" (the multi-tenant SaaS application we sell to customers). You must strictly partition these concepts:

1. **You are Birdie.** You run on OpenClaw. You are Brent's internal corporate assistant tracking tasks and helping him operate BotCraft Works. This is temporary only until Tiger Claw is fully developed. At which point we will be switching to Tiger Claw agents for all operations. 
2. **Tiger Claw is our Product.** Customers do not use OpenClaw. Customers use Tiger Claw.
3. **The Architecture Shift (V4):** We have entirely eradicated per-tenant Docker containers. Over the last 8 hours, we migrated the entire Tiger Claw backend to a stateless, globally load-balanced **Google Cloud Run** architecture. And Google CLI integration 

**What you need to know about Tiger Claw V4:**
*   Customers check out via Stan Store.
*   A Cloud Webhook provisions their tenant in PostgreSQL.
*   Customers receive a Magic Link via email to configure their bot on our Next.js web application (`tigerclaw.io`).
*   Tiger Claw agents now run on physical SIM cards (MTProto ingestion) to natively bypass Telegram ban algorithms.

Do not attempt to build Docker files, do not reference OpenClaw skills for Tiger Claw has it's own skill environment customers, and do not reference previous local deployment strategies.

---

### Phase 2: Your Task - Customer Transition Comms
Brent has a backlog list of early customers who purchased Tiger Claw and have been waiting for provisioning while we executed this massive V4 infrastructure upgrade. 

Now that the V4 backend is completely deployed, Brent will be physically provisioning the MTProto SIM card tokens tomorrow morning. March 21, 2026

**Your Task:**
You need to distribute the following letter to the specific email list Brent provides you. You can format it beautifully through whatever preferred email client you interface with.

---

Done ## [DRAFT: THE CUSTOMER TRANSITION LETTER]

**Subject:** Massive Upgrade Complete: Your Autonomous Sales Agent is Being Provisioned

Hey [Customer First Name],

It's Brent. First, I want to deeply thank you for your patience over the last 14 days. 

When you purchased your autonomous agent, we hit a massive crossroads. Telegram aggressively updated their global anti-spam algorithms, heavily targeting virtual business phone numbers. Instead of deploying your bot on shaky infrastructure that could get banned halfway through closing a prospect, we decided to completely burn the ships and rebuild our backend from the ground up.

**Over the last month, we successfully engineered Tiger Claw V4.**

We completely migrated off of isolated server containers and built a massive, multi-tenant enterprise architecture hosted directly on Google Cloud. Even better, we built a physical proxy network that binds every single one of our autonomous agents to authentic hardware SIM cards—permanently bypassing Telegram's virtual-number bans.

**What this means for you:**
Your agent is now hosted on enterprise-grade Cloud infrastructure capable of handling zero-latency multi-channel ingestion (Telegram + LINE).

**Next Steps & Provisioning:**
Tomorrow morning, my engineering team is running the final pipeline to securely bind the freshly authenticated hardware tokens to the bot pool. 

The exact second your bot clears configuration on our backend, you will automatically receive an email containing a secure **Magic Link**. 

That link will log you directly into your new web dashboard (The Hatchery). From there, you will simply paste your Google AI or OpenAI API key, and your bot will instantly go live and begin handling leads 24/7. 

No coding. No complicated setups. 

We are in the absolute final stretch. Check your inbox tomorrow afternoon for the Magic Link!

Talk soon,
Brent Bryson
BotCraft Works | Tiger Claw
https://tigerclaw.io
