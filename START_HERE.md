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
1. **The Great SWOP Remediation:** Addressed the massive tech debt audit identified by earlier runs. Locked down CORS arrays dynamically without failing local dev, gated the `ENCRYPTION_KEY` arrays fatally, and rate-limited all external logic schemas.
2. **Postgres Telemetry & Constraints:** Terminated all ephemeral Docker file logging (`/.learnings/json`) entirely. Everything writes statefully via Postgres `logAdminEvent`. Dropped dead legacy OpenClaw database constraints explicitly so native Provisioning handles the multi-key architecture correctly.
3. **Zod Ast Typings & UI:** Converted the `/wizard/*` APIs entirely to strictly typed Zod validations. Executed a Tier-1 visual redesign of the LINE `/wizard/:slug` Configuration HTML and secured its input forms physically against Password Manager hijack overrides utilizing `readonly` locks.
4. **Cloud Run Production Deployment & Subagent E2E:** Synced the legacy Claude test suite inside `wizard.test.ts` to perfectly map onto the new Database integrations. Pushed a full `gcloud run deploy` straight onto `us-central1` and natively verified its health loop by spawning the agent payload against an isolated `botcraft-sandbox` DB user.

## 3. Your Immediate Directives
You have three strict priorities to execute the exact second you boot up. Do not do anything else until these are finished:

### [ ] Priority 1: Final E2E Telegram Verification
The `tiger-claw-api` is physically live natively right now. You must await Brent's physical test text to `@tigerclawjohnhidebrandbot` via Telegram and verify the exact telemetry via Cloud Logging (`gcloud logging read ...`) that the queue properly processes the Webhook array into the actual Gemini Runtime loop seamlessly.
### [ ] Priority 2: Finalize Next.js Stripe Linkage
The `StepReviewPayment.tsx` component requires the native Stripe Checkout payment processing integration to permanently replace any simulated API calls for standard onboarding.

## FINAL REMINDER
Everything you need is in `ARCHITECTURE.md`, `specs/`, and `Rules.md`. Trust the GitHub spec, not your LLM memory. Now get to work on Priority 1.
