# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp Generated:** 2026-03-21T23:35:00-07:00
**Infrastructure Status:** ALIVE AND HEALTHY (PostgreSQL constraints purged, Tools compile with exactly ZERO TypeScript errors).

---

## 🛑 MANDATORY DIRECTIVE TO ALL AI AGENTS 🛑
This document is the absolute, most recent source of truth for the Tiger Claw repository (`/Users/brentbryson/Tigerclaw-Anti_Gravity/tiger-claw/`). 

If you are reading this, you are working on the **Tiger Claw Multi-Tenant SaaS**. 
1. **NO RAG.** The personal AI OS/Mini-RAG has been physically extracted to a separate workflow. You will not write, reference, or import RAG pipelines here.
2. **NO OPENCLAW.** We do not spin up per-tenant Docker containers.
3. **ARCHITECTURE:** Stateless Google Cloud Run API, Gemini 2.5 Flash, 19 Native Function Calling Tools (`api/src/tools/`), Schema-per-tenant Postgres.
4. **NO REWRITES:** Any agent that attempts to rewrite the architecture or reintroduce generic context objects because it thinks the code is "broken" will immediately fail. The 19 core tools compile flawlessly.
5. **PROTOCOL:** Read `ARCHITECTURE.md` before making any assumptions or answering any prompt. Any deviation from this exact structure is a failure.

---

## The Immediate Backlog (Starting Point)

We just completed a massive salvage operation. The 19 core tools imported from OpenClaw have been surgically modified to run strictly inside the stateless Cloud Run architecture. All 301 legacy OpenClaw TypeScript errors have been entirely resolved natively via `api/src/tools/ToolContext.ts`.

### Priority 1: Validating End-to-End Orchestration
The tools compile and the database no longer has legacy constraints blocking provisioning. We need to physically trigger `https://api.tigerclaw.io` or run local tests to verify the `processTelegramMessage` loop executes the `ToolContext` logic flawlessly in real runtime.

### Priority 2: Web-Onboarding Completion
The UI is fully built out with Stripe and the "Managed Free Brain 72h" bypass. We need to deploy this to Vercel/Cloud Run and confirm the webhook correctly generates a bot and injects the `ToolContext` payload.

---
*Locked. Proceed.*
