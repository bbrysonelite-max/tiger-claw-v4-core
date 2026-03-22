import { test, expect } from '@playwright/test';

/**
 * PRODUCTION SMOKE TEST (v4 Hardened)
 * Purpose: Verify the "Tiger Claw" Hatcher (UI/UX) is connected to the hardened GCP backend.
 * Domain: https://tiger-claw-frontend-tnyyn7xjtq-uc.a.run.app
 */

test('Complete production onboarding smoke test', async ({ page }) => {
    // 1. Visit App Landing Page (New Cloud Run URL)
    await page.goto('https://tiger-claw-frontend-tnyyn7xjtq-uc.a.run.app');
    
    // Check if we are on the landing page and the wizard button is visible
    const launchButton = page.getByRole('button', { name: 'Launch My Agent' });
    await expect(launchButton).toBeVisible({ timeout: 15000 });
    await launchButton.click();

    // 3. Step 1: Niche Picker
    await expect(page.getByText('Select Your Industry')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Network Marketing' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // 4. Step 2: Bot Identity
    await expect(page.getByText('Bot Identity')).toBeVisible();
    await page.getByPlaceholder('e.g. John Doe').fill('Anti-Gravity Tester');
    await page.getByPlaceholder('you@example.com').fill('tester@botcraftwrks.ai');
    await page.getByRole('button', { name: 'Continue' }).click();

    // 5. Step 3: AI Connection (BYOK)
    await expect(page.getByText('Connect Your AI Engine')).toBeVisible();
    
    // Real API key validation test
    const keyInput = page.getByPlaceholder('AIza...');
    await keyInput.fill('AIzaSyB-V0qIAxg9bY2szwqdkIyjzqC-S-rwsUo');

    // Validate button
    const validateBtn = page.getByRole('button', { name: 'Validate Key →' });
    await validateBtn.click();

    // Expect live success message from backend
    await expect(page.getByText('Key validated — encrypted and stored securely')).toBeVisible({ timeout: 15000 });
    console.log("✅ LIVE API Key Validation SUCCESSFUL.");

    await page.getByRole('button', { name: 'Continue' }).click();

    // 6. Step 4: Review & Pay
    await expect(page.getByText('Review & Pay')).toBeVisible();
    console.log("✅ Reached Payment Step — UI is correctly connected to Backend.");
});

test('Verify Live API Health', async ({ request }) => {
    const response = await request.get('https://api.tigerclaw.io/health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
    console.log("✅ Hardened Production API is HEALTHY.");
});
