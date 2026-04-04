# Tiger Claw — Rules

These are not suggestions. Every AI agent working in this repo must follow them without exception.

---

## 1. No AI Agent Touches Main

**No AI agent pushes directly to `main`. Ever.**

Every change goes through a branch and a PR:
```
git checkout -b feat/your-change
# make changes
gh pr create
gh pr view <number>  # verify state=MERGED before telling the operator it's done
```

This rule was violated repeatedly in Session 6. Every commit went straight to main. That is not acceptable and must not happen again.

---

## 2. Verify Everything Before Claiming It's Done

- "I merged it" means nothing until `gh pr view <number>` shows `state: MERGED`.
- "It's deployed" means nothing until `curl https://api.tigerclaw.io/health` returns 200 and you've checked the logs.
- "It's fixed" means nothing until you've seen proof in production — a 200, a log line, a live test.

The operator has deleted hundreds of failure notification emails. Do not add to that pile by claiming success before verifying it.

---

## 3. One PR Per Fix

No chaining unrelated changes into one PR. Each PR does one thing. The title describes exactly what it does. The body describes why.

---

## 4. Test Before Opening a PR

Run the relevant tests. If they fail, fix them before opening the PR. Do not open a PR for code that hasn't been verified.

---

## 5. Delete Branches After Merge

After a PR merges, delete the branch. There are currently 148 stale branches in this repo from agents that never cleaned up. Do not add to that number.

---

## 6. Post-Deploy Protocol Is Mandatory

After every API deploy:
```bash
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Without this, TELEGRAM_WEBHOOK_SECRET mismatch silently kills all bots.

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

If you see a TypeScript error, fix the interface. Do not rewrite the architecture.

---

## 9. Read SOTU.md First

Before writing a single line of code, read `SOTU.md`. It is the single source of truth. Run the cold start checklist in that file. Do not assume anything about the state of the platform without verifying it.

---

## 10. Update SOTU.md Before Closing a Session

A session that ends without updating `SOTU.md` leaves the next agent blind. Update the last-updated date, service status, tenant fleet, and open issues before closing.
