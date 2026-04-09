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

Run `npm test` from `api/`. All **456 tests** must pass. If they fail, fix them before opening the PR.

---

## 5. Delete Branches After Merge

`gh pr merge <number> --squash --delete-branch` handles this. Always use `--delete-branch`. Do not leave stale branches.

---

## 6. Post-Deploy Protocol Is Mandatory

After every API deploy:
```bash
# 1. Verify health
curl https://api.tigerclaw.io/health

# 2. Fix webhooks (idempotent — safety net)
ADMIN_TOKEN=$(gcloud secrets versions access latest --secret="tiger-claw-admin-token" --project="hybrid-matrix-472500-k5")
curl -X POST https://api.tigerclaw.io/admin/fix-all-webhooks \
  -H "Authorization: Bearer $ADMIN_TOKEN"
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
- **There is no bot pool. BYOB only. See Rule 15.**

---

## 9. Read SOTU.md First

Before writing a single line of code, read `SOTU.md`. It is the single source of truth. Do not assume anything about the state of the platform without verifying it first.

---

## 10. Update Docs After Every Merge

A PR that changes behavior, endpoints, tools, schema, or architecture **must** update the relevant documents in the same PR or a follow-up PR opened immediately after. See Rule 16 for the full protocol.

---

## 11. New Tools Must Be Registered

Any new tool added to `api/src/tools/` must be registered in `toolsMap` in `api/src/services/ai.ts`. Missing registration causes Gemini to enter an infinite tool loop. This has happened before.

---

## 12. Dangerous Tools Require Explicit Approval

Tools that take irreversible public actions (sending emails, posting to social media, calling external APIs on the operator's behalf) must not be registered in `toolsMap` without explicit operator approval. When in doubt, leave it out.

---

## 13. Read Cloud Run Logs Before Diagnosing

The root cause of almost every production bug is visible in Cloud Run logs within 30 seconds of it happening. Read logs first. Do not guess.

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="tiger-claw-api"' \
  --project=hybrid-matrix-472500-k5 --limit=50 --format="value(timestamp,textPayload)"
```

---

## 14. Never Reference Individuals by Name

Do not reference specific people (distributors, contacts, partners) by name in code, docs, comments, prompts, or conversation. Refer to roles only: "operator," "distributor," "contact." Never names.

---

## 15. There Is No Bot Pool — BYOB Always

**ALL Telegram bot tokens come from BotFather. The operator provides their own token. The platform never holds a pool.**

- No `bot_pool` table queries. No pool assignment. No pool replenishment.
- `pool.ts` is a crypto/Telegram utility file only.
- If you find pool code anywhere, delete it — do not refactor or preserve it.
- This is permanent. Violation cost real money (OpenRouter drain). Do not repeat it.

---

## 16. Documentation Protocol — Non-Negotiable

Documents are the ground truth for every agent session. Stale docs cause hallucinations, repeated work, and broken code. This protocol is mandatory.

### What must be updated and when

| Document | Update trigger |
|----------|---------------|
| `SOTU.md` | After every merged PR. Before closing any session. |
| `STATE_OF_THE_TIGER_PATH_FORWARD.md` | After every merged PR. |
| `CLAUDE.md` (Current Session State block) | At the **start** of each session — update to reflect what is actually deployed and what is open. |
| `ARCHITECTURE.md` | Whenever routes, services, tools, workers, or schema change. |
| `START_HERE.md` | Whenever the onboarding flow, first priorities, or key commands change. |
| `RULES.md` | Whenever a new rule is needed or an existing rule changes. |

### The protocol

1. **Before closing a PR:** ask yourself: does this change affect any of the documents above? If yes, include the doc update in the same PR or open a follow-up immediately.
2. **At session start:** read `SOTU.md`. If anything in it is wrong, fix it before touching code.
3. **At session close:** update `SOTU.md` and `STATE_OF_THE_TIGER_PATH_FORWARD.md` before ending. No exceptions.
4. **CLAUDE.md current session block** is updated at session START, not end — because the end is when context runs out.

### What causes docs to rot

- Updating docs "later" (later never comes)
- Doc updates bundled as the last step of a long session
- Not verifying what's in the docs before writing new ones
- Writing docs from memory instead of from the code

### The standard

Every fact in every document must be verifiable by reading the codebase or querying the live system. If you cannot verify it, do not write it. If you wrote it and can no longer verify it, remove it.
