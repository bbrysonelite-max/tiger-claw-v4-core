import 'dotenv/config';
import { getPool } from '../services/db.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

async function broadcastNewsletter() {
    const pool = getPool();
    console.log("Starting Tiger Claw Newsletter Broadcast...");

    try {
        // Fetch all distinct emails from both users and tenants tables
        const query = `
            SELECT email FROM users WHERE email IS NOT NULL AND email != ''
            UNION
            SELECT email FROM tenants WHERE email IS NOT NULL AND email != ''
        `;
        const { rows } = await pool.query(query);
        const emails = rows.map(r => r.email).filter(Boolean);

        if (emails.length === 0) {
            console.log("No subscribers found. Exiting.");
            return;
        }

        console.log(`Found ${emails.length} subscribers. Preparing broadcast...`);

        const subject = "Tiger Claw V4 Architecture is Live! 🐯⚡";
        const html = `
            <h2>Tiger Claw just got a massive upgrade.</h2>
            <p>We've completely eliminated container-sprawl and rebuilt the entire platform on a Serverless PostgreSQL architecture.</p>
            <ul>
                <li><strong>Infinite Scaling:</strong> Handles thousands of DMs simultaneously with zero latency.</li>
                <li><strong>Zero Memory Loss:</strong> Perfect conversational memory without FUSE delays.</li>
                <li><strong>New Onboarding Portal:</strong> <a href="https://wizard.tigerclaw.io">Hatch your next agent instantly.</a></li>
            </ul>
            <p>Thank you for scaling with us!</p>
            <p>- The BotCraftWorks Team</p>
        `;

        const batch = emails.map(email => ({
            from: 'Tiger Claw Updates <updates@tigerclaw.io>',
            to: [email],
            subject,
            html
        }));

        // Send in chunks of 100 per Resend limits
        for (let i = 0; i < batch.length; i += 100) {
            const chunk = batch.slice(i, i + 100);
            console.log(`Sending batch ${Math.floor(i / 100) + 1}...`);
            const response = await resend.batch.send(chunk);
            console.log("Batch response:", response);
        }

        console.log("Broadcast complete! 🚀");
    } catch (e) {
        console.error("Broadcast failed:", e);
    } finally {
        await pool.end();
    }
}

// Run script if executed directly
broadcastNewsletter().catch(console.error);

export { broadcastNewsletter };
