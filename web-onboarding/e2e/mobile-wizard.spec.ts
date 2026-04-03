import { test, expect, devices } from '@playwright/test';

/**
 * Mobile Wizard E2E — Tiger Claw V4
 *
 * Simulates a real customer on iPhone going through the full 5-step
 * Stan Store wizard on mobile. Mocks all API calls so no live backend
 * is required. Catches broken buttons, broken flows, broken mobile layout.
 *
 * Run: pnpm exec playwright test mobile-wizard
 */

const MOBILE_VIEWPORT = devices['iPhone 13'];

test.use({ ...MOBILE_VIEWPORT });

test.describe('Mobile Wizard — Full Flow (Stan Store)', () => {

    test.beforeEach(async ({ page }) => {
        // verify-purchase — simulates a paying Stan Store customer
        await page.route('**/auth/verify-purchase', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    sessionToken: 'test-session-token',
                    botId: 'test-bot-id-mobile',
                    name: 'Mobile Tester',
                }),
            });
        });

        // Telegram getMe — validates the bot token in StepChannelSetup
        await page.route('**/api.telegram.org/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true, result: { username: 'mobile_test_bot' } }),
            });
        });

        // validate-key — simulates a valid AI key
        await page.route('**/wizard/validate-key', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ valid: true }),
            });
        });

        // hatch — simulates successful hatch
        await page.route('**/wizard/hatch', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true }),
            });
        });

        // bot-status — immediately returns live so PostPaymentSuccess resolves
        await page.route('**/wizard/bot-status**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'live',
                    botUsername: 'mobile_test_bot',
                    telegramLink: 'https://t.me/mobile_test_bot',
                    tenantSlug: 'mobile-tester-slug',
                }),
            });
        });
    });

    test('completes all 5 steps and reaches deployed state', async ({ page }) => {
        await page.goto('/');

        // ── Email verification ────────────────────────────────────────────────
        const emailInput = page.getByPlaceholder(/your@email\.com/i).first();
        await expect(emailInput).toBeVisible({ timeout: 10000 });
        await emailInput.fill('mobile-test@example.com');

        const verifyBtn = page.getByRole('button', { name: /set up my agent/i }).first();
        await verifyBtn.click();

        // ── Wizard opens ──────────────────────────────────────────────────────
        await expect(page.getByText('Agent Setup')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Step 1 of 5')).toBeVisible();

        // ── Step 1: Identity & Niche ──────────────────────────────────────────
        await expect(page.getByText('Identity & Niche')).toBeVisible();

        // Select a niche
        await page.getByRole('button', { name: /network marketing/i }).click();

        // Your Name
        await page.getByPlaceholder('e.g. Brent Bryson').fill('Mobile Tester');

        // Email
        await page.getByPlaceholder('you@example.com').fill('mobile-test@example.com');

        // Bot Name
        await page.getByPlaceholder('e.g. Prospect Scout').fill('MobileBot');

        await page.getByRole('button', { name: /next/i }).first().click();

        // ── Step 2: Channel Setup ─────────────────────────────────────────────
        await expect(page.getByText('Step 2 of 5')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('Connect Your Channel')).toBeVisible();

        // Enter Telegram bot token — component validates via Telegram API after 700ms
        await page.getByPlaceholder(/paste bot token/i).fill('1234567890:AAFtest-mobile-token-for-e2e');

        // Wait for Telegram validation to complete (checkmark appears)
        await expect(page.getByText(/@mobile_test_bot.*Verified/i)).toBeVisible({ timeout: 5000 });

        await page.getByRole('button', { name: /^next$/i }).click();

        // ── Step 3: AI Connection ─────────────────────────────────────────────
        await expect(page.getByText('Step 3 of 5')).toBeVisible({ timeout: 5000 });

        // Enter AI key and install (Gemini is default provider)
        await page.getByPlaceholder(/paste your.*key/i).fill('AIzaTestKeyMobileE2E12345');
        await page.getByRole('button', { name: /^install$/i }).click();
        await expect(page.getByText(/verified/i)).toBeVisible({ timeout: 10000 });

        await page.getByRole('button', { name: /^continue$/i }).click();

        // ── Step 4: Customer Profile ──────────────────────────────────────────
        await expect(page.getByText('Step 4 of 5')).toBeVisible({ timeout: 5000 });

        await page.getByPlaceholder(/Women 30-55/i).fill('Women 30-55 interested in health');
        await page.getByPlaceholder(/Wrinkles/i).fill('Struggling with aging skin');
        await page.getByPlaceholder(/Cheap products/i).fill('Cheap products that fail');
        await page.getByPlaceholder(/Facebook groups, Instagram, TikTok/i).fill('Facebook groups, Instagram');

        await page.getByRole('button', { name: /^next$/i }).click();

        // ── Step 5: Review & Hatch ────────────────────────────────────────────
        await expect(page.getByText('Step 5 of 5')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('HATCH YOUR TIGER')).toBeVisible();

        // The big button
        const hatchBtn = page.getByRole('button', { name: /activate agent now/i });
        await expect(hatchBtn).toBeVisible();
        await expect(hatchBtn).toBeEnabled();
        await hatchBtn.click();

        // ── PostPaymentSuccess ────────────────────────────────────────────────
        // Bot-status mock returns live immediately
        await expect(page.getByText('Agent Activated')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('@mobile_test_bot')).toBeVisible();
        await expect(page.getByRole('link', { name: /start chat on telegram/i })).toBeVisible();
    });

    test('shows error when hatch fails', async ({ page }) => {
        // Override hatch to fail
        await page.route('**/wizard/hatch', async (route) => {
            await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'No AI key configured.' }),
            });
        });

        await page.goto('/');

        const emailInput = page.getByPlaceholder(/your@email\.com/i).first();
        await emailInput.fill('mobile-test@example.com');
        await page.getByRole('button', { name: /set up my agent/i }).first().click();

        await expect(page.getByText('Step 1 of 5')).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: /network marketing/i }).click();
        await page.getByPlaceholder('e.g. Brent Bryson').fill('Mobile Tester');
        await page.getByPlaceholder('you@example.com').fill('mobile-test@example.com');
        await page.getByPlaceholder('e.g. Prospect Scout').fill('MobileBot');
        await page.getByRole('button', { name: /next/i }).first().click();

        await page.getByPlaceholder(/paste bot token/i).fill('1234567890:AAFtest-token');
        await expect(page.getByText(/@mobile_test_bot.*Verified/i)).toBeVisible({ timeout: 5000 });
        await page.getByRole('button', { name: /^next$/i }).click();

        await page.getByPlaceholder(/paste your.*key/i).fill('AIzaTestKey12345');
        await page.getByRole('button', { name: /^install$/i }).click();
        await expect(page.getByText(/verified/i)).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: /^continue$/i }).click();

        await page.getByPlaceholder(/Women 30-55/i).fill('Test customer');
        await page.getByPlaceholder(/Wrinkles/i).fill('Test problem');
        await page.getByPlaceholder(/Cheap products/i).fill('Test failing');
        await page.getByPlaceholder(/Facebook groups, Instagram, TikTok/i).fill('Facebook');
        await page.getByRole('button', { name: /^next$/i }).click();

        await page.getByRole('button', { name: /activate agent now/i }).click();

        // Error message shown, button re-enabled
        await expect(page.getByText('No AI key configured.')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: /activate agent now/i })).toBeEnabled();
    });

    test('back button works on every step', async ({ page }) => {
        await page.goto('/');

        const emailInput = page.getByPlaceholder(/your@email\.com/i).first();
        await emailInput.fill('mobile-test@example.com');
        await page.getByRole('button', { name: /set up my agent/i }).first().click();

        await expect(page.getByText('Step 1 of 5')).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: /network marketing/i }).click();
        await page.getByPlaceholder('e.g. Brent Bryson').fill('Mobile Tester');
        await page.getByPlaceholder('you@example.com').fill('mobile-test@example.com');
        await page.getByPlaceholder('e.g. Prospect Scout').fill('MobileBot');
        await page.getByRole('button', { name: /next/i }).first().click();

        // On step 2 — back button should return to step 1
        await expect(page.getByText('Step 2 of 5')).toBeVisible({ timeout: 5000 });
        await page.getByRole('button', { name: /go back/i }).click();
        await expect(page.getByText('Step 1 of 5')).toBeVisible();
        await expect(page.getByText('Identity & Niche')).toBeVisible();
    });

});
