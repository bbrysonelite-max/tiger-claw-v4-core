#!/bin/bash
export GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file

# Array of recipients in "Email;FirstName" format
declare -a RECIPIENTS=(
    "nancynutcha@gmail.com;Nancy"
    "chanaloha7777@gmail.com;Chana"
    "phaitoon2010@gmail.com;Phaitoon"
    "taridadew@gmail.com;Tarida"
    "lilyrosev@gmail.com;Lily"
    "theeraphet@gmail.com;Theera"
    "johnnoon.biz@gmail.com;John & Noon"
    "justagreatdirector@outlook.com;Debbie"
    "pat@contatta.com;Pat"
    "rjbryson@me.com;Rebecca"
)

SUBJECT="🐅 Tiger Claw V4 Massive Upgrade: Your Autonomous Sales Agent"

echo "Subject: $SUBJECT"
echo "Beginning mass dispatch to 10 customers..."

for RECIPIENT_DATA in "${RECIPIENTS[@]}"; do
    # Split the string on semicolon
    EMAIL="${RECIPIENT_DATA%;*}"
    FIRST_NAME="${RECIPIENT_DATA#*;}"

    echo "Drafting and sending to: $FIRST_NAME <$EMAIL>"

    BODY="Hey $FIRST_NAME,<br><br>First, I want to deeply thank you for your patience over the last 14 days.<br><br>When you purchased your autonomous agent, we hit a massive crossroads. Telegram aggressively updated their global anti-spam algorithms, heavily targeting virtual business phone numbers. Instead of deploying your bot on shaky infrastructure that could get banned halfway through closing a prospect, we decided to completely burn the ships and rebuild our backend from the ground up.<br><br><b>Over the last month, we successfully engineered Tiger Claw V4.</b><br><br>We completely migrated off of isolated server containers and built a massive, multi-tenant enterprise architecture hosted directly on Google Cloud. Even better, we built a physical proxy network that binds every single one of our autonomous agents to authentic hardware SIM cards—permanently bypassing Telegram's virtual-number bans.<br><br><b>What this means for you:</b><br/>Your agent is now hosted on enterprise-grade Cloud infrastructure capable of handling zero-latency multi-channel ingestion (Telegram + LINE).<br><br><b>Next Steps & Provisioning:</b><br/>Tomorrow morning, my engineering team is running the final pipeline to securely bind the freshly authenticated hardware tokens to the bot pool.<br><br>The exact second your bot clears configuration on our backend, you will automatically receive an email containing a secure <b>Magic Link</b>.<br><br>That link will log you directly into your new web dashboard (The Hatchery). From there, you will simply paste your Google AI or OpenAI API key, and your bot will instantly go live and begin handling leads 24/7.<br><br>No coding. No complicated setups.<br><br>We are in the absolute final stretch. Check your inbox tomorrow afternoon for the Magic Link!<br><br>Talk soon,<br/><br/>Brent Bryson<br/>BotCraft Works | <a href='https://tigerclaw.io'>Tiger Claw</a>"

    gws gmail +send \
        --to "$EMAIL" \
        --subject "$SUBJECT" \
        --body "$BODY" \
        --html

    # Sleep slightly to remain a good citizen against rate limits
    sleep 3
done

echo "Mass dispatch complete! All 10 emails have been fired directly through Gmail."
