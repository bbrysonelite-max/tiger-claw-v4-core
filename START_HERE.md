# START HERE — THE MASTER RESURRECTION BRIEFING

**CRITICAL INSTRUCTION TO ANY AI READING THIS FILE:**
**Stop what you are doing. Read this entire document. This is your injected context. Do not ask Brent to repeat himself. Do not rely on hallucinated history.**

## 1. The Current State of the Universe
**Tiger Claw is LIVE.** 
- **Architecture:** V4 Stateless Serverless on Google Cloud Run (`https://api.tigerclaw.io`).
- **Database:** Postgres HA via Cloud SQL Proxy.
- **Cache:** Redis HA.
- **Strict Rule:** OpenClaw, Mini-RAG, and per-tenant Docker containers ARE DEAD. I physically eradicated their folders `skills/`, `.agents/`, `docker/`, and `Mini-RAG/` from this repo last session. If you try to run OpenClaw logic or use per-tenant containers, you are violating `Rules.md`.

## 2. What We Accomplished Last Session
1. **Removed UI Friction:** We fixed the onboarding UI (`web-onboarding/src/components/wizard/StepAIConnection.tsx`). Customers only need to provide ONE API key (their primary) to proceed. 
2. **Restored 4-Layer Key Fallback:** The backend natively handles the fallback using the 4-layer system (`api/src/services/ai.ts`). The platform silently injects the Onboarding Key (Layer 1) or Emergency Key (Layer 4) if needed, preventing brain-dead agents without blocking the user interface.
3. **Flushed the Clutter:** We permanently deleted legacy OpenClaw files that were polluting the repo.
4. **Deployed the MTProto Provisioner:** We fired up the `create_bots.ts` script in the background over night to use the physical SIM sessions to mint fresh Telegram bots straight into the Postgres `bot_pool` for the pending customer launch.
5. **Verified the AI Tool Registry:** We successfully confirmed that the `api/src/tools/` folder contains the 22 core Gemini Function-Calling tools necessary for the agents to run real operations (no RAG needed). 

## 3. Your Immediate Directives
You have two strict priorities to execute the exact second you boot up. Do not do anything else until these are finished:

### [ ] Priority 1: End-to-End System Testing
The platform is live. Brent is terrified the crash broke the orchestration. You must physically test the entire lifecycle:
- Validate the webhook (`https://api.tigerclaw.io`).
- Walk through the exact onboarding flow.
- Verify that a fresh bot is correctly pulled from the `bot_pool`.
- Verify the autonomous agent properly fires using the 4-layer key rotation system.



## FINAL REMINDER
Everything you need is in the `specs/` folder and `Rules.md`. Trust the GitHub spec, not your LLM memory. Now get to work on Priority 1.
