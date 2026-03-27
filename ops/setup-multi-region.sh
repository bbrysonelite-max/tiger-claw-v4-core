#!/bin/bash
# Tiger Claw — Multi-Region Setup (Weakness #6)
# Adds asia-southeast1 (Singapore) as a second region alongside us-central1.
#
# Run ONCE to provision infrastructure. After this, the deploy script
# handles keeping both regions in sync on every merge to main.
#
# Prerequisites:
#   - gcloud authenticated as project owner
#   - GCP_PROJECT_ID env var set
#   - Serverless VPC Access API enabled
#   - Compute Engine API enabled
#
# Usage:
#   GCP_PROJECT_ID=hybrid-matrix-472500-k5 bash ./ops/setup-multi-region.sh
#
# What this script does:
#   1. Switches tiger-claw-vpc BGP routing to GLOBAL (enables cross-region internal routing)
#   2. Creates tiger-claw-subnet-sea (10.10.1.0/24) in tiger-claw-vpc, asia-southeast1
#   3. Creates tiger-claw-connector-sea VPC connector (10.8.1.0/28), asia-southeast1
#   4. Deploys tiger-claw-api Cloud Run service in asia-southeast1
#   5. Creates a Global HTTPS Load Balancer with both regions as backends
#   6. Outputs the LB IP — update api.tigerclaw.io DNS A record to this IP
#
# After running:
#   - Update Porkbun DNS: api.tigerclaw.io A → <LB_IP>
#   - Wait for SSL cert to provision (5-10 min)
#   - Remove Cloud Run domain mapping:
#       gcloud beta run domain-mappings delete api.tigerclaw.io --region us-central1

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?ERROR: GCP_PROJECT_ID must be set}"
SERVICE_NAME="tiger-claw-api"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"
VPC_NETWORK="tiger-claw-vpc"
REGION_US="us-central1"
REGION_SEA="asia-southeast1"
CONNECTOR_SEA="tiger-claw-connector-sea"
SUBNET_SEA="tiger-claw-subnet-sea"
LB_NAME="tiger-claw-lb"
DOMAIN="api.tigerclaw.io"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Tiger Claw — Multi-Region Setup (us-central1 + SEA)    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Project: ${PROJECT_ID}"
echo "Regions: ${REGION_US} + ${REGION_SEA}"
echo ""

# ──────────────────────────────────────────────────────────────
# Step 1: Enable required APIs
# ──────────────────────────────────────────────────────────────
echo "==> Step 1: Enabling required APIs..."
gcloud services enable vpcaccess.googleapis.com \
  compute.googleapis.com \
  run.googleapis.com \
  --project "$PROJECT_ID" \
  --quiet

# ──────────────────────────────────────────────────────────────
# Step 2: Switch VPC to GLOBAL BGP routing
# (Needed so asia-southeast1 connector can reach us-central1 Redis/SQL)
# ──────────────────────────────────────────────────────────────
echo ""
echo "==> Step 2: Switching ${VPC_NETWORK} BGP routing to GLOBAL..."
CURRENT_MODE=$(gcloud compute networks describe "$VPC_NETWORK" \
  --project "$PROJECT_ID" \
  --format="value(routingConfig.routingMode)")

if [ "$CURRENT_MODE" = "GLOBAL" ]; then
  echo "    Already GLOBAL — skipping."
else
  gcloud compute networks update "$VPC_NETWORK" \
    --bgp-routing-mode=GLOBAL \
    --project "$PROJECT_ID"
  echo "    Done. Cross-region private routing is now active."
fi

# ──────────────────────────────────────────────────────────────
# Step 3: Create subnet in asia-southeast1
# ──────────────────────────────────────────────────────────────
echo ""
echo "==> Step 3: Creating subnet ${SUBNET_SEA} in ${REGION_SEA}..."
if gcloud compute networks subnets describe "$SUBNET_SEA" \
  --region "$REGION_SEA" \
  --network "$VPC_NETWORK" \
  --project "$PROJECT_ID" \
  --quiet 2>/dev/null; then
  echo "    Subnet already exists — skipping."
else
  gcloud compute networks subnets create "$SUBNET_SEA" \
    --network "$VPC_NETWORK" \
    --region "$REGION_SEA" \
    --range "10.10.1.0/24" \
    --project "$PROJECT_ID"
  echo "    Created ${SUBNET_SEA} (10.10.1.0/24) in ${REGION_SEA}."
fi

# ──────────────────────────────────────────────────────────────
# Step 4: Create Serverless VPC connector in asia-southeast1
# ──────────────────────────────────────────────────────────────
echo ""
echo "==> Step 4: Creating VPC connector ${CONNECTOR_SEA} in ${REGION_SEA}..."
if gcloud compute networks vpc-access connectors describe "$CONNECTOR_SEA" \
  --region "$REGION_SEA" \
  --project "$PROJECT_ID" \
  --quiet 2>/dev/null; then
  echo "    Connector already exists — skipping."
else
  gcloud compute networks vpc-access connectors create "$CONNECTOR_SEA" \
    --network "$VPC_NETWORK" \
    --region "$REGION_SEA" \
    --range "10.8.1.0/28" \
    --min-instances 2 \
    --max-instances 10 \
    --machine-type e2-micro \
    --project "$PROJECT_ID"
  echo "    Created ${CONNECTOR_SEA} (10.8.1.0/28)."
fi

# ──────────────────────────────────────────────────────────────
# Step 5: Deploy Cloud Run service in asia-southeast1
# ──────────────────────────────────────────────────────────────
echo ""
echo "==> Step 5: Deploying ${SERVICE_NAME} to ${REGION_SEA}..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION_SEA" \
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
  --vpc-connector "$CONNECTOR_SEA" \
  --vpc-egress private-ranges-only \
  --startup-probe="httpGet.path=/health,httpGet.port=4000,timeoutSeconds=5,periodSeconds=10,failureThreshold=3" \
  --liveness-probe="httpGet.path=/health,httpGet.port=4000,timeoutSeconds=5,periodSeconds=30,failureThreshold=3" \
  --update-secrets \
    "DATABASE_URL=tiger-claw-database-url:latest,\
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
SERPER_KEY_3=tiger-claw-serper-key-3:latest"

SEA_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION_SEA" \
  --project "$PROJECT_ID" \
  --format "value(status.url)")
echo "    SEA service live: ${SEA_URL}"

# ──────────────────────────────────────────────────────────────
# Step 6: Create Serverless NEGs for the Global Load Balancer
# ──────────────────────────────────────────────────────────────
echo ""
echo "==> Step 6: Creating Serverless NEGs..."

NEG_US="${SERVICE_NAME}-neg-us"
NEG_SEA="${SERVICE_NAME}-neg-sea"

for NEG_REGION in "$REGION_US $NEG_US" "$REGION_SEA $NEG_SEA"; do
  NEG_R=$(echo "$NEG_REGION" | awk '{print $1}')
  NEG_N=$(echo "$NEG_REGION" | awk '{print $2}')
  if gcloud compute network-endpoint-groups describe "$NEG_N" \
    --region "$NEG_R" \
    --project "$PROJECT_ID" \
    --quiet 2>/dev/null; then
    echo "    NEG ${NEG_N} already exists — skipping."
  else
    gcloud compute network-endpoint-groups create "$NEG_N" \
      --region "$NEG_R" \
      --network-endpoint-type=serverless \
      --cloud-run-service="$SERVICE_NAME" \
      --project "$PROJECT_ID"
    echo "    Created NEG ${NEG_N} in ${NEG_R}."
  fi
done

# ──────────────────────────────────────────────────────────────
# Step 7: Create Global HTTPS Load Balancer
# ──────────────────────────────────────────────────────────────
echo ""
echo "==> Step 7: Creating Global HTTPS Load Balancer..."

# 7a. Backend services
BACKEND_NAME="${LB_NAME}-backend"
if gcloud compute backend-services describe "$BACKEND_NAME" \
  --global \
  --project "$PROJECT_ID" \
  --quiet 2>/dev/null; then
  echo "    Backend service already exists — skipping creation."
else
  gcloud compute backend-services create "$BACKEND_NAME" \
    --global \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --project "$PROJECT_ID"

  gcloud compute backend-services add-backend "$BACKEND_NAME" \
    --global \
    --network-endpoint-group="$NEG_US" \
    --network-endpoint-group-region="$REGION_US" \
    --project "$PROJECT_ID"

  gcloud compute backend-services add-backend "$BACKEND_NAME" \
    --global \
    --network-endpoint-group="$NEG_SEA" \
    --network-endpoint-group-region="$REGION_SEA" \
    --project "$PROJECT_ID"
  echo "    Backend service ${BACKEND_NAME} created with both regions."
fi

# 7b. URL map
URL_MAP="${LB_NAME}-url-map"
if gcloud compute url-maps describe "$URL_MAP" \
  --global \
  --project "$PROJECT_ID" \
  --quiet 2>/dev/null; then
  echo "    URL map already exists — skipping."
else
  gcloud compute url-maps create "$URL_MAP" \
    --default-service "$BACKEND_NAME" \
    --global \
    --project "$PROJECT_ID"
  echo "    Created URL map ${URL_MAP}."
fi

# 7c. Managed SSL cert for the custom domain
SSL_CERT="${LB_NAME}-cert"
if gcloud compute ssl-certificates describe "$SSL_CERT" \
  --global \
  --project "$PROJECT_ID" \
  --quiet 2>/dev/null; then
  echo "    SSL cert already exists — skipping."
else
  gcloud compute ssl-certificates create "$SSL_CERT" \
    --domains="$DOMAIN" \
    --global \
    --project "$PROJECT_ID"
  echo "    Created managed SSL cert for ${DOMAIN}."
  echo "    NOTE: Certificate provisioning takes 5-10 min after DNS points to LB IP."
fi

# 7d. HTTPS target proxy
HTTPS_PROXY="${LB_NAME}-https-proxy"
if gcloud compute target-https-proxies describe "$HTTPS_PROXY" \
  --global \
  --project "$PROJECT_ID" \
  --quiet 2>/dev/null; then
  echo "    HTTPS proxy already exists — skipping."
else
  gcloud compute target-https-proxies create "$HTTPS_PROXY" \
    --url-map="$URL_MAP" \
    --ssl-certificates="$SSL_CERT" \
    --global \
    --project "$PROJECT_ID"
  echo "    Created HTTPS proxy ${HTTPS_PROXY}."
fi

# 7e. HTTP → HTTPS redirect
HTTP_REDIRECT_MAP="${LB_NAME}-http-redirect"
HTTP_PROXY="${LB_NAME}-http-proxy"
HTTP_RULE="${LB_NAME}-http-rule"

if ! gcloud compute url-maps describe "$HTTP_REDIRECT_MAP" \
  --global --project "$PROJECT_ID" --quiet 2>/dev/null; then
  gcloud compute url-maps import "$HTTP_REDIRECT_MAP" \
    --global --project "$PROJECT_ID" --source /dev/stdin <<'YAML'
name: tiger-claw-lb-http-redirect
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
YAML
  gcloud compute target-http-proxies create "$HTTP_PROXY" \
    --url-map="$HTTP_REDIRECT_MAP" \
    --global \
    --project "$PROJECT_ID"
fi

# 7f. Global forwarding rules (80 and 443)
HTTPS_RULE="${LB_NAME}-https-rule"
if ! gcloud compute forwarding-rules describe "$HTTPS_RULE" \
  --global --project "$PROJECT_ID" --quiet 2>/dev/null; then
  gcloud compute forwarding-rules create "$HTTPS_RULE" \
    --target-https-proxy="$HTTPS_PROXY" \
    --global \
    --ports=443 \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --project "$PROJECT_ID"
fi

if ! gcloud compute forwarding-rules describe "$HTTP_RULE" \
  --global --project "$PROJECT_ID" --quiet 2>/dev/null; then
  gcloud compute forwarding-rules create "$HTTP_RULE" \
    --target-http-proxy="$HTTP_PROXY" \
    --global \
    --ports=80 \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --project "$PROJECT_ID"
fi

# ──────────────────────────────────────────────────────────────
# Done — Print next steps
# ──────────────────────────────────────────────────────────────
LB_IP=$(gcloud compute forwarding-rules describe "$HTTPS_RULE" \
  --global \
  --project "$PROJECT_ID" \
  --format "value(IPAddress)" 2>/dev/null || echo "pending")

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Multi-Region Setup Complete                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Load Balancer IP: ${LB_IP}"
echo "  SEA Service URL:  ${SEA_URL}"
echo ""
echo "  ─── Required Next Steps ───────────────────────────────"
echo ""
echo "  1. Update Porkbun DNS:"
echo "     api.tigerclaw.io  A  →  ${LB_IP}"
echo "     (Delete the existing CNAME to ghs.googlehosted.com first)"
echo ""
echo "  2. Remove the Cloud Run domain mapping (AFTER DNS propagates):"
echo "     gcloud beta run domain-mappings delete api.tigerclaw.io \\"
echo "       --region us-central1 --project ${PROJECT_ID}"
echo ""
echo "  3. Wait 5-10 min for the SSL cert to provision."
echo "     Check status:"
echo "     gcloud compute ssl-certificates describe ${SSL_CERT} \\"
echo "       --global --project ${PROJECT_ID} \\"
echo "       --format='value(managed.status)'"
echo ""
echo "  4. Test both regions:"
echo "     curl -s https://api.tigerclaw.io/health"
echo ""
echo "  ─── Ongoing: Update deploy script ─────────────────────"
echo ""
echo "  After this setup, deploy-cloudrun.sh automatically deploys"
echo "  to both regions. No further setup needed."
echo ""
