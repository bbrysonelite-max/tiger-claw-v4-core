# State of the Tiger — Path Forward

**Last Updated:** 2026-04-02 (Session 6)
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
**Phase 9 — Customer Self-Service** ✅ (Session 6 — 2026-04-02)

---

## Session 6 — What Was Done (2026-04-02)

### Customer Dashboard
| # | Fix | PR |
|---|-----|-----|
| 1 | Inline key update — replaces wizard redirect with form on dashboard; provider selector + key input + Save | #133 |
| 2 | Recent leads section — last 5 leads with name, score, status, time found; hidden when no leads | #133 |
| 3 | Fix: `update-key` was writing to dead `bot_ai_keys` table; now writes to `bot_ai_config` | #133 |

### Slash Commands
| # | Fix | PR |
|---|-----|-----|
| 4 | `/dashboard` — sends customer their control panel URL | #134 |
| 5 | `/status` — key health, lead count, last active; zero AI cost | #134 |
| 6 | `/help` — command list | #134 |
| 7 | `setMyCommands` called at provisioner hatch — menu appears in Telegram automatically | #134 |

---

## Session 5 — What Was Done (2026-04-01)

### Critical Production Fixes
| # | Fix | PR |
|---|-----|-----|
| 1 | `INTERNAL_API_URL` not set — tiger_keys/hive/onboard/settings fataling on every call | #123 |
| 2 | value-gap JOIN type cast (`varchar = uuid`) — check-ins broken for all tenants | #122 |
| 3 | bot_pool `critical: 0` false alarm in `/health` | #124 |

### Data Quality
| # | Fix | PR |
|---|-----|-----|
| 4 | Relevance gate — second Gemini call blocks gaming/fiction facts | #125 |

### Voice & Personality
| # | Fix | PR |
|---|-----|-----|
| 5 | Voice overhaul — 40-line rules wall → 5 conversation examples | #126 |
| 6 | tiger_scout rate limit reason hidden from Gemini | #127 |
| 7 | Only `output` string passed to Gemini | #128 |

### Morning Report
| # | Fix | PR |
|---|-----|-----|
| 8 | Morning hunt report — daily_scout sends proactive message at 7 AM UTC | #129 |

### Admin Dashboard
| # | Fix | PR |
|---|-----|-----|
| 9 | Timeout fix — N+1 getBotState calls → single query | #130 |
| 10 | UX — localStorage token, 5min refresh, new agents today | #131 |

---

## Known Issues / Tech Debt

| Item | Priority | Status |
|------|----------|--------|
| Merge PR #134 (slash commands) | HIGH | Open |
| Activate chana.loh, nancylimsk, lily.vergara | HIGH | Open — paid but not in DB |
| Confirm Debbie / Jeff / John complete wizard | HIGH | Open — pending_setup |
| Register slash commands on pre-#134 bots | MEDIUM | Open — one-off `registerBotCommands` per token |
| `bot_ai_keys` dead write | LOW | Open — wizard writes here, runtime reads `bot_ai_config` |
| Navigation recovery in wizard | LOW | Open — dashboard link kills wizard state |
| ~25 dead BotFather bots | LOW | Open — need manual /deletebot cleanup |
| CI Postgres `role "root"` | INFRA | Open — pre-existing GitHub Actions bug |

---

## Next Steps (Session 7)

1. **Merge PR #134** — slash commands
2. **Activate remaining Stan Store customers** — chana, nancy, lily
3. **First paying customer live** — confirm Debbie / Jeff / John hatch and receive morning report
4. **Register slash commands on existing bots** — one-off script or manual curl

---

## DB State (as of 2026-04-02 end of Session 6)

| Email | Name | Status | Channel | Notes |
|-------|------|--------|---------|-------|
| `phaitoon2010@gmail.com` | ToonScoutV2 / Toon Scout | active | Telegram | Beta tester, 3 bots |
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
| #93–#110 | Sessions 1–2 | 3/23–3/30 |
| #111 | fix: 3 critical fire test bugs | 3/31 |
| #112 | feat: market intelligence → buildSystemPrompt | 3/31 |
| #113 | fix: dashboard AI engine label + Telegram dual-state | 3/31 |
| #114 | fix: wizard ICP fast-path — write icpSingle + botName at hatch | 3/31 |
| #115 | fix: buildSystemPrompt fallback to customerProfile | 3/31 |
| #116 | fix: Grok model → grok-4-1-fast-non-reasoning | 3/31 |
| #117 | feat: admin dashboard + grok key health + SOUL + Postiz | 4/1 |
| #118 | docs: session 3 state | 4/1 |
| #119 | fix: migration 022 column names | 4/1 |
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
| #133 | feat: customer dashboard — inline key update + leads section | 4/2 |

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
