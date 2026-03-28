# Tiger Claw SWOT Analysis
**Updated:** 2026-03-27 (post-mine activation)

---

## Strengths

| # | Strength | Evidence |
|---|---|---|
| 1 | Stateless multi-region architecture | Cloud Run us-central1 + asia-southeast1, Global LB, no cold start |
| 2 | Autonomous data mine | BullMQ nightly cron, 313 facts on first run, self-growing market_intelligence table |
| 3 | 19 function-calling tools | Full sales lifecycle: scout → score → contact → nurture → convert → export |
| 4 | Memory Architecture V4.1 | Sawtooth compression, fact anchors, hive signals — context survives long conversations |
| 5 | 4-layer key fallback | Platform → BYOK primary → BYOK fallback → emergency 5-msg cap — tenants never hard-fail |
| 6 | HMAC magic links | Signed, 72h TTL, timing-safe — no password required for tenant login |
| 7 | Rate limiting + webhook security | 60 req/min per tenant, Stripe HMAC, Telegram secret — production-grade |
| 8 | Email support agent | Postmark → AI → Resend — support scales without human hours |
| 9 | 15 industry flavors | Broad coverage, all with scoutQueries — mine improves every vertical automatically |
| 10 | Existing paying customers | 3 live founding members + 7 paid-but-never-served queue |

---

## Weaknesses

| # | Weakness | Severity | Notes |
|---|---|---|---|
| 1 | **Zero bot usage** | 🔴 Critical | All 3 live tenants show `lastActive: Never`. The product is live but nobody is using it. |
| 2 | **Feedback loop bug (P1)** | 🔴 Critical | `processSystemRoutine()` silently ignores `weekly_checkin`, `feedback_reminder`, `feedback_pause` — the engagement safety net has never fired |
| 3 | **MAGIC_LINK_SECRET unverified** | 🟠 High | Pending manual step since PR #50. If missing from GCP Secret Manager, every new tenant wizard login returns 500 |
| 4 | **No activation support** | 🟠 High | Tenants receive a magic link and a bot. There is no guided onboarding, no "first conversation" script, no human touchpoint to ensure they actually start using it |
| 5 | **Bot pool is finite and slow to replenish** | 🟠 High | ~65 tokens. BotFather 5-min rate limit. Physical SIM dependency. At 10+ tenants this becomes a bottleneck |
| 6 | **Mine quality unvalidated** | 🟡 Medium | 313 facts saved but no review of what they actually contain — high volume ≠ high quality |
| 7 | **Gemini 2.0 Flash hard-locked** | 🟡 Medium | Function-calling bug in 2.5 Flash is a GCP issue, not ours to fix. But we're blocked from model upgrades until GCP resolves it |
| 8 | **No chargeback protection for 7 past customers** | 🟡 Medium | They paid, never got service. Goodwill window is closing |
| 9 | **Reddit rate limiting on scout** | 🟡 Medium | ~7 failures per full run. No retry logic, no backoff strategy |
| 10 | **Anthropic absent** | 🟡 Medium | Claude models unavailable to tenants. Deferred to Sprint 2 but limits provider resilience |

---

## Opportunities

| # | Opportunity | Notes |
|---|---|---|
| 1 | **7 past customer re-activations** | April 3 cap lift. These are warm leads who already paid — highest-probability conversions |
| 2 | **Data moat compounds nightly** | Every night the mine runs, the market_intelligence table grows. This is a durable competitive advantage that gets stronger automatically |
| 3 | **Thai market via SEA region** | John + Noon are live. Word of mouth in Thai network marketing communities could drive organic growth |
| 4 | **Hive signals cross-pollinate** | As tenants use their bots, successful patterns get promoted to all tenants in the same vertical — network effects |
| 5 | **Reflexion Loop** | Cheese Grater offline self-improvement tool (Sprint 2) — agents that improve themselves without human intervention |
| 6 | **Data as a product** | The market_intelligence table is a future sellable asset. Not now — but it's being built |
| 7 | **15-flavor horizontal expansion** | Each flavor is a new market segment. Low marginal cost to add a new vertical |

---

## Threats

| # | Threat | Notes |
|---|---|---|
| 1 | **Tenant churn before activation** | If founding members never start using their bots, they cancel before the observation window closes. Revenue dies before it starts |
| 2 | **Reddit blocks the mine** | Reddit has been tightening API access. A full block would kill the primary data source |
| 3 | **GCP pricing / function-calling changes** | Entire AI layer depends on Gemini 2.0 Flash staying available and affordable |
| 4 | **BotFather bans** | One mis-timed creation burst = 24h ban (happened before on 2026-02-23). Bot pool replenishment is fragile |
| 5 | **Telegram platform risk** | 3 of 3 live tenants are on Telegram. If Telegram changes webhook policy or bot terms, the entire fleet is affected |
| 6 | **Founding member cap creates urgency mismatch** | Cap lifts April 3, but if current tenants are inactive, adding more doesn't prove the model — it dilutes attention |

---

## Priority Actions (Ranked)

1. **Find out why tenants aren't using their bots.** Call or message each one. This is the only thing that matters right now.
2. **Fix the MAGIC_LINK_SECRET** — 30 minutes, prevents new tenant lockout.
3. **Fix the feedback loop P1** — `processSystemRoutine()` needs to handle the 3 missing routine types.
4. **Build an activation playbook** — what does a successful first week look like for a new tenant?
5. **Review mine quality** — manually check 10-20 facts in market_intelligence for signal vs noise.

---

*Last updated: 2026-03-27*
