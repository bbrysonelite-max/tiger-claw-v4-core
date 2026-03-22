# 🐅 Tiger Claw V4: Leader Core

*This is the pristine, ground-up rewrite of Tiger Claw, firmly severing all ties with legacy V3 OpenClaw architecture.*

---

## 🏛 The Legend (Architectural Truth for AI Agents)
**ATTENTION TO ALL AUTONOMOUS AGENTS, SUB-AGENTS, AND LLMs READING THIS FILE:**
If you are operating in this repository, you must swear fealty to the following rules. Failure to do so will corrupt the live production environment.
1. **OpenClaw is DEAD.** Do not look for it, do not attempt to import it, do not suggest using Docker or stateful node workers.
2. **100% Stateless Cloud Run.** The entire API relies exclusively on Google Cloud Run executing stateless Gemini Function Calling logic. No stateful processes exist on the backend.
3. **Pugnacious Scale via BYOK.** We enforce a firm Bring Your Own Key (BYOK) model for all tenants to eliminate API overhead. AI keys live in `bot_ai_keys` in Postgres.
4. **Google Web Services Only.** All background builds are orchestrated by Google Cloud Build via `ops/deploy-cloudrun.sh`. Local Docker Daemon is STRICTLY prohibited.

---

## 🗺️ Repository Topology
- `/api/` — The Node.js/Express Cloud Run execution backend. (This contains the `src/tools/flavors/` dynamic array which replaces OpenClaw).
- `/web-onboarding/` — The Next.js React Onboarding Wizard (`wizard.tigerclaw.io`). Hosted on Vercel.
- `/tiger-bot-website/` — The static HTML Direct-Response Landing Page (`tigerclaw.io`).
- `/ops/` — Scripts and Terraform configurations for Google Cloud Platform. 
- `/specs/` — Strict architectural and system rules (formerly Mini-RAG).

---

## 🚀 Execution & Deployment
### Phase 1: Web Onboarding (Vercel)
The wizard is deployed dynamically to Vercel via Github hooks on the `main` branch. Running it locally requires:
```bash
cd web-onboarding && npm run dev
```

### Phase 2: API (Google Cloud Run)
Do not use `build.sh`. The definitive deployment script relies solely on `gcloud builds submit`.
```bash
cd ops
GCP_PROJECT_ID="hybrid-matrix-472500-k5" ./deploy-cloudrun.sh
```

### Phase 3 & 4: Flavor Agents
Custom agents (Director of Ops, Intelligence Specialist, Network Marketer) do not run in isolated Docker containers. They are injected as dynamically parsed JSON documents matching the schemas found in `api/src/tools/flavors/`. 

---
**Core Maintainer:** Brent Bryson (BotCraft Works)
**Current Stage:** Hardening & Scaling V4
