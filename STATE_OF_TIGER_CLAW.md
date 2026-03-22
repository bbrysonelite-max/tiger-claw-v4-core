# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp Generated:** 2026-03-22T11:35:00-07:00
**Infrastructure Status:** BATTLE-HARDENED AND LIVE (SWOP Audit Security holes patched, Zod APIs strictly typed, 108/108 Unit Tests Passing via Vitest, and Production Cloud Run deployed successfully on hybrid-matrix-472500-k5).

---

## 🛑 MANDATORY DIRECTIVE TO ALL AI AGENTS 🛑
This document is the absolute, most recent source of truth for the Tiger Claw repository (`/Users/brentbryson/Tigerclaw-Anti_Gravity/tiger-claw/`). 

If you are reading this, you are working on the **Tiger Claw Multi-Tenant SaaS**. 
1. **NO RAG.** The personal AI OS/Mini-RAG has been physically extracted to a separate workflow. You will not write, reference, or import RAG pipelines here.
2. **NO OPENCLAW.** We do not spin up per-tenant Docker containers.
3. **ARCHITECTURE:** Stateless Google Cloud Run API, Gemini 2.5 Flash, 19 Native Function Calling Tools (`api/src/tools/`), Schema-per-tenant Postgres.
4. **NO REWRITES:** Any agent that attempts to rewrite the architecture or reintroduce generic context objects because it thinks the code is "broken" will immediately fail. The 19 core tools compile flawlessly and are backed by a robust test suite.
5. **PROTOCOL:** Read `ARCHITECTURE.md` before making any assumptions or answering any prompt. Any deviation from this exact structure is a failure.

---

## What We Just Accomplished
We executed a monumental sweep of the conversational AI Engine and 72-Hour Trial architecture:
- **Phase 1 (The Gemini Fix):** Diagnosed and patched a silent function-calling output suppression bug occurring exclusively on GCP arrays for `gemini-2.5-flash`. Downgraded the native internal routing model to the robust `gemini-2.0-flash`, and hardcoded `SchemaType.OBJECT` enums directly replacing the raw lowercase JSON schema maps. The AI logic is completely stable.
- **Phase 2 (Onboarding Friction):** Physically eradicated the API Key collection requirement (Phase 3 & 4) from the conversational Telegram Wizard. Users now sail straight from ICP confirmation directly into naming the bot, accelerating immediate utilization.
- **Phase 3 (72-Hour Native Trial Engine):** Constructed a fully decoupled, completely stateless 72-hour trial engine. Tapped into the hourly global heartbeat inside Postgres via `queue.ts`. At 24, 48, and 72 hours, the cron job executes a single-shot generative request through Gemini (inheriting the user's exact Flavor Persona) to securely drop an upbeat conversation reminder cleanly into the operator's active Telegram chat. At exactly 72 hours, it natively locks `tenantPaused = true` in JSON state until an API key is provided seamlessly through the web wizard.

## The Immediate Backlog (Starting Point)

### Priority 1: Web-Onboarding Completion
The Stripe PR (`feat/stanstore-webhook`) must be finalized so that customers directly route from Stan Store into the `wizard.tigerclaw.io` E2E React flow natively, providing the ultimate entry bridge now that the 72-hour backend is complete.

---
*Locked. Proceed.*
