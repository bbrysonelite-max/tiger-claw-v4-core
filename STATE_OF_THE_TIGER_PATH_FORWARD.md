# State of the Tiger — Path Forward

**Last Updated:** 2026-04-09 (Session 18 close — PRs #274–#282 all merged)

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
| 13 | Full Reliability & Security Audit (57 issues) | ✅ Done (Sessions 9+10) — PRs #189–#209 |
| 14 | Round 2 Audit (38 issues) + Phase 1 Security Fixes | ✅ Done (Session 11) — PR #210 |
| 15 | Paddle Integration + Verbatim Mine Fix | ✅ Done (Session 15) — PRs #235–#237 |
| 16 | ICP Hard-Wire + BYOB/BYOK Hatch Fixes | ✅ Done (Sessions 16–17) — PRs #251–#261 |
| 17 | Strike Pipeline + Orchestrator Dedup + Dashboard Contrast | ✅ Done (Session 17) — PRs #263–#267 |
| 18 | Prospect Engagement Mode + Bot Persona Fixes | ✅ Done (Session 17 close) — PRs #269–#272 |
| 19 | Remove Bot Pool — BYOB only, all tokens from BotFather | ✅ Done (Session 18) — PRs #274–#275 |
| 20 | Ground-truth doc audit — full codebase verified, all documents rewritten | ✅ Done (Session 18) — PRs #276–#279 |
| 21 | ICP field rename + admin hatch custom ICP + commander-language wizard cleanup | ✅ Done (Session 18) — PRs #280–#282 |

---

## Current Focus

**Deploy the API (PRs #278/#280/#281 are merged but not live), then verify `brents-tiger-01-mns7wcqk`.** onboard_state was written directly to DB with full identity + ICP. Bot has not been verified responding correctly. Paddle product/price still not created — no checkout URL exists.

---

## Sessions 15–17 — What Was Done (2026-04-06 to 2026-04-08)

### Session 18 — PRs #274–#282

| PR | Fix |
|----|-----|
| #274 | Remove bot pool: 5,559 lines deleted. All `bot_pool` DB functions, `/admin/pool/*` routes, ops scripts, docs gone. `pool.ts` is crypto/Telegram utilities only. Eliminated the silent fallback chain (missing BYOK → platform key → 429 → OpenRouter) that burned $100. |
| #275 | Post-#274 collateral fix: `updateTenantChannelConfig` accidentally deleted from `db.ts`. `/admin/fix-pool-orphans` route still referenced deleted function. Deploy was failing; this unblocked it. |
| #276 | Session docs update — SOTU.md and STATE_OF_THE_TIGER_PATH_FORWARD.md updated for PRs #274–#275. |
| #277 | Repo cleanup — `api/cloud-sql-proxy` (32 MB binary) untracked from git. 37 loose scripts moved from `api/` root → `api/scripts/`. 4 stale audit markdown files → `docs/archive/`. `.claude/worktrees/` added to `.gitignore`. |
| #278 | Agent context fix: `hasOnboarding` requires real identity data (not just `phase=complete`). `displayOperatorName` fallback to "my operator". Empty identity fields omitted from operator block. Provisioner writes `phase="identity"` when no product provided at hatch. |
| #279 | Ground-truth doc rewrite — full codebase audit, all documents rewritten from verified state. Rule 16 (Documentation Protocol) added to RULES.md. |
| #280 | Admin hatch custom ICP — `/admin/hatch` accepts `icpProspect` and `icpProduct`. Bot wakes with operator's exact ICP instead of flavor defaults. |
| #281 | ICP field rename — `icpBuilder` → `icpProspect`, `icpCustomer` → `icpProduct` everywhere: interfaces, DB reads/writes, system prompts, tools, tests, docs. No schema changes. |
| #282 | Commander-language cleanup — wizard UI: ICP step deleted (5→4 steps), `sales-tiger` removed from signup, internal terms replaced. `StepCustomerProfile.tsx` deleted. Dashboard shows "Tiger Agent" not flavor string. |

### Session 17 — PRs #263–#272

| PR | Fix |
|----|-----|
| #263 | Orchestrator Redis SETNX dedup — Reporting Agent was firing 5x per mine run due to research agent retry counts. Moved `markFactsQueued` before `draftReplies` in Strike pipeline. |
| #264 | Strike harvest root cause: `verbatim` column doesn't exist in `market_intelligence`. SQL crash on every run since wiring. Removed from SELECT, interface, and prompt. First successful run confirmed: 20 engagement links, admin alert delivered. |
| #265 | Rule 13 added to RULES.md: update RULES.md + SOTU.md after every merge. |
| #267 | Dashboard contrast fix — admin fleet dashboard and customer dashboard illegible gray-on-dark text bumped to readable contrast levels. |
| #268 | Session docs update (partial) — START_HERE, ARCHITECTURE, STATE_OF_THE_TIGER_PATH_FORWARD updated. |
| #269 | Provisioner botName top-level fix (CRITICAL) — `botName` written inside `identity{}` only; code reads at top level. Gemini saw "Bot name: —" and entered confused self-onboarding loop. Fixed: `botName` + `completedAt` written at top level on every hatch. Direct DB fix + polluted fact_anchors cleaned on live bot. |
| #270 | Prospect engagement mode — system prompt was 100% operator-management frame. Added: WHO YOU ARE TALKING TO block, dream injection directive, covenant opening for new conversations, HARD RULE: never surface internal state. 4 prospect voice examples added. |
| #271 | Bot description + /start message — description exposed "Tiger Claw" brand to prospects. Replaced with covenant line. /start ending "I'm having my nails done later!" → "What's going on for you right now?" Live bot updated immediately. |
| #272 | No tool names in responses — previous rule missed shorthand variants (tigerlead, tigernurture, tigerstrikedraft, etc.). Explicitly listed all variants. Added: never explain reasoning out loud mid-message. |

### Sessions 15–16 — PRs #235–#261

| PR | Fix |
|----|-----|
| #235 | Verbatim field in `tiger_refine.ts` — exact quotes required, 15-char minimum. Mine producing 1,684 facts/run with Oxylabs. |
| #236 | Paddle webhook integration — HMAC-SHA256 verification, Redis idempotency, provisions BYOK user+bot+subscription on `transaction.completed`. |
| #237 | Wizard flavor fix — 5 cut flavors removed, 8 canonical flavors remain. |
| #251 | Bot-status fix — `wizard/bot-status` returned `pending` for admin-hatched bots. Added `'live'` status to isLive checks. |
| #252 | Duplicate tenant bug — hatch was creating two records due to slug generated twice with different `Date.now()`. |
| #253 | Dashboard isLive fix + Stan Store copy cleanup. |
| #255 | ICP hard-wire — provisioner pre-seeds `onboard_state.json` at hatch. Bot wakes fully calibrated. No interview. |
| #258 | WHAT_TIGER_CLAW_DOES.md — new product vision doc. |
| #260 | `tiger_book_zoom` — Cal.com booking tool built and registered. Inactive pending booking architecture decision. |
| #261 | 4-language `/start` greeting, language-matching system prompt, Strike pipeline wired to Reporting Agent, Interior Designer removed from wizard. |

---

## Session 11 — What Was Done (2026-04-05)

Round 2 audit by 5 parallel sub-agents found 38 new issues. Phase 1 (all HIGH severity security) fixed immediately.

| PR | Fix |
|----|-----|
| #210 | R2-P1-1/2: GET + POST /dashboard/:slug — added requireSession + ownership check (any attacker could read all tenant data or hijack API key) |
| #210 | R2-P1-3/4/5: PATCH/POST /tenants/:id/status|scout|keys/activate — added requireAdmin (attacker could terminate any bot) |
| #210 | Updated tiger_onboard.ts internal self-calls to pass Authorization header |
| #210 | R2-P1-7: saveMarketFact() now normalizes source URL before storage (moat was accumulating duplicates on every mining run) |
| #210 | Added requireSession middleware export to auth.ts |

**Deployed: revision `tiger-claw-api-00330-6ml`. Health confirmed. Webhooks re-registered.**

**32 remaining issues (Phase 2 + Phase 3) open in `audit-session10-round2.md`.**

---

## Sessions 9+10 — What Was Done (2026-04-04)

Full reliability & security audit by 6 parallel sub-agents found 57 issues. All resolved or deferred.

| PRs | Fix |
|-----|-----|
| #189–#209 | 57 issues — schema fixes, auth hardening, scoreThreshold threading, provisioner botId optional, admin_events column names, bot_ai_keys FK, URL dedup, and more |

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
| API not deployed | PRs #278/#280/#281 merged but not live — `tiger-claw-api-00442-tjd` is the active revision | Deploy at next session start |
| `brents-tiger-01-mns7wcqk` not verified | onboard_state written, bot has not been tested from a fresh chatId | Verify after deploy |
| Paddle product/price not created | No checkout URL — Paddle path unproven | Create product + price in Paddle dashboard |
| Reddit 403 from Cloud Run egress | Mine uses Oxylabs + Serper fallback (working) | Awaiting Reddit API approval or Oxylabs Reddit proxy |
| Admin alert markdown bug | Alerts with underscores in error text fail silently | Escape underscores in sendAdminAlert() |
| Payment gate open (C4) | Anyone can access wizard without paying | Fix after Paddle loop proven |

---

## Tech Debt

| Item | Priority |
|------|----------|
| Remove Zapier dead code (`/webhooks/stan-store`, `ZAPIER_WEBHOOK_SECRET`) | LOW |
| Remove Stripe dead code (`STRIPE_*` env vars, `/webhooks/stripe`) | LOW |
| source_url missing index on market_intelligence table | MEDIUM — R2-P2-2 in audit |
| factExtractionWorker failures produce no admin alert | MEDIUM |
| marketIntelligenceWorker failures produce no admin alert | MEDIUM |
| WIZARD_SESSION_SECRET not in deploy script (safe via fallback) | LOW — R2-P2-16 in audit |
| serperKeyIndex + serperCallsThisRun are module-level globals — broken under concurrency | HIGH — R2-P2-1/3 in audit |
| Postmark webhook has no auth when POSTMARK_WEBHOOK_TOKEN absent | MED — R2-P2-6 in audit |
| Telegram message dedup missing — retries can double-send replies | MED — R2-P2-14 in audit |
| 32 total open items in Round 2 audit | See `audit-session10-round2.md` |
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
| Cloud SQL proxy | port **5433** locally, instance `tiger-claw-postgres-ha`, user `botcraft`, DB `tiger_claw_shared` |
| Admin | `wizard.tigerclaw.io/admin` |
| Deploys (API) | `GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh` |
| Deploys (Wizard) | Vercel auto-deploy — push to main triggers deploy automatically |
| Post-deploy | Run `POST /admin/fix-all-webhooks` (idempotent — webhook secret now baked into deploy) |

---

## Rules of Engagement

1. One PR per fix. No chaining.
2. `feat/` or `fix/` branches only. No AI agent pushes to main.
3. Architecture is LOCKED. No RAG, no containers, no OpenClaw.
4. No new features without a customer asking for it.
5. No session is marked COMPLETE if known broken items remain unresolved.
6. `tiger_gmail_send` and `tiger_postiz` are intentionally NOT in toolsMap. Do not re-add.
