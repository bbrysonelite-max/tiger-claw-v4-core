# State of the Tiger — Path Forward

**Last Updated:** 2026-04-03 (Session 6)

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

---

## Session 6 — What Was Done (2026-04-02 / 2026-04-03)

### April 2 — Post-Zoom Failure Fixes

On April 2, a live Zoom onboarding call with John (Thailand) failed completely. See `dramatic-failure.md` for the full account. These fixes followed immediately:

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
| #145 | `fix-all-webhooks` was JOINing `bot_pool` (doesn't exist in BYOB arch) — returned 0 rows every time, registered nothing |
| #146 | 8s timeout on Telegram token validation (kills infinite spinner) + LINE Official Account warning |
| #147 | Provisioning suspension now sends admin alert — was silent |
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
| #165 | `TELEGRAM_WEBHOOK_SECRET` trailing newline fix — was killing all bots after every deploy |
| #166 | LINE removed from customer dashboard |
| #167 | Root page redirects to `/signup`, copy tightened |
| #168 | Manual report trigger allowed for onboarding tenants |
| #169 | Daily scout waterfall — never reports failure, never idles |
| #170 | Reset-conversation clears `onboard_state` from PostgreSQL |

### This Session (2026-04-03 evening)
| Change | What |
|--------|------|
| Scout mode default | Changed from `scheduled` to `burst` — user-triggered runs were blocked by 23h cooldown |
| Admin endpoint | `POST /admin/fleet/:tenantId/clear-circuit-breaker` added |
| Short magic links | `GET /go/:code` redirect — tokens no longer exposed in shareable URLs |
| Full live audit | All external services tested. Results in ARCHITECTURE.md. |
| SOTU, START_HERE, ARCHITECTURE, STATE_OF_THE_TIGER updated | Honest current state |

---

## Known Broken — Current

| Item | Impact | Fix |
|------|--------|-----|
| All 3 Serper keys (403) | Scout finds zero prospects on every tenant — core product function is broken | New keys from serper.dev |
| Platform emergency Gemini key (expired) | No AI fallback if platform key quota hit | Renew GCP secret |
| Resend not in deploy script | No transactional emails in production | Add to deploy-cloudrun.sh |
| nurture_check calls tiger_scout incorrectly | Wrong routine behavior | Code fix needed |
| Reddit 403 from Cloud Run | Scout source down | Investigate egress IP / User-Agent |
| Vercel auto-deploy broken | Wizard must be deployed manually | Fix Root Directory in Vercel settings |

---

## Tech Debt

| Item | Priority |
|------|----------|
| Remove Zapier dead code (`/webhooks/stan-store`, `ZAPIER_WEBHOOK_SECRET`) | LOW |
| Remove Stripe dead code (`STRIPE_*` env vars, `/webhooks/stripe`) | LOW |
| `bot_ai_keys` dead write (wizard writes here, runtime reads `bot_ai_config`) | LOW |
| ~25 dead BotFather test bots need `/deletebot` cleanup | LOW |
| Stan Store → Lemon Squeezy/Paddle (international VAT) | DEFERRED |
| LINE Phase 2 (requires LINE Official Account — customer-side requirement) | DEFERRED |
| Customer-facing dashboard (Phase 2) | DEFERRED |

---

## Session 5 — What Was Done (2026-04-01)

| PR | Fix |
|----|-----|
| #122 | value-gap JOIN type cast (`varchar = uuid`) crash |
| #123 | `INTERNAL_API_URL` missing from deploy — tiger_keys/hive/onboard/settings fataling |
| #124 | Remove `bot_pool` from `/health` — V4 has no pool |
| #125 | Relevance gate — blocks gaming/fiction facts from Data Moat |
| #126 | Voice overhaul — examples replace 40-line rules wall |
| #127 | tiger_scout rate limit reason hidden from Gemini |
| #128 | Only `output` string passed to Gemini |
| #129 | Morning hunt report at 7 AM UTC |
| #130 | Admin dashboard timeout fix |
| #131 | Admin dashboard UX — localStorage token, 5min refresh |

---

## Infrastructure

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1 primary, asia-southeast1 secondary) |
| Cloud SQL proxy | port **5433** locally, user `botcraft`, DB `tiger_claw_shared` |
| Admin | `wizard.tigerclaw.io/admin` |
| Deploys (API) | GitHub Actions on merge to main |
| Deploys (Wizard) | Manual — Vercel auto-deploy is broken |
| Post-deploy | Always run `POST /admin/fix-all-webhooks` |

---

## Rules of Engagement

1. One PR per fix. No chaining.
2. `feat/` branches only. No AI agent pushes to main.
3. Architecture is LOCKED. No RAG, no containers, no OpenClaw.
4. No new features without a customer asking for it.
5. No session is marked COMPLETE if known broken items remain unresolved.
