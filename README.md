# Tiger Claw

**AI-powered recruiting and sales engine for network marketing professionals.**

Built on **Google Gemini**, **Cloud Run**, and **Next.js** — delivering stateless multi-tenancy at infinite scale.

---

## For Developers (Human or AI)

**START HERE:** Read `specs/tiger-claw/TIGERCLAW-MASTER-SPEC-v2.md` before writing any code.

That document contains 127 locked architectural decisions. Do not override them.

---

## Repo Structure

```
tiger-claw/
│
├── specs/                          ← ALL SPECIFICATIONS
│   ├── tiger-claw/                 ← Tiger Claw spec (THE source of truth)
│   └── legacy/                     ← Previous versions (reference only)
│       ├── TIGERCLAW-MASTER-SPEC-v1.md
│       ├── OPENCLAW-*.md           ← Obsolete OpenClaw specs
│       ├── PRD_v4.md
│       └── BLUEPRINT_v4.md
│
├── api/                            ← Tiger Claw API / Gemini Orchestrator
│   ├── server.ts
│   └── routes/
│
├── docker/                         ← Dev Environment (docker-compose)
│   └── dev/                        ← Dev environment compose (Postgres + Redis)
│
├── ops/                            ← Operations scripts
│   ├── botpool/                    ← Bot token pool management (create_bots.ts)
│   └── gcp-terraform/              ← Google Cloud Platform Terraform infrastructure
│
├── .devcontainer/                  ← Anti-Gravity dev container config
│   └── devcontainer.json
│
├── .cursor/                        ← Anti-Gravity AI agent rules
│   └── rules.md
│
└── README.md                       ← This file
```

---

## Development Setup

### Prerequisites
- Docker Desktop installed on your Mac
- Anti-Gravity IDE
- GitHub account

### First Time Setup
1. Clone this repo
2. Open in Anti-Gravity
3. Anti-Gravity will detect `.devcontainer/devcontainer.json` and offer "Reopen in Container"
4. Click yes — you're now developing inside the same Docker container that runs in production

### Important
All code runs INSIDE Docker. If it works in dev, it works in prod. No "works on my machine" issues.

---

## Architecture Summary

- **Stateless Cloud Run Deployment:** One highly scalable API cluster serves all 1,000+ tenants instantly through API requests. ZERO per-tenant Docker containers.
- **Tiger Claw Backend = Gemini Orchestrator:** Dynamic Gemini function-calling tools that execute the recruiting/sales flywheel natively in the API server.
- **Schema-per-Tenant PostgreSQL Data Isolation:** Central HA Postgres instance that instantly provisions a dynamically isolated schema (vault) for the tenant upon purchase for flawless CRM CRM isolation.
- **Redis High-Speed Caching:** For active chat transit queues, ensuring near zero-latency Telegram replies.

See `specs/tiger-claw/IDX-MASTER-PROMPT-v2.md` and `CLAUDE.md` for complete details.
