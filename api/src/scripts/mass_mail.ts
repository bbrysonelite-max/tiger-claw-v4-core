import { Resend } from "resend";
import * as dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const customers = [
    { name: "Nancy Lim", email: "nancynutcha@gmail.com" },
    { name: "Chana Lohasaptawee", email: "chanaloha7777@gmail.com" },
    { name: "Phaitoon", email: "phaitoon2010@gmail.com" },
    { name: "Tarida", email: "taridadew@gmail.com" },
    { name: "Lily Vergara", email: "lilyrosev@gmail.com" },
    { name: "Theera Phetmalaigul", email: "theeraphet@gmail.com" },
    { name: "John & Noon", email: "johnnoon.biz@gmail.com" },
    { name: "Debbie Cameron", email: "justagreatdirector@outlook.com" },
    { name: "Pat Sullivan", email: "pat@contatta.com" },
    { name: "Rebecca Bryson", email: "rjbryson@me.com" }
];

async function sendEmails() {
    console.log(`Starting onboarding blast for ${customers.length} customers...`);
    
    for (const customer of customers) {
        try {
            const firstName = customer.name.split(" ")[0]; // Get first name
            
            const html = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <p>Hey ${firstName},</p>
                    <p>It's Brent. First, I want to deeply thank you for your patience over the last 14 days.</p>
                    <p>When you purchased your autonomous agent, we hit a massive crossroads. Telegram aggressively updated their global anti-spam algorithms, heavily targeting virtual business phone numbers. Instead of deploying your bot on shaky infrastructure that could get banned halfway through closing a prospect, we decided to completely burn the ships and rebuild our backend from the ground up.</p>
                    <p><strong>Over the last month, we successfully engineered Tiger Claw V4.</strong></p>
                    <p>We completely migrated off of isolated server containers and built a massive, multi-tenant enterprise architecture hosted directly on Google Cloud. Even better, we built a physical proxy network that binds every single one of our autonomous agents to authentic hardware SIM cards—permanently bypassing Telegram's virtual-number bans.</p>
                    <p><strong>What this means for you:</strong><br/>
                    Your agent is now hosted on enterprise-grade Cloud infrastructure capable of handling zero-latency multi-channel ingestion (Telegram + LINE).</p>
                    <p><strong>Next Steps & Provisioning:</strong><br/>
                    Tomorrow morning, my engineering team is running the final pipeline to securely bind the freshly authenticated hardware tokens to the bot pool.</p>
                    <p>The exact second your bot clears configuration on our backend, you will automatically receive an email containing a secure <strong>Magic Link</strong>.</p>
                    <p>That link will log you directly into your new web dashboard (The Hatchery). From there, you will simply paste your Google AI or OpenAI API key, and your bot will instantly go live and begin handling leads 24/7.</p>
                    <p>No coding. No complicated setups.</p>
                    <p>We are in the absolute final stretch. Check your inbox tomorrow afternoon for the Magic Link!</p>
                    <p>Talk soon,<br/>
                    Brent Bryson<br/>
                    BotCraft Works | <a href="https://tigerclaw.io">Tiger Claw</a></p>
                </div>
            `;

            const { data, error } = await resend.emails.send({
                from: "Tiger Claw <hello@api.tigerclaw.io>",
                to: customer.email,
                subject: "Massive Upgrade Complete: Your Autonomous Sales Agent is Being Provisioned",
                html: html,
            });

            if (error) {
                console.error(`❌ Failed to send to ${customer.email}:`, error);
            } else {
                console.log(`✅ Successfully sent to ${customer.email} (ID: ${data?.id})`);
            }
            
            // Wait slightly between sends to avoid rate limits
            await new Promise(r => setTimeout(r, 500));
            
        } catch (e) {
            console.error(`💥 Exception sending to ${customer.email}:`, e);
        }
    }
    
    console.log("Blast complete!");
}

sendEmails();
