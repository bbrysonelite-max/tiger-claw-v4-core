import { createBYOKUser, createBYOKBot, createBYOKSubscription } from "./src/services/db.js";

async function seed() {
    const email = "john@agent.test";
    const name = "John Browser";
    const flavor = "real-estate";

    console.log(`Seeding test user ${email} into the live Postgres database...`);
    
    // 1. Create User
    const userId = await createBYOKUser(email, name);
    console.log(`✅ User created: ${userId}`);

    // 2. Create Bot (creates the tenant record with status='pending')
    const botId = await createBYOKBot(userId, name, flavor, "pending", email);
    console.log(`✅ Bot/Tenant created: ${botId}`);

    // 3. Create Subscription (Simulating Stan Store checkout)
    await createBYOKSubscription({
        userId,
        botId,
        stripeSubscriptionId: `stan_store_sale_subagent_test`,
        planTier: "byok_basic"
    });
    console.log(`✅ Subscription created.`);
    
    console.log(`\n🎉 SEED COMPLETE. The production webhook /wizard/hatch will now successfully resolve this tenant.`);
    process.exit(0);
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
