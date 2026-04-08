# What Tiger Claw Does

## The One-Sentence Version

Tiger Claw is an AI agent that hunts for qualified prospects 24/7 and books them into the operator's calendar — so the operator wakes up with meetings, not leads.

---

## The Designed Experience (Vision — Not All Live Yet)

This is what the platform is being built to do. Items marked ⚠️ are not yet live.

### Signup — Single Page, 5 Sections ✅ Live

The wizard is a single scrolling page at `wizard.tigerclaw.io`. All sections visible at once. No modal steps.

1. **What kind of agent do you want?** — 9 flavor cards (Network Marketer, Real Estate Agent, Health & Wellness, Mortgage Broker, Lawyer/Attorney, Airbnb Host, Interior Designer*, Plumber/Trades, Sales Tiger)
2. **Give your agent a name** — display name, 30 char limit
3. **Who are you trying to reach?** — ideal customer description, problem, where they spend time online
4. **Connect your Telegram bot** — BotFather instructions + token input (AES-256-GCM encrypted)
5. **Add your AI key** — Gemini API key from aistudio.google.com
6. **LAUNCH MY AGENT** button

The ICP questions in section 3 give the operator a sense of ownership — they feel like they're programming their agent. This is intentional. Do not remove or simplify the wizard.

*⚠️ Interior Designer shows in the wizard but was cut from the API flavor registry (PR #233). Bug — anyone selecting it gets an agent with no valid flavor on the backend. Needs to be removed from `web-onboarding/src/app/signup/page.tsx`.

### After Signup
The agent hatches immediately — calibrated, hunting-ready, no interview. ✅ Live (PR #255)

The operator sets their availability: one or two Zoom slots per day. ⚠️ Calendar UI not yet built.

### Every Day After That
- Agent hunts for qualified prospects using the Data Mine ✅ Mine running
- Agent engages publicly, drives inbound ⚠️ Tiger Strike Engage not yet wired
- Agent qualifies in conversation ✅ Built
- When a prospect is ready: agent offers a Zoom slot and books it ⚠️ Cal.com booking not yet built
- Operator shows up to the Zoom and closes the deal

### The Deliverable
**Booked calls.** Not leads. Not conversations. Not CRM entries. A human being on a Zoom at a specific time, already warmed up, already interested.

---

## Current Reality (2026-04-08)

| Item | State |
|------|-------|
| Agent hatches calibrated, no interview | ✅ Live — PR #255 |
| Wizard | ✅ Live — 5 steps, working, do not change |
| First impression in 4 languages | ⚠️ Not built |
| Cal.com Zoom booking | ⚠️ Not built — `tiger_book_zoom` tool does not exist |
| Tiger Strike Engage wired to mine | ⚠️ Not built — 1,679 facts unengaged |
| Scout run for any real tenant | ⚠️ Never triggered in production |
| Real prospect conversation | ⚠️ Zero — messages table empty |
| Paddle checkout URL | ⚠️ No product/price created yet |

---

## The Agent's Mission (NM Flavor)

**Goal:** A booked Zoom appointment — or, eventually, a closed sale.

Hunt for people showing signs of:
- Dissatisfaction with their current income
- Interest in a side income or business opportunity
- Open to a conversation about financial independence

Qualify them in natural conversation. When intent is clear: offer one Zoom slot. Get the yes. Book it. Report to operator.

The agent does not close. The agent gets the prospect to the 1-yard line. The operator punches it in on the call.

---

## What the Agent Can Do

The Telegram channel is just the tunnel — the intelligence behind it is a full agent with a working skillset.

| Skill | What It Does |
|-------|-------------|
| **Hunt** | Scans public signals daily for people expressing intent matching the ICP. Finds them before they find you. |
| **Reach** | Engages publicly on forums and communities where prospects are already talking. Drives inbound without cold messaging. |
| **Qualify** | Holds natural conversation. Scores intent in real time. Knows when someone is ready and when they're not. |
| **Handle objections** | Trained on the specific objections for each flavor. Doesn't fold. Doesn't push. Moves the conversation forward. |
| **Remember** | Carries context across every conversation. Knows what was said, what was agreed, what the next step is. |
| **Book** | When a prospect qualifies, offers a Zoom slot and books it directly on the operator's calendar. |
| **Nurture** | Follows up with prospects who weren't ready. Checks back in. Keeps the relationship warm without the operator lifting a finger. |
| **Report** | Sends the operator a daily brief: facts mined, conversations active, appointments booked. |

The agent runs 24/7. It does not sleep, forget, or have a bad day.

---

## What the Platform Is NOT

- Not a CRM. Operators don't manage contacts.
- Not a chatbot that waits for inbound. It hunts.
- Not a complex setup. 3 questions, done.
- Not configurable ICP — the flavor already knows the customer better than the operator does.

---

## Payment Flow — Paddle (The Only Path)

Stan Store, Zapier, and Stripe are dead. The Zapier webhook never worked. Payment gate is intentionally open until Paddle merchant of record approval comes through.

```mermaid
flowchart TD
    A[Customer buys via\nPaddle checkout URL] --> B[Paddle fires transaction.completed\nto POST /webhooks/paddle]
    B --> C[HMAC-SHA256 verification\nRedis idempotency check]
    C --> D[Provision: user + agent + subscription\nstatus: pending_setup]
    D --> E[Hatch email sent to customer]
    E --> F[Customer goes to wizard.tigerclaw.io]
    F --> G[3-Question Signup\nagent name · product · operator name]
    G --> H[POST /wizard/hatch\nBullMQ job enqueued]
    H --> I[Agent registered · webhook set\nonboard_state.json pre-seeded from flavor ICP]
    I --> J[Customer messages agent: 'Start']
    J --> K[Agent first impression\n⚠️ 4 languages not yet built]
    K --> L[Agent hunting-ready\n⚠️ Calendar slots not yet built]
```

**Why Paddle:** Direct webhook, no middleware, HMAC-verified, handles global VAT as merchant of record.

**Current state:** Paddle webhook is live. No product/price created yet. Payment gate open until approval.

---

## The Architecture That Makes It Work

| Layer | What It Does |
|-------|-------------|
| Data Mine | Runs at 2 AM UTC daily. 8 Research Agents in parallel. 1,500+ facts per run. Identifies intent signals by region and flavor. Suggests top-of-funnel sources per region. |
| Scout | Per-tenant. Finds prospects on the platforms most active in the operator's region. |
| Agent | Starts conversations, handles objections, qualifies. Runs 24/7. ✅ Live |
| Tiger Strike | Engages publicly on forums where prospects are talking. Drives inbound. ⚠️ Not yet wired to mine |
| Reporting | Daily brief: facts mined, top sources by region. ✅ Live (admin only) |
| Calendar / Booking | Operator sets 1–2 daily Zoom slots. Agent fills them. ⚠️ Not yet built |

---

## The Sale

The operator pays because they wake up with Zoom calls booked. That is a clear, provable ROI.

$147/month to have your calendar filled with qualified prospects is not a hard sell to someone who has been manually prospecting for years.
