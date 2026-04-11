# Tiger Claw V4

**Multi-tenant AI sales agent platform. Stateless. Cloud Run. Gemini 2.0 Flash.**

Live at `https://api.tigerclaw.io` | Wizard at `https://wizard.tigerclaw.io` | Website at `https://tigerclaw.io`

---

## For AI Agents

Read `SOTU.md` first, then `CLAUDE.md`. SOTU is the single source of truth for platform state. CLAUDE.md contains timeless engineering directives.

---

## Repository Structure

```
/api/                   — Cloud Run API (Node.js/Express)
  src/tools/            — 19 Gemini function-calling tools
  src/services/         — ai.ts, queue.ts, provisioner.ts, factExtractor.ts, etc.
  src/routes/           — admin, wizard, subscriptions, webhooks
  migrations/           — PostgreSQL schema migrations

/web-onboarding/        — Next.js onboarding wizard (wizard.tigerclaw.io)
/tiger-bot-website/     — Static HTML landing page (tigerclaw.io) — separate repo
/ops/                   — GCP Terraform, bot pool scripts, deploy scripts
/specs/                 — Architecture specs and PRDs
/docs/                  — ADRs, admin commands, operations runbooks
```

---

## Local Development

```bash
# API
cd api
npm install
npm run dev          # starts on port 4000

# Wizard
cd web-onboarding
npm install
npm run dev          # starts on port 3000
```

Environment variables required — see `api/.env.example` and `web-onboarding/.env.example`.

---

## Testing

```bash
cd api && npm test
# Expected: 155/155 tests passing
```

---

## Deployment

**All deployments are automatic via GitHub Actions on merge to `main`.**

- Never push directly to `main`
- Never run deploy scripts locally
- Open a PR → CI passes → auto-merge → GitHub Actions deploys to Cloud Run + Vercel

---

## Product

| Product | Price | Description |
|---|---|---|
| Tiger-Claw Pro (Pre-Flavored) | $147/mo | Pre-trained for sales & network marketing. Ships ready. |
| Industry Agent | $197/mo | Domain pre-trained for a specific vertical. |

---

## Architecture

See `ARCHITECTURE.md` for full technical detail.

**Key facts:**
- Stateless Cloud Run — no per-tenant containers
- Gemini 2.0 Flash — locked, do not change
- 19 function-calling tools
- 4-layer key fallback system
- Memory Architecture V4.1 — dynamic prompts, Sawtooth compression, fact anchors
- BullMQ + Redis for all async work

---

**Maintainer:** Brent Bryson (BotCraft Works)
