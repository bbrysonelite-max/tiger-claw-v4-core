# Next Session Priorities

**Read SOTU.md first. Then HOW_TIGER_WINS.md. Then this file.**

These are the marching orders. Do them in order. Do not skip ahead. Do not add features not on this list.

*** Recommend how multiple agents can be used. 

---

## Immediate — Do Before Anything Else

### 1. Fix Brentstiger01 — DONE (unverified)

### 2. Top-of-funnel resources reviewed, defined, and researched. 

### 3. Cal.com Zoom Booking — `tiger_book_zoom` — (unverified) (needs activation) HIGH purpose of platform. 

Tool is live and registered. Reads `calcomBookingUrl` from tenant settings.json. Generates pre-filled booking link when prospect qualifies. Admin alert fires on booking confirmation.  (unverified)

**Operator action required:** Write `calcomBookingUrl` to settings.json before testing. Set up Cal.com availability (10) slots/day).

### 4. ✅ Agent First Impression — (unverified)

4-language greeting on first `/start` per chatId. State stored in `first_impression_shown.json`. Language-matching in system prompt — agent mirrors prospect's language for the full conversation.

### 5. ✅ Wire Tiger Strike Engage After Mine Cycle — DONE (unverified)

`runStrikeAutoPipeline()` wired to fire after every 2 AM mine cycle via Reporting Agent. Has not yet fired at 2 AM.

---

## This Session — Do In Order

### 6. Verify Tiger Strike Engage at 2 AM

After next mine cycle, check:
- `engagement_status` rows moved from `unengaged` to `queued` in `market_intelligence`
- Admin Telegram alert arrived with one-click links
- Alert is readable (no Markdown parse failure from underscores)

If the alert failed due to the Markdown bug, fix it now: escape underscores in the strike report message (`_` → `\_`).

### 7. Send Bot Link to 5 Warm Contacts-verify conversation 

Not a build task — an operator task. Brent sends `t.me/Brentstiger01_bot` to two people in the network with a personal note. Watch the first cold conversation. Document it.

### 8. Set calcomBookingUrl for all tenents of the Plateform HIGH

Write the Cal.com booking URL to settings.json for tenant `56d45bfd-08f9-46e7-9767-bf1bb60f8f07`. Test by triggering `tiger_book_zoom` manually.

---

## Before Next Session Ends

### 9. Admin dashboad and customer dashboard  Contrast Fix and all end points— HIGH

The instructional/helper text under each step heading is gray on a black background. It is illegible. The step headings are white and work. The gray supporting text does not.

Fix: in `web-onboarding/`, replace all `text-gray-*` and `text-slate-*` classes on instructional/helper text with `text-white` or `text-slate-200` minimum. Apply this rule to every web property going forward — gray text on dark backgrounds is banned for any text a user needs to read to complete an action.

---

## Review —  This Session

- Karpathy Ratchet (mine self-improvement) — after pipeline proven at volume run after mine is running
- Paddle product + price — waiting on merchant of record approval
- Admin alert Markdown bug (underscore breaks Telegram) — fix only if Strike alert fails
- Orphan tenant cleanup (`brents-tiger-01-mnpcril3`) — low priority
- Oxylabs Amplify — planned,  built- (unverified)
- Bright Data — planned, never built
- LINE OpenChat, Facebook Groups, Pantip, LinkedIn — planned signal sources, not this session
- Regional top-of-funnel intelligence (mine recommends best signal sources per region) — after volume

---

## Definition of Done for This Session
-fill the calander build and verify
-paddle activated


- [ ] Tiger Strike Engage verified firing at 2 AM and generating admin alert
- [ ] `calcomBookingUrl` set — `tiger_book_zoom` testable
- [ ] First cold conversation documented (even if brief)
