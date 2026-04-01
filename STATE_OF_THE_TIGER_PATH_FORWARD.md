# State of the Tiger — Path Forward

**Last Updated:** 2026-03-30 5:45 PM MST (Monday evening — FIRE TEST IN PROGRESS)
**Author:** Claude (Cowork) + Gemini CLI

---

## Phase Status

### Phase 6 — FIRE TEST (IN PROGRESS)

Phases 1–5 are complete. Phase 6 is the live fire test with real credentials.

**Phase 1 — Container Health** ✅
- secrets.ts EISDIR fix (PR #93)
- FRONTEND_URL → wizard.tigerclaw.io
- Container stable on Cloud Run

**Phase 2 — Database Cleanup** ✅
- All test data wiped, clean slate

**Phase 3 — BYOK Key Path** ✅
- Key observability + loud failures (PR #94)
- Runtime reads from `bot_ai_config` (confirmed)

**Phase 4 — Wizard Hatch Fixes** ✅
- activateSubscription loud failure (PR #95)
- Pre-flight validation on /hatch (PR #96)
- userId fix in provisioning queue (PR #97)
- Clear stale frontend state (PR #98)

**Phase 5 — Wizard Completion & Hardening** ✅
- Stan Store on-demand record creation (PR #99)
- StepCustomerProfile ICP wizard step (PR #100)
- Network-marketer prospect section (PR #101)
- ICP first-message bypass in ai.ts (PR #102)
- LINE end-to-end: UI + hatch + provisioner (PR #103)
- LINE-only bot validation (PR #104)
- Full wizard readability overhaul (PR #105)
- JSON escape sequence sanitization (PR #108)
- Admin bot restoration + heartbeat monitor (PR #109)

**Phase 6 — Fire Test** 🔥 IN PROGRESS
- Wizard UX friction pass — contrast, copy, multi-agent (PR #110) ✅
- Bot_pool spam alert removal ✅
- Multi-agent auth (one email → many bots) ✅
- Provisioner name UPDATE fix (deploying)
- ICP fast-path in ai.ts (deploying)
- Jeff Mack demo at 8 PM tonight

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

## Next Steps (After Fire Test)

1. **Complete Jeff Mack demo** — 8 PM tonight. He's extremely non-technical, uses Telegram.
2. **Hatch 5+ real agents** — Pebo wants to deploy agents for the Nu Skin rebuild team.
3. **Test dialogue quality** — Do the bots sound smart? Do they reference ICP data? Are they ready to hunt?
4. **Max Steingart white label** — 30% affiliate commission via Stan Store. Max sells 10, then we build.
5. **John / Bryson International Group** — 21,000 LINE distributors in Thailand. Scale test.
6. **Stan Store Zapier webhook** — Automate "Receipt → Wizard" flow.

---

## Known Issues / Tech Debt

| Item | Status | Notes |
|-------|----------|-------|
| **Admin Bot** | **FIXED** | `@AlienProbeadmin_bot` active with heartbeat. |
| **JSON Parse** | **FIXED** | Sanitizer in `geminiGateway.ts`. |
| **Bot_pool alerts** | **FIXED** | Removed from index.ts. |
| `bot_ai_keys` dead write | LOW | Wizard writes here, runtime reads `bot_ai_config`. |
| ~25 dead BotFather bots | LOW | Need manual /deletebot cleanup. |
| Navigation recovery in wizard | MEDIUM | Dashboard link kills wizard state. |

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

---

## Infrastructure

| Resource | Value |
|----------|-------|
| GCP Project | `hybrid-matrix-472500-k5` |
| Cloud Run | `tiger-claw-api` (us-central1), current revision: 00172+ |
| Cloud SQL proxy | port 5432, user `botcraft`, DB `tiger_claw_shared` |
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
