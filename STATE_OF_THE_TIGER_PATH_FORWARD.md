# State of the Tiger — Path Forward

**Last Updated:** 2026-04-04 (Session 8)

**No lying. No assuming. No guessing.**

---

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Container Health | ✅ Done |
| 2 | Database Cleanup | ✅ Done |
| 3 | BYOK Key Path | ✅ Done |
| 4 | Wizard Hatch Fixes | ✅ Done |
| 5 | Wizard Completion & Hardening | ✅ Done |
| 6 | Fire Test | ✅ Passed 2026-03-29 |
| 7 | Social Moat & Brand Soul | ✅ Done |
| 8 | Launch Day Hardening | ✅ Done (Session 5) |
| 9 | April 2 Failure Recovery | ✅ Done (Session 6) |
| 10 | Phase 1 Self-Serve Signup | ✅ Built and deployed (Session 6) |
| 11 | Silent Failure Audit + Full Platform Green | ✅ Done (Session 7) |
| 12 | Tool Safety Audit + Admin Mine Controls | ✅ Done (Session 8) |

---

## Current Focus

**Get first 10 customers running.** Operator + Jeff Mack + John (Thailand) have access to ~60,000 NuSkin distributors. Target: first 10 onboarded, running for one week, no fires. Then expand to next 40.

Jeff, John, and Debbie all need to complete the wizard. Links go to `wizard.tigerclaw.io/signup`.

---

## Session 8 — What Was Done (2026-04-04)

| PR | Fix |
|----|-----|
| #186 | Mine engine controls in admin dashboard — live status indicator, Run Now button, last run stats, `mine_complete` admin event logging |
| #187 | Tool safety audit: 43 new tests (455 total), tiger_gmail_send + tiger_postiz removed from toolsMap, active agent count fixed in /admin/metrics, tiger_strike_draft test fixed |

---

## Session 7 — What Was Done (2026-04-04)

Full audit by 6 parallel sub-agents revealed 14 broken items including things broken since launch.

| PR | Fix |
|----|-----|
| #174 | Serper fallback for market miner (Reddit dead 6 days) |
| #175 | TELEGRAM_WEBHOOK_SECRET wired into deploy (post-deploy webhook fix now idempotent, not mandatory) |
| #176 | RESEND_API_KEY in deploy, admin alert env var names fixed, nurture_check prompt fixed |
| #177 | Dead key alerts routed through sendAdminAlert (not UUID) |
| #178 | 72-hour duplicate account window removed |
| #179 | Slug collision guard in wizard hatch |
| #180 | Scoring ceiling fixed (engagement weight normalized) |
| #181 | tiger_refine registered in toolsMap |
| #182 | getTenant() wrapped in try/catch in webhook hot path |
| #183 | CI test updated to match new rate limit message |
| #184 | tiger_strike_draft FK validation — prevents hallucinated fact UUIDs crashing inserts |
| #185 | System prompt rule: never report tool failures to operator, never ask "what's it gonna be?" |

---

## Session 6 — What Was Done (2026-04-02 / 2026-04-03)

### April 2 — Post-Zoom Failure Fixes

On April 2, a live Zoom onboarding call with John (Thailand) failed completely. These fixes followed immediately:

| PR | Fix |
|----|-----|
| #136 | `ENABLE_WORKERS` not set — provisioner and all workers silently off since launch |
| #139 | `ENABLE_WORKERS=true` added to deploy script permanently |
| #133 | Customer dashboard — inline AI key update + leads section |
| #134 | Slash commands: `/dashboard`, `/status`, `/help` |
| #135 | Dashboard type error — `connectionType → priority` |
| #137 | Hatch spinner → step-by-step progress |
| #138 | ICP fast-path opening — Soul voice, not raw ICP dump |
| #140 | Tiger announces on X after hatch (later removed — PR #164) |
| #141 | Save `bot_username` to DB after provisioning |
| #142 | CI postgres role fix + worker health check |
| #143 | Mobile wizard E2E tests (iPhone 13) |

### April 3 — Root Cause Fixes + Phase 1 Build

| PR | Fix |
|----|-----|
| #145 | `fix-all-webhooks` was JOINing `bot_pool` (doesn't exist in BYOB arch) — returned 0 rows every time |
| #146 | 8s timeout on Telegram token validation + LINE Official Account warning |
| #147 | Provisioning suspension now sends admin alert |
| #148 | Admin dashboard surfaces API errors instead of blank |
| #149–#155 | Docs: SOTU as single source of truth, LINE deferred, Phase 1 PRD, Stan Store flow confirmed |
| #156 | Phase 1 single-page `/signup` built |
| #157 | CI test failures resolved |
| #158 | Signup calling wrong verify-purchase endpoint |
| #159 | Hatch payload missing email + wrong customerProfile fields |
| #160 | Hatch endpoint accepts `aiKey` inline for Phase 1 flow |
| #161 | `botToken` not `telegramBotToken` in hatch payload |
| #162 | Check `data.ok` not `data.success` in hatch response |
| #163 | `ok` field added to `HatchResponse` type |
| #164 | X/Twitter announcement removed; signup tagline added |
| #165 | `TELEGRAM_WEBHOOK_SECRET` trailing newline fix |
| #166 | LINE removed from customer dashboard |
| #167 | Root page redirects to `/signup` |
| #168 | Manual report trigger allowed for onboarding tenants |
| #169 | Daily scout waterfall — never reports failure |
| #170 | Reset-conversation clears `onboard_state` from PostgreSQL |

---

## Known Broken — Current

| Item | Impact | Fix |
|------|--------|-----|
| Jeff / John / Debbie not onboarded | No paying customers running | Send them wizard link |
| Vercel auto-deploy broken | Wizard must be deployed manually | Fix Root Directory in Vercel settings |
| Reddit 403 from Cloud Run egress | Mine uses Serper fallback (working) | Awaiting Reddit API approval |

---

## Tech Debt

| Item | Priority |
|------|----------|
| Remove Zapier dead code (`/webhooks/stan-store`, `ZAPIER_WEBHOOK_SECRET`) | LOW |
| Remove Stripe dead code (`STRIPE_*` env vars, `/webhooks/stripe`) | LOW |
| source_url missing index on market_intelligence table | MEDIUM |
| factExtractionWorker failures produce no admin alert | MEDIUM |
| marketIntelligenceWorker failures produce no admin alert | MEDIUM |
| WIZARD_SESSION_SECRET not in deploy script (safe via fallback) | LOW |
| Stan Store → Lemon Squeezy/Paddle (international VAT) | DEFERRED |
| LINE Phase 2 (requires LINE Official Account) | DEFERRED |
| Customer-facing dashboard | DEFERRED |
| Affiliate tracking for Max Steingart deal | DEFERRED — build when he sends first customer |

---

## Deferred Features (Do Not Build Yet)

- **Reflexion Loop** — outcome signals feed back into fact_anchors. Build after 10+ agents have real data.
- **Agent Leaderboard** — opt-in fleet ranking. Build after Reflexion Loop.
- **White label** — hold at affiliate/referral model until Max sells 10.
- **Partner portal / rev share automation** — only if white label deal proves out.

---

## Infrastructure

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1 primary, asia-southeast1 secondary) |
| Cloud SQL proxy | port **5433** locally, user `botcraft`, DB `tiger_claw_shared` |
| Admin | `wizard.tigerclaw.io/admin` |
| Deploys (API) | `GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh` |
| Deploys (Wizard) | Manual — Vercel auto-deploy is broken |
| Post-deploy | Run `POST /admin/fix-all-webhooks` (idempotent — webhook secret now baked into deploy) |

---

## Rules of Engagement

1. One PR per fix. No chaining.
2. `feat/` or `fix/` branches only. No AI agent pushes to main.
3. Architecture is LOCKED. No RAG, no containers, no OpenClaw.
4. No new features without a customer asking for it.
5. No session is marked COMPLETE if known broken items remain unresolved.
6. `tiger_gmail_send` and `tiger_postiz` are intentionally NOT in toolsMap. Do not re-add.
