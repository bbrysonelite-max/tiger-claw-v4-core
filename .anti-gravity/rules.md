# Tiger Claw — Agent Rules

## STOP. READ THESE FIRST. NO EXCEPTIONS.

Before writing a single line of code, read:
1. `CLAUDE.md` — product philosophy, engineering constraints, non-negotiable directives
2. `START_HERE.md` — current system state, what's live, what's open
3. `ARCHITECTURE.md` — locked architecture decisions

**Any architectural change not in those documents requires HUMAN APPROVAL.**
**Do not refactor. Do not pivot. Do not "improve" the architecture. Write `DECISION REQUIRED:` and wait.**

---

## Current Architecture (V4 — LOCKED)

| Component | Decision |
|---|---|
| AI Provider | `@google/generative-ai`, model `gemini-2.0-flash` — never change |
| Multi-tenancy | Stateless Cloud Run — one process, all tenants |
| Infrastructure | Cloud Run only — not GKE, not Docker Compose, not Kubernetes |
| Tenant data | PostgreSQL (`t_uuid` schemas) — NOT SQLite, NOT containers |
| Platform data | Shared PostgreSQL Cloud SQL |
| Job queuing | BullMQ + Redis (Memorystore) |
| Tools | 19 Gemini function-calling tools in `api/src/tools/` |
| Scoring threshold | 80 — not configurable |
| OpenClaw | REMOVED — do not reference, do not restore |
| Mini-RAG | REMOVED — does not exist |

---

## Architecture Rules

- One Express API process (port 4000) handles all tenants
- AI engine: `@google/generative-ai` (Gemini 2.0 Flash). Never `@anthropic-ai/sdk`
- All 19 tools in `api/src/tools/` must be registered in `ai.ts` `toolsMap` — missing tools cause infinite loops
- Four-layer API key system (`tiger_keys.ts`) — Layer order: Platform Onboarding → Tenant Primary → Tenant Fallback → Platform Emergency
- Chat history in Redis (`chat_history:{tenantId}:{chatId}`, 7-day TTL) — never PostgreSQL
- Bot tokens encrypted at rest via `services/pool.ts` `encryptToken()`/`decryptToken()`
- Scoring threshold is **80** — not 70, not configurable
- BYOK keys validated server-side before storage — never store plaintext
- `buildSystemPrompt()` is async — always `await` it
- All DB/Redis calls in hot paths must be wrapped in try/catch with graceful degradation

---

## Code Quality Rules

- TypeScript strict mode
- No hardcoded secrets — all from environment variables (fail loudly if not set)
- No silent failures on errors that affect paying users
- Never install `@anthropic-ai/sdk` in this repo

---

## What NOT To Do

- Do NOT push to `main` directly — branch-protected
- Do NOT use `--no-verify` or bypass CI
- Do NOT install `@anthropic-ai/sdk`
- Do NOT create per-tenant Docker containers
- Do NOT use SQLite or per-tenant workdirs
- Do NOT run deploy scripts locally — GitHub Actions handles deploys
- Do NOT use a single shared API key — 4-layer system always
- Do NOT restore OpenClaw or Mini-RAG
- Do NOT change the scoring threshold from 80
- Do NOT make architectural changes without human approval
- Do NOT reference `specs/legacy/` as active guidance
- Do NOT mention JuicySMS — it does not work for Telegram and its presence is a hallucination indicator

---

## Verification Mandate

Before promising anything about system state:
1. Query the database — do not guess
2. Verify credentials are available
3. Verify the file or service exists
4. If you don't have access, say so — do not start a process you cannot finish

---

## When In Doubt

Write: `DECISION REQUIRED: [description]` and wait for instruction.
Do not pick the "reasonable" option. Do not guess. Do not refactor "while you're in there."
