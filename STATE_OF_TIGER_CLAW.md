# STATE OF TIGER CLAW — HARD CONTEXT LOCK
**Timestamp:** 2026-03-24
**Infrastructure Status:** LIVE. 155/155 tests green. Memory Architecture V4.1 fully shipped.

---

## MANDATORY DIRECTIVE TO ALL AI AGENTS

This is the single source of truth for the Tiger Claw repository.

1. **NO RAG.** Mini-RAG has been physically removed. It does not exist.
2. **NO OPENCLAW.** No per-tenant Docker containers. OpenClaw is dead.
3. **NO CANARIES.** The canary group concept is deprecated. All tenants are treated equally until scale justifies it.
4. **ARCHITECTURE:** Stateless Google Cloud Run API, Gemini 2.0 Flash (locked — 2.5 Flash has a GCP function-calling bug), 19 Native Function Calling Tools (`api/src/tools/`), shared PostgreSQL.
5. **NO REWRITES:** The 19 core tools compile cleanly and are backed by 155 passing tests. Do not rewrite architecture.
6. **PROTOCOL:** Read `CLAUDE.md` before writing any code.

---

## GIT PROTOCOL — NON-NEGOTIABLE

- NEVER push directly to main. main is branch-protected.
- ALL work goes on a feature branch: `feat/`, `fix/`, `chore/`
- When work is complete and tests pass: open a PR.
- PRs #23 and #24 are pending merge (memory Phase 4 + CLAUDE.md product philosophy).

**Deploy sequence:**
```bash
git checkout -b feat/your-description
# make changes, run tests
git push origin feat/your-description
gh pr create --title "feat: your description" --body "What changed and why"
gh pr merge --auto --squash
```

Deployments to Cloud Run are handled by GitHub Actions on merge to main. Do not run deploy scripts locally.

---

## Current State (2026-03-24)

### Architecture
- **API:** Cloud Run, Node.js/Express, port 4000, `https://api.tigerclaw.io`
- **DB:** Cloud SQL PostgreSQL HA (`tiger_claw_shared`)
- **Cache/Queue:** Cloud Redis HA + BullMQ (5 queues)
- **AI:** Gemini 2.0 Flash via `@google/generative-ai` SDK (locked — do not change)
- **Frontend (wizard):** Next.js on Vercel (`wizard.tigerclaw.io`) — part of `tiger-claw-v4-core` repo, `web-onboarding/` subdirectory
- **Frontend (website):** Static HTML on Vercel (`tigerclaw.io`) — separate repo `tiger-bot-website`
- **Payments:** Stan Store (purchase gating) + Stripe (subscription checkout)
- **Email:** Resend
- **Bot Pool:** 42 available Telegram bot tokens, AES-256-GCM encrypted
- **GCP Project:** `hybrid-matrix-472500-k5`
- **Cloud Run Service:** `tiger-claw-api`, region `us-central1`

### Product (as of 2026-03-24)
- **Tiger-Claw Pro (Pre-Flavored):** $147/mo — Telegram + LINE, pre-trained for sales and network marketing. Stan Store: `stan.store/brentbryson/p/tired-of-manually-searching-for-leads-`
- **Industry Agent:** $197/mo — domain pre-trained for a specific vertical. Stan Store: `stan.store/brentbryson/p/custom-agent-flavor`
- "Standard Agent" naming is DEAD. It is now "Industry Agent."

### Recent Work Completed
- **Memory Architecture V4.1** — All 4 phases shipped:
  - Phase 1: `buildSystemPrompt()` async, injects ICP + hive signals + pipeline stats
  - Phase 2: Sawtooth context compression (`chat_memory` Redis key, 30d TTL)
  - Phase 3: Fact anchor extraction (async BullMQ job → `tenant_states.fact_anchors`)
  - Phase 4: `startFocus` / `completeFocus` / `incrementFocusToolCalls` session primitives
- **CLAUDE.md:** Product philosophy baked in — Integrity First, Radical Value Delivery, Zero Complexity
- **Website fixes:** Industry Agent naming, Stan Store deep links wired, Pre-Flavored label on Tiger-Claw Pro
- **CORS fixed:** `wizard/auth` API call works cleanly from wizard.tigerclaw.io
- **john-thailand:** Fresh tenant provisioned for John (Thailand). `john-noon` left as suspended tombstone.
- **pat-sullivan:** Removed (never activated).

### Open Issues

1. **Value-gap detection** — No cron logic yet to detect paying tenants with zero leads in 7 days and send a diagnostic message. Required by CLAUDE.md product philosophy.

2. **`[Mockup] Skip AI` button** — Not in source code. Was in a stale compiled build. Will be eliminated on next wizard deploy (when PRs #23/#24 merge to main).

3. **OG/social meta tags** — `tigerclaw.io` has no `og:title`, `og:image`, `twitter:card`. Every shared link renders as a bare URL. Low effort, high impact fix.

4. **Wizard auth error has no purchase CTA** — When a user enters an email with no purchase, the error message tells them to go to Stan Store but provides no link.

5. **Wizard deployed build is stale** — PRs #23/#24 need to merge to main to trigger a fresh Vercel deploy and kill the stale build artifacts.

6. **Mac cluster Reflexion Loop tooling** — The offline batch job that reads `fact_anchors` / `chat_memory` and proposes system prompt improvements has not been built yet.

---

## Memory Architecture (V4.1 — FULLY SHIPPED)

**Design:** Hybrid Cognitive Architecture — Cloud Run executes stateless, Redis/PostgreSQL hold all persistent memory.

### Redis Keys
| Key | Purpose | TTL |
|---|---|---|
| `chat_history:{tenantId}:{chatId}` | Raw turn history | 7 days |
| `chat_memory:{tenantId}:{chatId}` | Sawtooth compressed summaries | 30 days |
| `focus_state:{tenantId}:{chatId}` | Session bookending | 24 hours |

### `tenant_states` Keys
| `state_key` | Purpose |
|---|---|
| `onboard_state` | Onboarding interview answers |
| `fact_anchors` | Extracted business facts from live conversations |

### Phase Status
- [x] Phase 1: Dynamic prompt enrichment — shipped
- [x] Phase 2: Sawtooth context compression — shipped
- [x] Phase 3: Fact anchor extraction — shipped
- [x] Phase 4: `startFocus` / `completeFocus` primitives — shipped (PR #23 pending merge)

### Mac Cluster (192.168.0.2) — OFFLINE ONLY
The Cheese Grater is an **offline Reflexion Loop tool**. It reads Cloud SQL via Auth Proxy, analyzes `fact_anchors` and `chat_memory` across tenants, and proposes system prompt improvements for Brent to review. It is **NOT** called by Cloud Run and cannot break production if offline.

---

## Tenant Roster (Notable)

| Slug | Status | Notes |
|---|---|---|
| `john-thailand` | onboarding | Fresh provision 2026-03-24. Bot: @tc_62g6al77_bot |
| `john-noon` | suspended | Webhook conflict. Left as tombstone. Superseded by john-thailand |
| `pat-sullivan` | terminated | Never activated. Removed 2026-03-24 |

---

*Locked. Proceed.*
