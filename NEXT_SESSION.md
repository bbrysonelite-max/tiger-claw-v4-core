# Next Session Priorities

**Read SOTU.md first. Then HOW_TIGER_WINS.md. Then this file.**

These are the marching orders. Do them in order. Do not skip ahead. Do not add features not on this list.

---

## Immediate — Do Before Anything Else

### 1. Fix Brentstiger01 — 10 minutes
Bot is stuck mid-interview (`phase: icp_customer`). Write complete `onboard_state.json` directly to bot_states:
- `phase: complete`
- `icpBuilder` from NM flavor `defaultBuilderICP`
- `icpSingle` from NM flavor config
- `identity.operatorName: Brent`
- `identity.product: Nuskin`

No PR needed. Direct DB write. Confirm by messaging the bot and verifying it responds as a hunter, not an interviewer.

---

## This Session — Build In Order

### 2. Cal.com Zoom Booking — `tiger_book_zoom`
The bot's conversion event is a booked Zoom call. This tool must exist before the bot can close.

- Operator sets availability during wizard (1–2 daily slots)
- New tool `tiger_book_zoom` added to `toolsMap` in `ai.ts`
- Cal.com API key added to GCP secrets
- Bot sends booking link when `qualifying_score` crosses threshold
- Booking confirmed → notification to operator

### 3. Wizard — Reduce to 3 Questions
Strip the wizard to exactly three inputs:
1. Your name (operator)
2. Your agent's name
3. Your product or opportunity (e.g. "Nuskin")

Everything else hardwired from flavor. No ICP questions. No builder profile. No years in profession.

### 4. Bot First Impression
On the very first `Start` message, bot greets in 4 languages to demonstrate intelligence, then locks to the prospect's language for the remainder of the conversation.

Greeting (English):
> "Hi, I'm [Agent Name]. I'm here to take you by the hand and lead you to a brighter future."

Then immediately in Thai, Spanish, and German.

Then: **"Let's get to work! I'm having my nails done later!"**

After the first message: respond in the prospect's language only.

### 5. Wire Tiger Strike Engage After Mine Cycle
After the 2 AM orchestrated run completes:
1. Tiger Strike Harvest pulls top 20 unengaged facts (confidence ≥ 70)
2. Tiger Strike Draft generates contextual replies
3. Tiger Strike Engage posts replies publicly (via Oxylabs proxy for Reddit)
4. `engagement_status` updated to `queued`

This is the missing link between the mine and revenue. Facts must flow into public engagement or they're worthless.

---

## Before Next Session Ends

### 6. Send Bot Link to 5 Warm Contacts
Not a build task — an operator task. Brent sends `t.me/Brentstiger01_bot` to five people in the network with a personal note. Watch the first cold conversation. Document it. That data drives everything built after this.

### 7. Check 2 AM Mine Results
Pull from `market_intelligence`:
- Total facts today
- Facts by flavor
- 10 sample facts with verbatim quotes
- Rejection count from relevance gate

Confirm Tiger Strike Engage fired and `engagement_status` rows moved from `unengaged` to `queued`.

---

## Parking Lot — Do Not Touch This Session

- Karpathy Ratchet (mine self-improvement) — after pipeline proven at volume
- YouTube content pipeline agent — after first live conversation documented
- Paddle product + price — waiting on merchant of record approval
- Orphan tenant cleanup (`brents-tiger-01-mnpcril3`) — low priority, do when convenient
- Admin alert markdown bug (underscore in Telegram) — fix before public launch

---

## Definition of Done for This Session

- [ ] Brentstiger01 responding as a hunter, not an interviewer
- [ ] `tiger_book_zoom` tool live and tested
- [ ] Wizard reduced to 3 questions
- [ ] Bot first impression ships in 4 languages
- [ ] Tiger Strike Engage wired to mine cycle
- [ ] At least 1 real cold conversation documented
