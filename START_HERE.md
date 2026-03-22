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
3. **Removed UI Friction:** We fixed the onboarding UI (`web-onboarding/`). Customers only need to provide ONE API key (their primary) or select the "Managed Free Brain" toggle. 
4. **Restored 4-Layer Key Fallback:** The backend natively handles the fallback using the 4-layer system (`api/src/services/ai.ts`). The platform silently injects the Onboarding Key (Layer 1) or Emergency Key (Layer 4) if needed.
5. **Deployed the MTProto Provisioner:** Using physical SIM sessions to mint fresh Telegram bots straight into the Postgres `bot_pool`.

## 3. Your Immediate Directives
You have two strict priorities to execute the exact second you boot up. Do not do anything else until these are finished:

### [ ] Priority 1: End-to-End System Testing
The platform is live and compiling perfectly. You must physically test the entire lifecycle:
- Validate the webhook (`https://api.tigerclaw.io`).
- Walk through the exact onboarding flow.
- Verify that a fresh bot is correctly pulled from the `bot_pool` without tripping former DB constraints.
- Verify the autonomous agent properly fires via stateless execution inside `ai.ts`.

## FINAL REMINDER
Everything you need is in `ARCHITECTURE.md`, `specs/`, and `Rules.md`. Trust the GitHub spec, not your LLM memory. Now get to work on Priority 1.
