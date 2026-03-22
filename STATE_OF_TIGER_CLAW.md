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

We systematically neutralized the external architecture audit (Claude Code) and successfully performed local E2E verification of the `hatch` payload. The 19 core tools are globally compatible. The database migrations are deterministic. A GitHub CI pipeline blocks all failing builds.

### Priority 1: Verifying Agent Runtime Spool-Up
The Next.js → Cloud Run Webhook → Database insertion phase has been 100% verified. We proved that the UI webhook securely inserts a tenant and extracts a bot from `bot_pool`.
**The absolute next test:** Validate the `tenant-provisioning` BullMQ worker to confirm it properly instantiates the multi-layered Gemini runtime, injects `ToolContext`, and that the `processTelegramMessage` loop handles incoming test texts sequentially.

### Priority 2: Web-Onboarding Completion
The Stripe PR (`feat/stanstore-webhook`) must be merged/finished so that `StepReviewPayment.tsx` natively handles the precise Stripe checkout flow without bypassing.

---
*Locked. Proceed.*
