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

### 3. Bot First Impression

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
3. Tiger Strike Engage generates Web Intent URLs — one per reply, per platform (X, Reddit, LinkedIn)
4. Operator receives a daily batch of pre-filled one-click links
5. Operator clicks → their browser opens with the reply pre-filled → they post it as themselves
6. `engagement_status` updated to `queued` → `engaged` after confirmation

**Important:** Tiger Strike does NOT auto-post. It generates the reply and a deep link that opens the operator's browser with the text pre-filled. The operator clicks once. It posts from their real account. This is intentional — no write API, no bot detection risk, no OAuth token management. The system does the thinking; the operator does the clicking.

This is the missing link between the mine and revenue.

---

## Before Next Session Ends

### 6. Send Bot Link to 5 Warm Contacts
Not a build task — an operator task. Brent sends `t.me/Brentstiger01_bot` to five people in the network with a personal note. This is manual seeding while Tiger Strike Engage (#5) is being wired. Once the mine → Tiger Strike → inbound loop is live, this becomes automatic. Watch the first cold conversation. Document it.

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
- Regional top-of-funnel intelligence — mine should identify and recommend best signal sources per region as part of daily brief. SE Asia: LINE OpenChat, Pantip, Facebook Groups. North America: Reddit, LinkedIn, Facebook Groups. Europe: LinkedIn, local forums. Different markets, different surfaces. Mine already knows the region from the signals — it should surface where to find more.
- Additional signal sources (LINE OpenChat, Facebook Groups, Pantip, LinkedIn, Bright Data, Oxylabs Amplify) — after Tiger Strike Engage proven on current sources
- Paddle product + price — waiting on merchant of record approval
- Orphan tenant cleanup (`brents-tiger-01-mnpcril3`) — low priority, do when convenient
- Oxylabs Amplify — planned data source, never built. Currently only Oxylabs Realtime proxy (for Reddit 403) exists.
- Bright Data — planned data source, never built. Zero code in codebase.
- LINE OpenChat, Facebook Groups, Pantip, LinkedIn — planned signal sources, all stubbed or absent
- Admin alert markdown bug (underscore in Telegram) — fix before public launch

---

## Definition of Done for This Session

- [ ] Brentstiger01 responding as a hunter, not an interviewer
- [ ] `tiger_book_zoom` tool live and tested
- [ ] Wizard reduced to 3 questions
- [ ] Bot first impression ships in 4 languages
- [ ] Tiger Strike Engage wired to mine cycle
- [ ] At least 1 real cold conversation documented
