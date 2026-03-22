# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp Generated:** 2026-03-21T16:05:01-07:00
**Current Branch Hash:** `55ae7c5` (v2026.03.07.11 architecture preserved)
**Infrastructure Status:** ALIVE AND HEALTHY (`https://api.tigerclaw.io` responding HTTP 200)

---

## 🛑 MANDATORY DIRECTIVE TO ALL AI AGENTS 🛑
This document is the absolute, most recent source of truth for the Tiger Claw repository (`/Users/brentbryson/Tigerclaw-Anti_Gravity/tiger-claw/`). 

If you are reading this, you are working on the **Tiger Claw Multi-Tenant SaaS**. 
1. **NO RAG.** The personal AI OS/Mini-RAG has been physically extracted to a separate workflow using MCP. You will not write, reference, or import RAG pipelines here.
2. **NO OPENCLAW.** We do not spin up per-tenant Docker containers.
3. **ARCHITECTURE:** Stateless Google Run API, Gemini 2.5 Flash, 19+ Native Function Calling Tools, Schema-per-tenant Postgres.
4. **PROTOCOL:** Do not stray from this path. Any changes must respect exact Git versioning.

---

## The Immediate Backlog (Starting Point)

We lost time on a rogue RAG hallucination loop. We are restarting here on solid ground.

### Priority 1: Bot Token Triage
We spent significant effort acquiring phone numbers and activating Telegram Accounts/Bots earlier today. We need to query the database and the token pool to see if those tokens were preserved or if they evaporated in the crash.
*Action:* Run database/pool queries to audit how many live bot tokens exist right now.

### Priority 2: Web Onboarding & Stripe
Finalize the Web Wizard UI (`web-onboarding`) and ensure the Stripe flow accurately bifurcates between "Managed Key" and "Bring Your Own Key" (BYOK) subscriptions.

### Priority 3: API & Tools
Ensure the newly updated provisioner bypasses local webhook errors gracefully, and confirm all 22 Gemini tools in `api/src/tools/` are fully accessible to the API orchestration (`ai.ts`).

---
*Locked. Proceed.*
