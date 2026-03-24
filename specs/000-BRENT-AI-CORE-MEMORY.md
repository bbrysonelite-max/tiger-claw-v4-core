# Brent's AI Core Memory — Tiger Claw

**Last updated:** 2026-03-24

---

## 1. Identity

- **Client:** Brent Bryson (BotCraft Works)
- **Product:** Tiger Claw — multi-tenant AI sales agent platform
- **Live URL:** `https://api.tigerclaw.io`
- **GCP Project:** `hybrid-matrix-472500-k5`

---

## 2. Architecture

**V4 Stateless Cloud Run.** See `ARCHITECTURE.md` for full detail.

- Hosting: Google Cloud Run
- Database: Cloud SQL PostgreSQL HA (`tiger_claw_shared`)
- Cache/Queue: Cloud Redis HA + BullMQ
- AI: Gemini 2.0 Flash (`@google/generative-ai`) — LOCKED
- No Docker containers per tenant
- No OpenClaw
- No Mini-RAG
- No RAG of any kind

---

## 3. Critical Rules

### JuicySMS Is Dead
JuicySMS does NOT work for Telegram. Any AI that references JuicySMS is hallucinating. Brent provisions Telegram sessions manually via SMS-Activate, 5SIM, or physical SIM cards. The script `ops/botpool/provision_juicysms.ts` exists only as a historical artifact — do not use it.

### OpenClaw Is Dead
OpenClaw was the previous per-tenant Docker container architecture. It has been permanently removed. Do not reference it, do not restore it, do not install `@anthropic-ai/sdk`.

### Mini-RAG Is Dead
Mini-RAG has been physically removed from this repository. It does not exist. Do not reference it.

### Gemini 2.0 Flash Is Locked
`gemini-2.5-flash` has a GCP function-calling bug (silent JSON parameter suppression). The model is locked at `gemini-2.0-flash`. Do not change it.

---

## 4. Network

| Machine | IP | Role |
|---|---|---|
| Cheese Grater | 192.168.0.2 | Main dev workstation (Mac Pro 2019) |
| iMac | 192.168.0.116 | Secondary machine |
| MacBook Air | 192.168.0.237 | Mobile dev |
| Trash Can "Birdie" | 192.168.0.136 | Potential offline Reflexion Loop host |
| Trash Can "Monica" | 192.168.0.138 | Research machine |

The Mac cluster is **NOT a live Cloud Run dependency**. It is an offline tool for Reflexion Loop analysis only.

---

## 5. Deployment

**All production deployments are automatic via GitHub Actions on merge to `main`.**

- Never push directly to `main`
- Never run `ops/deploy-cloudrun.sh` locally for production deploys
- Always use `feat/` branches and PRs

---

## 6. Product

| Product | Price | Stan Store |
|---|---|---|
| Tiger-Claw Pro (Pre-Flavored) | $147/mo | `stan.store/brentbryson/p/tired-of-manually-searching-for-leads-` |
| Industry Agent | $197/mo | `stan.store/brentbryson/p/custom-agent-flavor` |

Tiger-Claw Pro = pre-flavored for sales/network marketing. Ships ready.
Industry Agent = custom domain pre-training for a specific vertical.

---

## 7. Bot Rate Limiting

**8-minute minimum** between bot creations via BotFather to avoid Telegram bans. Never remove or reduce this wait time in any BotFather automation scripts.
