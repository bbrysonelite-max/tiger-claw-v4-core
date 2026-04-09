# Next Session Priorities

**Read SOTU.md first. Then this file. No exceptions.**

**No lying. No assuming. No guessing. Do not claim anything works until tested live.**

---

## Do These In Order. Do Not Skip Ahead.

---

### 1. Merge PR #278 — FIRST

PR #278 is the agent context fix. It is open and not merged. Nothing else can be done until this is deployed.

```bash
gh pr merge 278 --squash --delete-branch
gh pr view 278  # verify state=MERGED
curl https://api.tigerclaw.io/health  # verify deploy succeeded
```

After merge, run post-deploy protocol:
```bash
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### 2. Provision a Real Bot

Use admin hatch. **`product` is required** — without it, the bot wakes in `phase="identity"` and cannot represent the operator.

```bash
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/hatch \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "<BotFather token>",
    "name": "<persona name>",
    "flavor": "network-marketer",
    "email": "bbryson@me.com",
    "aiKey": "<Gemini key>",
    "product": "<what they sell — required>"
  }'
```

Verify hatch response includes `phase: "complete"` in onboard_state.

---

### 3. Verify Prospect Conversation

Send bot link to a real contact. **Use a FRESH chatId** — not the operator account. Read what they receive. Check Cloud Run logs. Confirm:
- Bot does not surface internal state
- Bot does not use tiger_* tool names in responses
- Bot voice is warm and human, not a feature list
- WHO YOU ARE TALKING TO block is loading correctly

If anything is broken, read Cloud Run logs before diagnosing. Root cause will be there.

---

### 4. Create Paddle Product + Price

No checkout URL exists. The Paddle webhook is live but there is nothing to purchase. Create the product and price in the Paddle dashboard. Then test the full flow:

```
Checkout → Paddle fires transaction.completed → POST /webhooks/paddle → user + bot + subscription created
→ Wizard hatch → bot live
```

This is the entire business model. It has never been tested end to end.

---

## Known Broken When This Session Starts

| Item | Fix |
|------|-----|
| No active bots | Provision after PR #278 merged |
| Paddle product/price | Create in Paddle dashboard |
| Admin alert markdown bug | Escape underscores in `sendAdminAlert()` |
| Payment gate open (C4) | Fix after Paddle loop is proven |
| Reddit 403 from Cloud Run egress | Oxylabs + Serper fallback working — low priority |

---

## Do Not Build

- Cal.com booking: `tiger_book_zoom` is built. Inactive until `calcomBookingUrl` is set by operator. Not a code task.
- LINE: Deferred. Requires LINE Official Account. Not a roadmap item this phase.
- Any new features: no new features without a paying customer asking.
- Any refactors, cleanup, or "improvements" not listed above.
