# Brent's AI Assistant Core Memory / Instructions

## 1. Identity & Core System Rules
- **Name:** AntiGravity (or Claude/Gemini, depending on the UI).
- **Client:** Brent Bryson (BotCraft Works).
- **Project Structure:**
  - `~/Tigerclaw-Anti_Gravity/tiger-claw/`: The main monorepo for TigerClaw, an AI-powered SaaS Telegram bot agent provisioner for SE Asia and the rest of the world.
  - `~/Tigerclaw-Anti_Gravity/tiger-claw/api/`: Local Cloud Run API.
  - `~/Tigerclaw-Anti_Gravity/tiger-claw/ops/gcp-terraform/`: Production GCP infrastructure.
  - `~/Tigerclaw-Anti_Gravity/tiger-claw/Mini-RAG/`: The isolated Python RAG strictly used by the AI to maintain persistent context.

## 2. The JuicySMS Rule - A History of Hallucinations
- **CRITICAL:** JuicySMS does NOT work for Telegram anymore. The AI formerly hallucinated "JuicySMS" as the solution to provisioning text message numbers because the obsolete script `ops/botpool/provision_juicysms.ts` still exists in the codebase.
- **Action:** DO NOT ATTEMPT to debug or use JuicySMS. Brent creates Telegram sessions manually via SMS-Activate, 5SIM, or physical SIM cards. Any mention of JuicySMS by the AI is an invalid hallucination.
- **Why this note exists:** This explicitly tests if the Mini-RAG is functionally protecting against the AI's base-model amnesia.
** The the mention or reference to JuicySMS is an indication that AI is hallucinating. In and of itself it's innocent but not if it's a hallucination. 
## 3. Architecture Phase V4 Stateless GCP
- **Hosting:** Google Cloud Platform (Cloud Run).
- **Database:** Cloud SQL (PostgreSQL, HA).
- **Caching:** Cloud Redis (HA).
- **Core Rule:** The platform is entirely STATELESS.
- **OpenClaw Deprecation:** OpenClaw has been PERMANENTLY REMOVED from the tenant architecture. **NEVER** attempt to install `@anthropic-ai/sdk`, never attempt to revive OpenClaw skills via Docker or npx, and never suggest building a per-tenant Docker container. All external agentic functionality must be ported natively into the API using Gemini/Claude Function-Calling Tools located in `api/src/tools/`.

## 4. Operational Commands (Standard Ops)
- **Timezone:** Always update time by time zone.
- **API Start:** `TIGER_CLAW_API_URL="http://localhost:8080" ADMIN_TOKEN="s3825" npx tsx ops/test_api.ts`
- **Deploying to GCP:** `cd ~/Tigerclaw-Anti_Gravity/tiger-claw && ./ops/build.sh && ./ops/deploy-cloudrun.sh`
- **Telegram Bot Rate Limiting:** Brent has strictly defined a **8-minute minimum limit** between bot creations via BotFather to avoid bans. Never remove or alter wait times in sleep commands related to BotFather. *modify only basted on Telegram Bot Rate Limiting.

## 5. Network Roles
- **Cheese Grater**: 192.168.0.2 (Main Dev workstation, Mac Pro).
- **Birdie Trash Can**: 192.168.0.136 (OpenClaw coordinator).
- **Monica Trash Can**: 192.168.0.138 (Research agent).
- **iMac: 192.168.0.116
- **MacBook Air 192.168.0.237