# State of the Tiger — Path Forward

**Last Updated:** 2026-04-01 (Session 3 — broken windows sweep)
**Author:** Claude Sonnet 4.6

---

## Phase Status

### Phase 7 — SOCIAL MOAT & BRAND SOUL (COMPLETE)

**Phase 1 — Container Health** ✅
**Phase 2 — Database Cleanup** ✅
**Phase 3 — BYOK Key Path** ✅
**Phase 4 — Wizard Hatch Fixes** ✅
**Phase 5 — Wizard Completion & Hardening** ✅
**Phase 6 — Fire Test** ✅
- Jeff Mack demo PASSED 3/30
- 5+ real agents hatched and hunting

**Phase 7 — Social Moat & Brand Soul (3/31)** ✅
- Admin Dashboard (Operator Command Center) at /admin (PR #117)
- Grok/OpenRouter key health detection fix (PR #117)
- SOUL.md integration — Brand voice & mission injected into every agent
- FallbackIntelligence — Vertical-specific hope-infused facts for dry mines
- Postiz Integration — Autonomous social broadcasting tool (tiger_postiz)
- Postiz Key Management — Secure storage and configuration via tiger_settings

---

## Fire Test Findings (2026-03-30)

### Bugs Found & Fixed During Walkthrough

| # | Bug | Root Cause | Fix | Status |
|---|-----|-----------|-----|--------|
| 1 | Bot shows "bbryson" not wizard name | `provisioner.ts` UPDATE missing `name` in SET | Added `name = $1` to UPDATE | Deploying |
| 2 | Bot asks ICP questions manually | `ai.ts` didn't check `onboard_state.json` for pre-loaded `customerProfile` | Added `checkWizardIcpFastPath` to both message handlers | Deploying |
| 3 | Email prefix used as name | `auth.ts` uses `email.split("@")[0]` — correct as placeholder | Fixed by Bug 1 (provisioner overwrites at hatch) | Deploying |
| 4 | "No pending subscription" on ACTIVATE | `lookupPurchaseByEmail` returned stale bot | Multi-agent branch in auth.ts (PR #110) | ✅ Deployed |
| 5 | Bot_pool spam alerts every 30s | `EMPTY_COOLDOWN_MS: 0` + always-empty V4 table | Removed pool check + POOL_ALERT from index.ts | ✅ Deployed |
| 6 | Wizard text unreadable (low contrast) | `text-white/40` through `/80` classes | All opacity bumped to /70–/100 | ✅ Deployed |
| 7 | "Total Due Today $147" scare copy | Looked like new charge | "Your Plan" + green "Paid via Stan Store" | ✅ Deployed |
| 8 | "AI Computations" jargon | Confusing label | Changed to "AI Provider" | ✅ Deployed |

### UX Issues Still Open

| Issue | Priority |
|-------|----------|
| Clicking dashboard/admin link loses wizard state | MEDIUM |
| "Connected" text should be green | LOW |

---

## Next Steps (Session 3 — 2026-04-01)

1. **First paying customer** — pick from waiting list, activate.
2. **Triage open PRs** — #90, #75 are pre-customer critical; #74, #78, #77 are data quality; #46 likely stale.
3. **Fix `bot_ai_keys` dead write** — small cleanup PR.
4. **CI Postgres infra bug** — investigate the `role "root"` issue in GitHub Actions (pre-existing, but worth fixing).

---

## Known Issues / Tech Debt

| Item | Priority | Status | Notes |
|------|----------|--------|-------|
| **Grok key health false positive** | — | **FIXED (#117)** | Cron now passes original provider to `validateAIKey`, not SDK alias. |
| **TypeScript CI errors** | — | **FIXED (Session 3)** | `node-fetch` phantom imports removed. CI Test green. |
| `bot_ai_keys` dead write | LOW | Open | Wizard writes here, runtime reads `bot_ai_config`. Cleanup when convenient. |
| ~25 dead BotFather bots | LOW | Open | Need manual /deletebot cleanup. |
| Navigation recovery in wizard | MEDIUM | Open | Dashboard link kills wizard state. |
| CI Postgres `role "root"` | INFRA | Open | Pre-existing GitHub Actions infra bug — not our code. TypeScript compile gate works fine. |

---

## DB State (as of 2026-03-30 5:45 PM MST)

| Tenant | Slug | Status | Channel | Notes |
|--------|------|--------|---------|-------|
| `71018251...` | heylookbrentisgolfing | onboarding | Telegram | OpenAI key |
| `8803b9f4...` | bbryson-mndsgv0q | onboarding | Telegram | Job 3, Google key |
| (newest) | bbryson-mndudbum | onboarding | Telegram | Job 4, Google key |

---

## Merged PRs (Full Session History)

| PR | Description | Date |
|----|-------------|------|
| #93 | fix: secrets.ts EISDIR | 3/23 |
| #94 | feat: BYOK key observability | 3/23 |
| #95 | fix: activateSubscription loud failure | 3/24 |
| #96 | feat: hatch pre-flight validation | 3/24 |
| #97 | fix: userId in provisioning queue | 3/24 |
| #98 | fix: clear stale frontend state | 3/24 |
| #99 | feat: Stan Store on-demand records | 3/25 |
| #100 | feat: StepCustomerProfile ICP | 3/25 |
| #101 | feat: network-marketer prospect section | 3/25 |
| #102 | feat: ICP first-message bypass | 3/26 |
| #103 | feat: LINE end-to-end | 3/26 |
| #104 | fix: LINE-only bot validation | 3/27 |
| #105 | feat: wizard readability overhaul | 3/27 |
| #106 | fix: LINE-only provisioning | 3/28 |
| #107 | feat: preferredChannel type fix | 3/28 |
| #108 | fix: Gemini JSON escape sanitization | 3/30 |
| #109 | feat: admin bot + heartbeat monitor | 3/30 |
| #110 | fix: wizard UX friction pass + multi-agent | 3/30 |
| #111 | fix: 3 critical fire test bugs | 3/31 |
| #112 | feat: intent bridge — market intelligence → buildSystemPrompt | 3/31 |
| #113 | fix: dashboard display — AI engine label + Telegram dual-state | 3/31 |
| #114 | fix: wizard ICP fast-path — write icpSingle + botName at hatch | 3/31 |
| #115 | fix: buildSystemPrompt fallback to customerProfile when icpSingle missing | 3/31 |
| #116 | fix: Grok model grok-2-1212 → grok-4-1-fast-non-reasoning | 3/31 |
| #117 | feat: admin dashboard + grok key health fix + SOUL + Postiz | 4/1 |
| fix (in #117) | fix: remove node-fetch phantom imports — CI Test green | 4/1 |

---

## Infrastructure

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1), current revision: 00172+ |
| Cloud SQL proxy | port **5433** locally (NOT 5432), user `botcraft`, DB `tiger_claw_shared` |
| DB password | `TigerClaw2026Secure` |
| Wizard | Next.js on Vercel at `wizard.tigerclaw.io` |
| GitHub | `bbrysonelite-max/tiger-claw-v4-core` |
| Deploys | GitHub Actions on merge to main |

---

## Agent Rules

- One PR per fix. No chaining.
- feat/ branches only. Never push direct to main.
- Architecture is **LOCKED**. No RAG, no containers, no OpenClaw.
- **No new features.** Friction reduction and sales only.
