# Tiger Claw V4 — Core Architecture 

## 1. The Paradigm Shift
Tiger Claw V4 is **Stateless**. There are no long-running Docker containers per tenant. There is no RAG. There is no OpenClaw. 

The entire platform operates as a shared-nothing Node.js Google Cloud Run API (`api/`). 

## 2. Component Stack
- **Compute:** Google Cloud Run (Node.js/Express)
- **Database:** Google Cloud SQL (PostgreSQL HA) - `tiger_claw_shared` 
- **Caching & Queues:** Google Cloud Redis HA (BullMQ orchestrating background tasks)
- **AI Provider:** Google Gemini 2.0 Flash (`@google/generative-ai`) natively. No third-party SDKs.
- **Frontend:** Next.js React Web Wizard (`web-onboarding/` and `tiger-bot-website/`)

## 3. Core Intelligence (The "Brain")
The logic formerly housed in OpenClaw stateful skills now lives explicitly in `api/src/tools/`.
- There are exactly 19 active tools exported (e.g., `tiger_aftercare.ts`, `tiger_briefing.ts`).
- **Critical Rule:** Every tool strictly adheres to the `ToolContext` typing defined in `api/src/tools/ToolContext.ts`. They do NOT rely on global scopes, implicit OpenClaw generics, or stateful container memory.
- The `ai.ts` service builds the `ToolContext` statelessly on every single incoming chat message and injects it into execution.

## 4. Key Management (The 4-Layer Fallback)
Tenants do not go dark immediately if their billing fails.
1. **Layer 1:** Platform Onboarding Key (Tiger Claw provided, 50 msg daily threshold)
2. **Layer 2:** Primary API Key (Tenant provided BYOK)
3. **Layer 3:** Fallback API Key (Tenant provided BYOK)
4. **Layer 4:** Emergency Platform Keep-Alive (Tiger Claw provided, 5 msg threshold, pauses bot after 24h).
This handles gracefully and natively in `tiger_keys.ts` and `ai.ts`.

## 5. Security & Isolation
- **Never** inject SQL queries dynamically based on LLM outputs.
- **Never** allow the AI to read outside a tenant's designated `workdir`.
- Shared PostgreSQL handles the `bot_pool`, `tenants`, and `users`.
- Tenant prospect/contact data is siloed to the file-system/workdir payload or specific tenant schemas.

> **Note to AI Agents:** This architecture is locked and battle-tested. If a tool "fails to compile" or you see a type error, DO NOT rewrite this architecture to "fix" it. Fix the typescript interface. Do NOT recreate OpenClaw or attempt to persist the Node process. Validate types statelessly.
