#!/bin/bash

# Ensure we have the right scope before sending
echo "Verifying Google Workspace CLI authentication with gmail.send scope..."
gws auth setup --scopes https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/pubsub --project hybrid-matrix-472500-k5

echo "Authentication complete. Beginning automated sequence..."

# The customer list
declare -a CUSTOMERS=(
  "Nancy Lim|nancynutcha@gmail.com"
  "Chana Lohasaptawee|chanaloha7777@gmail.com"
  "Phaitoon|phaitoon2010@gmail.com"
  "Tarida|taridadew@gmail.com"
  "Lily Vergara|lilyrosev@gmail.com"
  "Theera Phetmalaigul|theeraphet@gmail.com"
  "John & Noon|johnnoon.biz@gmail.com"
  "Debbie Cameron|justagreatdirector@outlook.com"
  "Pat Sullivan|pat@contatta.com"
  "Rebecca Bryson|rjbryson@me.com"
)

# Email subject
SUBJECT="🐅 Tiger Claw Important Update: Mandatory Architecture Upgrade"

# Loop and send
for customer in "${CUSTOMERS[@]}"; do
  # Extract name and email
  NAME="${customer%%|*}"
  EMAIL="${customer##*|}"
  
  BODY="Hello $NAME,

We are completely overhauling the backend architecture that runs your Tiger Claw agent. We are removing the old containerized system and deploying you onto a massive, multi-tenant V4 infrastructure that uses physical SIM cards.

This change is mandatory for platform stability and to protect your bots from being shadow-banned by Telegram and LINE.

We will be provisioning your new bot in the coming hours. Please reply to this email acknowledging receipt so we can coordinate your seamless cutover.

Thank you for being part of the pack,
Brent Bryson
Tiger Claw Operations"

  echo "Sending personalized automated bot transition notice to: $NAME ($EMAIL)..."
  gws gmail +send --to "$EMAIL" --subject "$SUBJECT" --body "$BODY"
  
  # Sleep 2 seconds just to rate-limit slightly
  sleep 2
done

echo
echo "🚀 AUTONOMOUS BLAST COMPLETE. All 10 customers have been notified via Google Workspace CLI."
