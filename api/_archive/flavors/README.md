# Archived flavors — DO NOT IMPORT

These flavor configs are **intentionally outside `src/`** so the TypeScript compiler does not pick them up and no code path can import them.

Tiger Claw is a single-flavor product: **network-marketer**. The files here are
kept only so they can be recovered from git history without spelunking. If you
need one back:

1. `git log --diff-filter=D --oneline -- api/_archive/flavors/<file>`
2. Move the file back into `api/src/config/flavors/`
3. Re-register it in `api/src/config/flavors/index.ts`
4. Re-add the key to `VALID_FLAVOR_KEYS` in `api/src/tools/flavorConfig.ts`

**Do not** import from this directory, reference these keys in config, wizard
copy, or tests, or build a feature around them. If you find yourself wanting a
hunting-only campaign (like SSDI Ticket to Work), use the `MineCampaign`
abstraction under `api/src/config/campaigns/` — not a flavor.
