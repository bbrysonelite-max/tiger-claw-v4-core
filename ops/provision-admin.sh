#!/bin/bash
set -euo pipefail

API_URL="${TIGER_CLAW_API_URL:-http://localhost:3000}"

echo "🚀 Provisioning Tiger Admin persona on $API_URL..."

curl -sSf -X POST "$API_URL/admin/provision" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN:-}" \
  -d '{
    "slug": "tiger-admin",
    "name": "Tiger Admin",
    "flavor": "admin",
    "region": "us-en",
    "language": "en",
    "preferredChannel": "telegram",
    "hiveOptIn": false,
    "comped": true
  }'

echo -e "\n\n✅ Admin tenant provisioned."
