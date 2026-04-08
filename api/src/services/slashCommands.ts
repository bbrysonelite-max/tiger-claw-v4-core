// Tiger Claw — Slash Command Handler
// Intercepts /start /dashboard /status /help before Gemini sees them.
// Returns true if handled (caller should skip AI), false to pass through.

import { getTenant, getBYOKStatus, getPool, getBotState, setBotState } from './db.js';

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'https://wizard.tigerclaw.io';

// Identity questions that Gemini's training overrides the system prompt on.
// Intercept these before Gemini sees them and answer as the bot persona.
const IDENTITY_PATTERNS = /^(who|what)\s+are\s+you|are\s+you\s+(an?\s+)?(ai|bot|robot|gemini|google|language\s+model|llm)|tell\s+me\s+about\s+yourself|what\s+is\s+your\s+name|introduce\s+yourself/i;

export async function handleSlashCommand(
    tenantId: string,
    botToken: string,
    chatId: number,
    text: string,
): Promise<boolean> {
    const cmd = text.split(/\s+/)[0]!.toLowerCase().split('@')[0]; // strip @botname suffix

    // Intercept identity questions — Gemini ignores system prompt instructions on these
    if (!cmd.startsWith('/') && IDENTITY_PATTERNS.test(text.trim())) {
        const tenant = await getTenant(tenantId);
        const name = tenant?.name ?? 'Tiger';
        await tgSend(botToken, chatId, `I'm ${name} — your AI-powered sales agent. I hunt leads, qualify prospects, and help you close. What can I do for you today?`);
        return true;
    }

    if (!cmd.startsWith('/')) return false;

    switch (cmd) {
        case '/start':
            await handleStart(tenantId, botToken, chatId);
            return true;
        case '/dashboard':
            await sendDashboardMessage(tenantId, botToken, chatId);
            return true;
        case '/status':
            await sendStatusMessage(tenantId, botToken, chatId);
            return true;
        case '/help':
            await sendHelp(botToken, chatId);
            return true;
        default:
            return false;
    }
}

// First /start per chatId: 4-language greeting to demonstrate intelligence.
// Subsequent /start: send dashboard link.
async function handleStart(tenantId: string, botToken: string, chatId: number) {
    const stateKey = 'first_impression_shown.json';
    let shownTo: number[] = [];
    try {
        const stored = await getBotState<number[]>(tenantId, stateKey);
        if (Array.isArray(stored)) shownTo = stored;
    } catch { /* fresh state */ }

    if (shownTo.includes(chatId)) {
        // Already greeted — send dashboard link
        return sendDashboardMessage(tenantId, botToken, chatId);
    }

    // First time — 4-language greeting
    const tenant = await getTenant(tenantId);
    const agentName = tenant?.name ?? 'Tiger';

    const greeting =
        `Hi, I'm ${agentName}. I'm here to take you by the hand and lead you to a brighter future.\n\n` +
        `สวัสดี ฉัน${agentName} ฉันพร้อมที่จะพาคุณไปสู่อนาคตที่สดใสกว่า\n\n` +
        `Hola, soy ${agentName}. Estoy aquí para guiarte hacia un futuro más brillante.\n\n` +
        `Hallo, ich bin ${agentName}. Ich bin hier, um dich in eine bessere Zukunft zu führen.\n\n` +
        `Let's get to work! I'm having my nails done later!`;

    await tgSend(botToken, chatId, greeting);

    // Mark this chatId as greeted
    shownTo.push(chatId);
    await setBotState(tenantId, stateKey, shownTo).catch(() => {});
}

async function sendDashboardMessage(tenantId: string, botToken: string, chatId: number) {
    const tenant = await getTenant(tenantId);
    if (!tenant) return;
    const url = `${FRONTEND_URL}/dashboard?slug=${encodeURIComponent(tenant.slug)}`;
    await tgSend(botToken, chatId,
        `Your control panel 👇\n\n${url}\n\n` +
        `Update your AI key, check lead activity, and configure channels — all in one place.`
    );
}

async function sendStatusMessage(tenantId: string, botToken: string, chatId: number) {
    const [tenant, keyStatus, leadsResult] = await Promise.all([
        getTenant(tenantId),
        getBYOKStatus(tenantId).catch(() => null),
        getPool().query(
            `SELECT COUNT(*) AS total, MAX(created_at) AS last_found FROM tenant_leads WHERE tenant_id = $1`,
            [tenantId]
        ).catch(() => ({ rows: [{ total: 0, last_found: null }] })),
    ]);

    if (!tenant) return;

    const keyLine = keyStatus?.configured
        ? (tenant.keyHealth === 'dead' ? '🔴 Key dead — update at /dashboard' : '🟢 Key active')
        : '🟡 Using platform key (limited)';

    const total = parseInt(leadsResult.rows[0]?.total ?? '0', 10);
    const lastFound: Date | null = leadsResult.rows[0]?.last_found ?? null;
    const leadsLine = total > 0
        ? `📋 ${total} lead${total === 1 ? '' : 's'} found${lastFound ? ` · last ${timeAgo(lastFound)}` : ''}`
        : '📋 No leads yet — I\'m hunting';

    const statusLine = tenant.status === 'active' ? '✅ Active' : `⏳ ${tenant.status}`;

    await tgSend(botToken, chatId,
        `*${tenant.name} — Status*\n\n${statusLine}\n${keyLine}\n${leadsLine}\n\nType /dashboard for your control panel.`,
        { parse_mode: 'Markdown' }
    );
}

async function sendHelp(botToken: string, chatId: number) {
    await tgSend(botToken, chatId,
        `*Tiger Claw Commands*\n\n` +
        `/dashboard — Your control panel (key, leads, channels)\n` +
        `/status — Quick health check\n` +
        `/help — This menu\n\n` +
        `_Or just talk to me — I'm here to hunt._`,
        { parse_mode: 'Markdown' }
    );
}

async function tgSend(botToken: string, chatId: number, text: string, extra?: Record<string, unknown>) {
    const body = { chat_id: chatId, text, ...extra };
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.text();
        console.error(`[slashCommands] sendMessage failed: ${err}`);
    }
}

function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// Register slash commands with Telegram BotFather so they appear in the menu.
// Call this once during provisioning or on-demand.
export async function registerBotCommands(botToken: string): Promise<void> {
    const commands = [
        { command: 'dashboard', description: 'Open your control panel' },
        { command: 'status', description: 'Quick health check' },
        { command: 'help', description: 'List commands' },
    ];
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands }),
    });
    if (!res.ok) {
        const err = await res.text();
        console.warn(`[slashCommands] setMyCommands failed: ${err}`);
    }
}
