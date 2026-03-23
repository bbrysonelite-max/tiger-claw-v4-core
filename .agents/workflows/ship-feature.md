---
description: How to ship a Tiger Claw feature securely and autonomously without touching main
---

# Ship Feature Workflow
**Local Context:** `/Users/brentbryson/Tigerclaw-Anti_Gravity/tiger-claw/`
**Target Remote:** `https://github.com/bbrysonelite-max/tiger-claw-v4-core`

This workflow guarantees that code is tested, merged, and automatically deployed without ever touching `main` locally.

1. Ensure you are on your `feat/*` or `fix/*` branch and all code is committed.
2. Run the test suite to ensure stability across the 133 spec tests: `cd api && npm test`
3. Push your branch to origin: `git push origin HEAD`
4. Create the PR using the GitHub CLI: `gh pr create --title "feat: <title>" --body "<description>"`
5. Tell GitHub to auto-merge when CI passes: `gh pr merge --auto --squash`
6. Do NOT checkout main. Do NOT run deploy-cloudrun.sh. The GitHub Action `deploy.yml` takes over and deploys it to Cloud Run.
