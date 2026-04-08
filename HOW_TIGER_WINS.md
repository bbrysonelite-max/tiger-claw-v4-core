# How Tiger Claw Wins

The failure analysis is the map. This is the route.

---

## 1. The Fundamental Problem — Telegram Can't Hunt

**Failure:** Telegram bots cannot cold-message strangers. The mine finds prospects but has no legal channel to reach them.

**The fix:** Stop trying to push. Pull instead.

The mine identifies what people are talking about publicly — on Reddit, forums, groups. Tiger Strike drafts a reply to those public posts. That reply is helpful, real, and ends with a soft CTA: "I built an agent that handles this — message @BotName if you want to see it."

Prospect reads the reply. Prospect messages the agent themselves. Now it's inbound. The agent didn't cold-message anyone. The prospect opted in.

**The loop:**
```
Mine finds public pain → Tiger Strike drafts reply → Reply posted publicly
→ Prospect messages agent → Agent qualifies → Books Zoom
```

This is the correct architecture. The mine feeds Tiger Strike. Tiger Strike drives inbound. The agent closes the loop.

---

## 2. No Top of Funnel

**Failure:** Nobody knows the agent exists.

**The fix:** The mine IS the top of funnel. That's what it was built for.

The mine runs at 2 AM listening for intent signals — people publicly expressing the pain the agent solves. Tiger Strike drafts replies to those public posts. Those replies drive people inbound to the agent. The prospect opts in by messaging first.

The mine finds the signal. Tiger Strike creates the touch. The agent closes the loop.

**Status:** Tiger Strike Engage pipeline is wired. After every 2 AM mine cycle: harvest top 20 unengaged facts → draft replies via Gemini → generate Web Intent URLs → admin Telegram alert with one-click links. Operator clicks, posts from their account. Has not fired yet at 2 AM — verify after next mine cycle.

---

## 3. Payment Gate Is Open

**Failure:** No Paddle product/price. No checkout URL. Can't charge anyone.

**The fix:** Don't wait. Charge manually right now.

Founding members provisioned via admin hatch. Brent takes payment however he takes it. Agent live within the hour. Revenue today, not after Paddle approves.

When Paddle approves, the checkout URL goes live and the manual process stops. Nothing changes in the platform.

---

## 4. Brentstiger01 Is Stuck Mid-Interview — FIXED

`onboard_state.json` written directly to bot_states. Phase is `complete`. Identity: Brent / Nuskin. Full NM defaultBuilderICP loaded. Bot is hunting-ready. No interview.

---

## 5. Scout Has Never Run

**Failure:** Zero scouting activity for any real tenant.

**The fix:** The scout doesn't cold-message — it feeds Tiger Strike.

Tiger Strike posts replies publicly. Those replies drive inbound. The scout finds more surfaces to engage. Stop trying to make the scout do outreach on a platform that doesn't allow it.

**Immediate action:** Trigger a manual scout burst for the NM flavor. Log what it finds even if it can't reach anyone today.

---

## 6. Zoom Booking — BUILT, NOT YET ACTIVE

`tiger_book_zoom` tool is live and registered in `toolsMap`. Reads `calcomBookingUrl` from tenant settings.json.

**Activation required:** Write `calcomBookingUrl` to Brents Tiger 01 settings before testing. Operator must configure Cal.com availability separately (1–2 daily slots). Once set, agent generates a pre-filled booking link when a prospect qualifies and fires an admin Telegram alert on confirmation.

---

## 7. Mine Is Not Feeding Anything — FIXED

Tiger Strike pipeline is wired. After every 2 AM mine cycle: `runStrikeAutoPipeline()` fires automatically from the Reporting Agent. Harvests top 20 unengaged facts (confidence ≥ 70), drafts replies via platform Gemini key, generates Web Intent URLs, sends admin alert with one-click links, marks facts `queued`.

Has not yet fired at 2 AM — verify after next mine cycle that facts move from `unengaged` to `queued` and admin alert arrives.

---

## 8. First Impression — FIXED

4-language greeting fires on the first `/start` per chatId only (state stored in `first_impression_shown.json`). Subsequent `/start` goes straight to dashboard link. Agent detects prospect's language in every conversation and mirrors it for all subsequent replies — never switches back to English unless the prospect does.

---

## 9. Wizard — Leave It Alone

The wizard is a single scrolling page with 5 sections. The ICP questions give the operator a sense of ownership — they feel like they're programming their agent. That's a feature. Do not simplify or remove sections. The wizard works.

---

## 10. No Proof It Works

**Failure:** $147/month with no booked call on record.

**The fix:** Brent IS the case study. Fix the agent today. Send the link to five people. Document the first booked call. That screenshot is the sale.

---

## 11. Reddit Is 403 Blocked

**Failure:** Primary public forum inaccessible from Cloud Run.

**The fix:** Route Tiger Strike Engage posts through Oxylabs residential proxies — already in the codebase. Cloud Run IP is blocked. A residential proxy is not.

Alternative: Serper already indexes Reddit and works. Tiger Strike can pull targets from Serper results with no new infrastructure.

---

## The Winning Sequence

| Step | Action | Status |
|------|--------|--------|
| 1 | Fix Brentstiger01 — DB write | ✅ Done |
| 2 | Send link to 5 warm contacts | Operator action — not yet done |
| 3 | Watch first cold conversation | Pending — no prospects yet |
| 4 | Build `tiger_book_zoom` — Cal.com | ✅ Done — needs calcomBookingUrl set |
| 5 | Wire Tiger Strike Engage after mine | ✅ Done — verify after next 2 AM run |
| 6 | Confirm Tiger Strike Engage is driving inbound | After 2 AM verification |
| 7 | Charge first founding member manually | When ready |
| 8 | Paddle product + price live | When approved |
| 9 | Karpathy Ratchet | After #5 proven |

---

## The One-Sentence Version

Stop building infrastructure for a product nobody has used yet. Fix the agent, send the link, watch what happens. Everything else is built on top of that first real conversation.
