# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
**Stop what you are doing. Read this entire document and read `ARCHITECTURE.md`. This is your injected context. Do not ask Brent to repeat himself. Do not rely on hallucinated history.**

## 1. The Current State of the Universe
**Tiger Claw is LIVE and COMPILATION GREEN.** 
- **Architecture:** V4 Stateless Serverless on Google Cloud Run (`https://api.tigerclaw.io`).
- **Database:** Postgres HA via Cloud SQL Proxy.
- **Cache:** Redis HA.
- **Strict Rule:** OpenClaw, Mini-RAG, and per-tenant Docker containers ARE DEAD. I physically eradicated their folders `skills/`, `.agents/`, `docker/`, and `Mini-RAG/` from this repo permanently. 

## 2. What We Accomplished Last Session
1. **The Great Tool Salvage:** We completely refactored the 19 core intelligence tools (`api/src/tools/tiger_*.ts`) that were historically tied to OpenClaw. They now perfectly utilize a stateless `ToolContext` object and compile via `tsc` with precisely 0 errors.
2. **Purged Legacy Constraints:** Ran a sanitization script dropping old foreign key obligations (`bot_ai_keys_bot_id_fkey`) directly from the PostgreSQL deployment, un-bricking the Telegram Provisioning flow.
3. **Verified E2E Provisioning Webhook:** Successfully seeded a live dummy `john@agent.test` tenant into Postgres and executed the Next.js `/wizard/hatch` Cloud Run webhook. It correctly assigned `bot_pool` entries without failing constraints.
4. **Architectural Locks & CI:** Addressed the Claude Code external audit. Removed hardcoded admin bypasses (`s3825`), solved `006`/`007` SQL migration sequence collisions, and installed a GitHub Actions CI pipeline (`.github/workflows/ci.yml`).
5. **Restored 4-Layer Key Fallback:** The backend natively handles the fallback using the 4-layer system (`api/src/services/ai.ts`).
6. **Test Suite Baseline & CI Lock:** Ingested 29 Claude-generated unit tests into `/tests`. Built an AST migration algorithm (`fix_tool_tests.js`) to dynamically rewrite hallucinated tool signatures into strict V4 parity. Isolated the Node environment via `vitest.setup.ts`. Achieved a flawless green TypeScript compile and established an official 101-passing baseline matrix.

## 3. Your Immediate Directives
You have three strict priorities to execute the exact second you boot up. Do not do anything else until these are finished:

### [ ] Priority 1: Verify the Agent Runtime Spool-Up
The `/wizard/hatch` webhook successfully fires the `provisionQueue`. You must verify that the `tenant-provisioning` BullMQ worker actually spins up the Gemini instance perfectly without crashing, and that the agent correctly responds on Telegram.
### [ ] Priority 2: Finalize Next.js Stripe Linkage
The `StepReviewPayment.tsx` component needs the final Stripe Checkout payment logic so that customers who buy via Stan Store or Stripe are securely validated.

## FINAL REMINDER
Everything you need is in `ARCHITECTURE.md`, `specs/`, and `Rules.md`. Trust the GitHub spec, not your LLM memory. Now get to work on Priority 1.
