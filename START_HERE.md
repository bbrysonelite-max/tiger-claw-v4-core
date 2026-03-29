# START HERE — Tiger Claw Recovery Session

**Last Updated:** 2026-03-29 (Sunday night session)
**Author:** Pebo + Cowork (Claude Opus) orchestrating Claude Code + Gemini

---

## What Is Tiger Claw?

AI sales agent SaaS. Customers buy on Stan Store, walk through a wizard to configure their Telegram bot + AI key, hit "Hatch," and get a live AI sales agent. Built on Cloud Run, PostgreSQL, Redis/BullMQ, Gemini 2.0 Flash.

- **API:** Cloud Run (us-central1 + asia-southeast1), project `hybrid-matrix-472500-k5`
- **Wizard Frontend:** Next.js on Vercel at `wizard.tigerclaw.io`
- **Repo:** `github.com/bbrysonelite-max/tiger-claw-v4-core`
- **Architecture:** BYOB (Bring Your Own Bot — customer's Telegram token) + BYOK (Bring Your Own Key — customer's AI API key)

---

## Where We Are Right Now

### Phase 4 is COMPLETE. Phase 5 (Fire Test) is NEXT.

All code fixes for the wizard hatch flow are merged and deployed:

| PR  | Phase | What It Fixed | Status |
|-----|-------|---------------|--------|
| #93 | 1.1   | secrets.ts EISDIR crash (container crash-loop) | MERGED |
| #94 | 3.2   | BYOK key observability — logs where keys resolve from | MERGED |
| #95 | 4.1   | activateSubscription() fails loudly instead of silent warn | MERGED |
| #96 | 4.2   | Pre-flight validation on /hatch — 4 checks before any DB write | MERGED |
| #97 | 4.3   | userId in provisioning queue — was tenant UUID, now user UUID | MERGED |
| #98 | 4.4   | Clear stale wizard frontend state after successful hatch | MERGED |

### Other Completed Work

- **FRONTEND_URL** secret updated from dead `app.tigerclaw.io` to `wizard.tigerclaw.io`
- **Database wiped** — all 9 global tables truncated to 0 rows, 22 per-tenant schemas dropped, Redis flushed
- **Container healthy** — HTTP 200 on /health, stable uptime

---

## What's Next

### Phase 5: Fire Test

Before buying, we need to **audit the Stan Store purchase flow**. The original simple flow (purchase receipt → wizard link) may have been broken by a coding agent that added unnecessary Zapier integration.

**Then:**
1. Create a $1 test product on Stan Store
2. Buy it yourself with a different email
3. Click the wizard link from the confirmation email
4. Walk through wizard: Telegram bot token + Gemini API key
5. Hit "Hatch" — bot should come alive

### Phase 6: First Real Customer

Once the fire test passes, onboard the first customer from the waiting line.

---

## Critical Files

| File | What It Does |
|------|-------------|
| `api/src/config/secrets.ts` | Loads GCP Secret Manager secrets (fixed EISDIR) |
| `api/src/routes/wizard.ts` | POST /wizard/validate-key, POST /wizard/hatch |
| `api/src/services/ai.ts` | resolveAIProvider() — 3-step key fallback |
| `api/src/services/db.ts` | activateSubscription(), lookupPurchaseByEmail() |
| `api/src/index.ts` | Startup sequence, route mounting |
| `web-onboarding/src/components/OnboardingModal.tsx` | Wizard frontend state management |
| `cloudrun.yaml` | Deployment config (16+ secrets, min 1 / max 10 instances) |

---

## Rules of Engagement

1. **One PR per fix.** No chaining. Verify after every merge.
2. **Cowork orchestrates.** Claude Code and Gemini execute. Keep them on rails.
3. **Stop if something breaks.** Don't stack fixes on top of a broken deploy.
4. **The mission:** Get ONE clean bot to hatch end-to-end so Pebo can sell to the customers waiting in line.
