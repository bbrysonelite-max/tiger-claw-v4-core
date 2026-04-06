#!/bin/bash
# Tiger Claw — Deploy to Cloud Run (v4 Multi-Tenant, Multi-Region)
# Deploys to us-central1 (primary) and asia-southeast1 (Singapore).
# Both regions sit behind the Global HTTPS Load Balancer at api.tigerclaw.io.
#
# Prerequisites:
#   - ops/setup-multi-region.sh must have been run once to provision VPC infra + LB
#   - MULTI_REGION_READY env var set to "true" to also deploy to asia-southeast1
#   - Otherwise deploys only to us-central1 (safe default before infra is ready)
#
# Usage:
#   GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh
#   MULTI_REGION_READY=true GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/deploy-cloudrun.sh

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?ERROR: GCP_PROJECT_ID must be set}"
SERVICE_NAME="tiger-claw-api"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

DEPLOY_REGIONS=("us-central1")
VPC_CONNECTORS=("tiger-claw-connector")

# Only deploy to SEA if infra is confirmed provisioned
if [ "${MULTI_REGION_READY:-false}" = "true" ]; then
  DEPLOY_REGIONS+=("asia-southeast1")
  VPC_CONNECTORS+=("tiger-claw-connector-sea")
  echo "==> Multi-region deploy: us-central1 + asia-southeast1"
else
  echo "==> Single-region deploy: us-central1"
  echo "    (Set MULTI_REGION_READY=true after running ops/setup-multi-region.sh)"
fi

# ──────────────────────────────────────────────────────────────
# Build image once — deploy to both regions from the same image
# ──────────────────────────────────────────────────────────────
echo ""
echo "==> Building and pushing Docker image..."
gcloud builds submit ./api \
  --tag "$IMAGE" \
  --project "$PROJECT_ID" \
  --timeout=600

# ──────────────────────────────────────────────────────────────
# Deploy to each region
# ──────────────────────────────────────────────────────────────
SECRETS="DATABASE_URL=tiger-claw-database-url:latest,\
DATABASE_READ_URL=tiger-claw-database-url:latest,\
REDIS_URL=tiger-claw-redis-url:latest,\
GOOGLE_API_KEY=tiger-claw-google-api-key:latest,\
STRIPE_SECRET_KEY=tiger-claw-stripe-secret-key:latest,\
STRIPE_WEBHOOK_SECRET=tiger-claw-stripe-webhook-secret:latest,\
STRIPE_PRICE_BYOK=tiger-claw-stripe-price-byok:latest,\
ADMIN_TOKEN=tiger-claw-admin-token:latest,\
ADMIN_TELEGRAM_BOT_TOKEN=tiger-claw-admin-telegram-bot-token:latest,\
ADMIN_TELEGRAM_CHAT_ID=tiger-claw-admin-telegram-chat-id:latest,\
TIGER_CLAW_HIVE_TOKEN=tiger-claw-hive-token:latest,\
PLATFORM_ONBOARDING_KEY=tiger-claw-platform-onboarding-key:latest,\
PLATFORM_EMERGENCY_KEY=tiger-claw-platform-emergency-key:latest,\
ENCRYPTION_KEY=tiger-claw-encryption-key:latest,\
FRONTEND_URL=FRONTEND_URL:latest,\
TIGER_CLAW_API_URL=TIGER_CLAW_API_URL:latest,\
SERPER_KEY_1=tiger-claw-serper-key-1:latest,\
SERPER_KEY_2=tiger-claw-serper-key-2:latest,\
SERPER_KEY_3=tiger-claw-serper-key-3:latest,\
MAGIC_LINK_SECRET=tiger-claw-magic-link-secret:latest,\
TELEGRAM_WEBHOOK_SECRET=tiger-claw-telegram-webhook-secret:latest,\
RESEND_API_KEY=tiger-claw-resend-api-key:latest,\
OXYLABS_USERNAME=oxylabs-username:latest,\
OXYLABS_PASSWORD=oxylabs-password:latest,\
PADDLE_WEBHOOK_SECRET=paddle-webhook-secret:latest,\
PADDLE_API_KEY=paddle-api-key:latest"

for i in "${!DEPLOY_REGIONS[@]}"; do
  REGION="${DEPLOY_REGIONS[$i]}"
  CONNECTOR="${VPC_CONNECTORS[$i]}"

  echo ""
  echo "==> Deploying to ${REGION} (connector: ${CONNECTOR})..."

  gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --platform managed \
    --execution-environment gen2 \
    --allow-unauthenticated \
    --port 4000 \
    --memory 2Gi \
    --cpu 2 \
    --min-instances 1 \
    --max-instances 100 \
    --timeout 300 \
    --concurrency 100 \
    --vpc-connector "$CONNECTOR" \
    --vpc-egress private-ranges-only \
    --startup-probe="httpGet.path=/health,httpGet.port=4000,timeoutSeconds=5,periodSeconds=10,failureThreshold=3" \
    --liveness-probe="httpGet.path=/health,httpGet.port=4000,timeoutSeconds=5,periodSeconds=30,failureThreshold=3" \
    --update-secrets "$SECRETS" \
    --set-env-vars "INTERNAL_API_URL=https://api.tigerclaw.io,ENABLE_WORKERS=true"

  LIVE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)")
  echo "    ✅ ${REGION}: ${LIVE_URL}"
done

# ──────────────────────────────────────────────────────────────
# Health check primary region
# ──────────────────────────────────────────────────────────────
echo ""
echo "==> Verifying health (us-central1)..."
PRIMARY_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "us-central1" \
  --project "$PROJECT_ID" \
  --format "value(status.url)")
curl -s "${PRIMARY_URL}/health" || echo "(health check pending — may take a few seconds)"
echo ""
echo "==> Deployment complete."
echo ""
