#!/bin/bash
# Tiger Claw — Deploy Frontend to Cloud Run
# Run from project root (gcloud must be authenticated)

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?ERROR: GCP_PROJECT_ID must be set}"
REGION="us-central1"
SERVICE_NAME="tiger-claw-frontend"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"
# Point to the hardened production API we just deployed
NEXT_PUBLIC_API_URL="https://api.tigerclaw.io"

echo "==> Building and pushing Frontend Docker image..."
gcloud builds submit ./web-onboarding \
  --config ./web-onboarding/cloudbuild.yaml \
  --project "$PROJECT_ID" \
  --substitutions "_NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" \
  --timeout=900

echo "==> Deploying Frontend to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10 \
  --labels "app=tiger-claw,tier=frontend,env=production"

echo ""
echo "==> Frontend Deployment complete!"
LIVE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format "value(status.url)")
echo "    Frontend URL: $LIVE_URL"
echo ""
