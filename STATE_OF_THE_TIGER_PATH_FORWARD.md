# State of the Tiger — Path Forward

**Last Updated:** 2026-04-01 (Session 5)
**Author:** Claude Sonnet 4.6

---

## Phase Status

**Phase 1 — Container Health** ✅
**Phase 2 — Database Cleanup** ✅
**Phase 3 — BYOK Key Path** ✅
**Phase 4 — Wizard Hatch Fixes** ✅
**Phase 5 — Wizard Completion & Hardening** ✅
**Phase 6 — Fire Test** ✅ (Jeff Mack demo PASSED 3/30)
**Phase 7 — Social Moat & Brand Soul** ✅
**Phase 8 — Launch Day Hardening** ✅ (Session 5 — 2026-04-01)

---

## Session 5 — What Was Done (2026-04-01)

### Critical Production Fixes
| # | Fix | PR |
|---|-----|-----|
| 1 | `INTERNAL_API_URL` not set — tiger_keys/hive/onboard/settings fataling on every call since launch | #123 |
| 2 | value-gap JOIN type cast (`varchar = uuid`) — check-ins broken for all tenants since feature added | #122 |
| 3 | bot_pool `critical: 0` false alarm in `/health` — V4 has no pool | #124 |

### Data Quality
| # | Fix | PR |
|---|-----|-----|
| 4 | Relevance gate — second Gemini call blocks gaming/fiction facts from entering Data Moat | #125 |

### Voice & Personality
| # | Fix | PR |
|---|-----|-----|
| 5 | Voice overhaul — 40-line rules wall replaced with 5 conversation examples | #126 |
| 6 | tiger_scout rate limit reason hidden from Gemini | #127 |
| 7 | Only `output` string passed to Gemini — strips raw tool data fields | #128 |

### Morning Report
| # | Fix | PR |
|---|-----|-----|
| 8 | Morning hunt report — daily_scout now sends proactive message to operator at 7 AM UTC | #129 |

### Admin Dashboard
| # | Fix | PR |
|---|-----|-----|
| 9 | Timeout fix — N+1 getBotState calls → single query | #130 |
| 10 | UX — localStorage token, 5min refresh, new agents today | #131 |

### Customer Onboarding (manual)
- Debbie (`justagreatdirector@outlook.com`) — already in DB, `pending_setup`
- Jeff Mack (`jeffmackte@gmail.com`) — DB record created manually, `pending_setup`
- John / vijohn (`vijohn@hotmail.com`) — DB record created manually, LINE bot, th-th, `pending_setup`

---

## Known Issues / Tech Debt

| Item | Priority | Status |
|------|----------|--------|
| `bot_ai_keys` dead write | LOW | Open — wizard writes here, runtime reads `bot_ai_config` |
| Navigation recovery in wizard | MEDIUM | Open — dashboard link kills wizard state |
| ~25 dead BotFather bots | LOW | Open — need manual /deletebot cleanup |
| CI Postgres `role "root"` | INFRA | Open — pre-existing GitHub Actions infra bug |
| Customer-facing dashboard | MEDIUM | Not built — reduces Telegram token friction |
| Other Stan Store customers | HIGH | chana.loh, nancylimsk, lily.vergara — paid but not onboarded |

---

## Next Steps (Session 6)

1. **Activate remaining Stan Store customers** — chana.loh, nancylimsk, lily.vergara need DB records + wizard link
2. **First paying customer live** — confirm Debbie / Jeff / John complete wizard and hatch
3. **Customer dashboard** — Brent identified this as critical for churn reduction
4. **bot_ai_keys cleanup** — small PR when convenient

---

## DB State (as of 2026-04-01 end of Session 5)

| Email | Name | Status | Channel | Notes |
|-------|------|--------|---------|-------|
| `phaitoon2010@gmail.com` | ToonScoutV2 / Toon Scout / TOON Scout | active | Telegram | Beta tester, 3 bots |
| `bbryson@me.com` | Tiger-monkey / Captain Tiger Two / etc. | active | Telegram | Brent's test bots |
| `justagreatdirector@outlook.com` | justagreatdirector | pending_setup | Telegram | Debbie — paying customer |
| `jeffmackte@gmail.com` | Jeff Mack | pending_setup | Telegram | $147 Pro — paying customer |
| `vijohn@hotmail.com` | John | pending_setup | LINE | Thailand — paying customer |
| `firetest@tigerclaw.io` | Bug 1 Fixed Bot | active | Telegram | Test bot |
| `heylookbrentisgolfing@gmail.com` | heylookbrentisgolfing | active | Telegram | Test bot |

---

## Merged PRs (Full Session History)

| PR | Description | Date |
|----|-------------|------|
| #93–#110 | Sessions 1–2 (see START_HERE.md) | 3/23–3/30 |
| #111 | fix: 3 critical fire test bugs | 3/31 |
| #112 | feat: market intelligence → buildSystemPrompt | 3/31 |
| #113 | fix: dashboard AI engine label + Telegram dual-state | 3/31 |
| #114 | fix: wizard ICP fast-path — write icpSingle + botName at hatch | 3/31 |
| #115 | fix: buildSystemPrompt fallback to customerProfile | 3/31 |
| #116 | fix: Grok model → grok-4-1-fast-non-reasoning | 3/31 |
| #117 | feat: admin dashboard + grok key health + SOUL + Postiz | 4/1 |
| #118 | docs: session 3 state | 4/1 |
| #119 | fix: migration 022 column names — crashed every Cloud Run startup | 4/1 |
| #120 | feat: SOUL_VOICE_BLOCK first in every system prompt | 4/1 |
| #75 | feat: Stan Store audit | 4/1 |
| #121 | fix: remove 72-hour trial system | 4/1 |
| #122 | fix: value-gap type cast | 4/1 |
| #123 | fix: INTERNAL_API_URL in deploy script | 4/1 |
| #124 | fix: remove bot_pool from /health | 4/1 |
| #125 | feat: relevance gate for data refinery | 4/1 |
| #126 | feat: Tiger voice — examples replace rules | 4/1 |
| #127 | fix: tiger_scout rate limit reason hidden from Gemini | 4/1 |
| #128 | fix: only output sent to Gemini | 4/1 |
| #129 | feat: morning hunt report | 4/1 |
| #130 | fix: admin dashboard timeout | 4/1 |
| #131 | fix: admin dashboard UX | 4/1 |

---

## Infrastructure

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1 + asia-southeast1) |
| Cloud SQL proxy | port **5433** locally, user `botcraft`, DB `tiger_claw_shared` |
| Wizard / Admin | Next.js on Vercel at `wizard.tigerclaw.io` |
| GitHub | `bbrysonelite-max/tiger-claw-v4-core` |
| Deploys | GitHub Actions on merge to main (API) + Vercel auto-deploy (wizard) |

---

## Agent Rules

- One PR per fix. No chaining.
- feat/ branches only. Never push direct to main.
- Architecture is **LOCKED**. No RAG, no containers, no OpenClaw.
- No new features without a customer asking for it.
