# Tiger Claw — Rules

These are not suggestions. Every AI agent working in this repo must follow them without exception.

---

## 1. No AI Agent Touches Main

**No AI agent pushes directly to `main`. Ever.**

Every change goes through a branch and a PR:
```
git checkout -b feat/your-change
# make changes
npm test  # must pass before opening PR
gh pr create
gh pr merge <number> --squash --delete-branch
gh pr view <number>  # verify state=MERGED before telling the operator it's done
```

---

## 2. Verify Everything Before Claiming It's Done

- "I merged it" means nothing until `gh pr view <number>` shows `state: MERGED`.
- "It's deployed" means nothing until `curl https://api.tigerclaw.io/health` returns 200.
- "It's fixed" means nothing until you've seen proof in production.

The operator is running a real business. False confidence causes real damage.

---

## 3. One PR Per Fix

No chaining unrelated changes into one PR. Each PR does one thing. The title describes exactly what it does. The body describes why.

---

## 4. Test Before Opening a PR

Run `npm test` from `api/`. All 455 tests must pass. If they fail, fix them before opening the PR.

---

## 5. Delete Branches After Merge

`gh pr merge <number> --squash --delete-branch` handles this. Always use `--delete-branch`. Do not leave stale branches.

---

## 6. Post-Deploy Protocol Is Mandatory

After every API deploy:
```bash
# 1. Deploy
GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh

# 2. Verify health
curl https://api.tigerclaw.io/health

# 3. Fix webhooks (idempotent — TELEGRAM_WEBHOOK_SECRET is in deploy script, this is a safety net)
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Deploy wizard (Vercel auto-deploy is broken — deploy manually)
```

---

## 7. No New Features Without a Customer Asking

Build only what a paying customer has asked for. Do not add "improvements," refactors, or speculative features. The mission is: paying customers get a live bot that works.

---

## 8. Architecture Is Locked

- No Docker containers per tenant
- No OpenClaw
- No Mini-RAG
- No switching from Gemini 2.0 Flash to any other model
- No calling the Mac cluster (192.168.0.2) from Cloud Run
- `tiger_gmail_send` and `tiger_postiz` are intentionally NOT in toolsMap — do not re-add them

If you see a TypeScript error, fix the interface. Do not rewrite the architecture.

---

## 9. Read SOTU.md First

Before writing a single line of code, read `SOTU.md`. It is the single source of truth. Run the cold start checklist. Do not assume anything about the state of the platform without verifying it.

---

## 10. Update SOTU.md Before Closing a Session

A session that ends without updating `SOTU.md` leaves the next agent blind. Update the last-updated date, service status, tenant fleet, and open issues before closing.

---

## 11. New Tools Must Be Registered

Any new tool added to `api/src/tools/` must be registered in `toolsMap` in `api/src/services/ai.ts`. Missing registration causes Gemini to enter an infinite tool loop. This has happened before.

---

## 12. Dangerous Tools Require Explicit Approval

Tools that take irreversible public actions (sending emails, posting to social media, calling external APIs on the operator's behalf) must not be registered in `toolsMap` without explicit operator approval. When in doubt, leave it out.
