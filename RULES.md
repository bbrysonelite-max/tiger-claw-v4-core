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

Run `npm test` from `api/`. All **452 tests** must pass. If they fail, fix them before opening the PR.

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

### The 4-doc model

**State lives in exactly two files: `SOTU.md` and `NEXT_SESSION.md`. Every other doc is timeless.**

- `SOTU.md` — single source of truth. Backward-looking: what is the state of the world right now. Read first every session.
- `NEXT_SESSION.md` — forward-looking ordered action list. **Deletion-only** — closed items are removed, not annotated with ✅ or "ALREADY IN PLACE".
- `CLAUDE.md` — auto-loads into every agent session. Engineering directives only. No session state block. No priorities. No "what's broken right now".
- `DAILY_CHECKS.md` — session-open operational ritual. Pure procedure. No "current gap" blocks.

If you are tempted to record state in any file other than SOTU/NEXT_SESSION, stop. That is how drift starts. Six truth docs drifted six different ways in Session 20. Do not repeat.

### What must be updated and when

| Document | Update trigger |
|----------|---------------|
| `SOTU.md` | After every merged PR that changes platform state. Before closing any session. |
| `NEXT_SESSION.md` | When a priority is added or closed. **Closed = deleted from the file, not annotated.** |
| `CLAUDE.md` | Only when engineering rules change. Never for session state. |
| `DAILY_CHECKS.md` | Only when a daily check is added or removed. Never embed "current gap" blocks — those drift. Broken-thing-right-now belongs in `SOTU.md`. |
| `ARCHITECTURE.md` | Whenever routes, services, tools, workers, or schema change. |
| `RULES.md` | Whenever a new rule is needed or an existing rule changes. |

### The protocol

1. **Before closing a PR:** does this change affect SOTU or NEXT_SESSION? If yes, update both in the same PR. If it touches architecture, update `ARCHITECTURE.md` too.
2. **At session start:** read `SOTU.md`. Run `DAILY_CHECKS.md`. If anything in SOTU is wrong, fix it before touching code.
3. **At session close:** update `SOTU.md` with what actually shipped (not what was planned). **Delete** closed items from `NEXT_SESSION.md`. Verify every merged PR with `gh pr view <number>` showing MERGED. Verify deploy with `curl https://api.tigerclaw.io/health`. No exceptions.

**That's it. Two files to keep in sync at every session close. Not six.**

### What causes docs to rot

- Updating docs "later" (later never comes)
- Doc updates bundled as the last step of a long session
- Not verifying what's in the docs before writing new ones
- Writing docs from memory instead of from the code
- Recording state in timeless files (CLAUDE.md session blocks, DAILY_CHECKS "current gap" sections, START_HERE first priorities)
- Annotating closed items with ✅ instead of deleting them

### The standard

Every fact in every document must be verifiable by reading the codebase or querying the live system. If you cannot verify it, do not write it. If you wrote it and can no longer verify it, remove it.
