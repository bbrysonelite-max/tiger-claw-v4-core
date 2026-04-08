// Tiger Claw — Customer Dashboard Route
// GAP 9: Customer-facing dashboard endpoint
// GET /dashboard/:slug — returns bot status, usage, channels, API key status, subscription

import { Router, type Request, type Response } from "express";
import { requireSession } from "./auth.js";
import {
    getTenantBySlug,
    getTenantBotUsername,
    getBYOKStatus,
    getFoundingMemberDisplay,
    getHiveSignalWithFallback,
    getPool,
} from "../services/db.js";
import { hiveAttributionLabel } from "../services/hiveEmitter.js";
import { validateAIKey } from "../services/ai.js";
import { addAIKey } from "../services/db.js";
import { encryptToken } from "../services/pool.js";

const router = Router();

// GET /dashboard/:slug
router.get("/:slug", requireSession, async (req: Request, res: Response) => {
  try {
    const slug = req.params["slug"]!;
    const tenant = await getTenantBySlug(slug);

    if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
    }

    // Ownership check: session must belong to this tenant
    const session = res.locals["session"] as { botId: string };
    if (session.botId !== tenant.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const pool = getPool();
    const [botUsernameResult, keyStatus, leadsResult] = await Promise.all([
        getTenantBotUsername(tenant.id),
        getBYOKStatus(tenant.id),
        pool.query(`
            SELECT name, score, status, created_at, profile_url
            FROM tenant_leads
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT 5
        `, [tenant.id]).catch(() => ({ rows: [] })),
    ]);
    const botUsername = botUsernameResult;

    // Build LINE webhook URL for the 5-step wizard
    const apiBase = process.env["TIGER_CLAW_API_URL"];
    if (!apiBase) return res.status(500).json({ error: "TIGER_CLAW_API_URL environment variable is not set" });
    const lineWebhookUrl = `${apiBase}/webhooks/line/${tenant.id}`;

    // Build dashboard data
    const dashboard = {
        tenant: {
            id: tenant.id,
            slug: tenant.slug,
            name: tenant.name,
            status: tenant.status,
            flavor: tenant.flavor,
            region: tenant.region,
            language: tenant.language,
            preferredChannel: tenant.preferredChannel,
            createdAt: tenant.createdAt.toISOString(),
            lastActivityAt: tenant.lastActivityAt?.toISOString() ?? null,
        },
        bot: {
            username: botUsername ? `@${botUsername}` : null,
            telegramLink: botUsername ? `https://t.me/${botUsername}` : null,
            isLive: tenant.status === "active" || tenant.status === "onboarding" || tenant.status === "live",
        },
        apiKey: {
            configured: keyStatus?.configured ?? false,
            health: tenant.keyHealth ?? 'healthy',
            provider: keyStatus?.provider ?? null,
            model: keyStatus?.model ?? null,
            keyPreview: keyStatus?.keyPreview ?? null,
            connectionType: keyStatus?.connectionType ?? null,
            lastUpdated: keyStatus?.updatedAt ?? null,
        },
        channels: {
            telegram: {
                enabled: true,
                botUsername: botUsername ?? null,
            },
            whatsapp: {
                enabled: tenant.whatsappEnabled ?? false,
            },
            line: {
                configured: !!(tenant.lineChannelSecret && tenant.lineChannelAccessToken),
                webhookUrl: lineWebhookUrl,
            },
        },
        subscription: {
            plan: "byok_basic",
            status: tenant.status === "active" ? "active" : tenant.status,
        },
        foundingMember: null as any,
        hive: {
            benchmarks: {} as any,
            icp: null as any
        },
        leads: {
            total: leadsResult.rows.length,
            recent: leadsResult.rows.map(r => ({
                name: r.name,
                score: r.score,
                status: r.status,
                foundAt: r.created_at,
                profileUrl: r.profile_url ?? null,
            })),
        },
        dashboardUrl: `${process.env['FRONTEND_URL'] ?? 'https://wizard.tigerclaw.io'}/dashboard?slug=${tenant.slug}`,
        wizardUrl: `/wizard/${tenant.slug}`,
        channelConfigUrl: `${apiBase}/wizard/${tenant.slug}`,
    };

    // Hive Phase 4: Inject Founding Member
    try {
      const founderInfo = await getFoundingMemberDisplay(tenant.id);
      dashboard.foundingMember = founderInfo;
    } catch {
      dashboard.foundingMember = null;
    }

    // Hive Phase 4: Inject ICP layer bounds
    try {
      const icpSignal = await getHiveSignalWithFallback('ideal_customer_profile', tenant.flavor || 'network-marketer', tenant.region || 'us-en');
      if (icpSignal) {
        dashboard.hive.icp = {
          signalKey: icpSignal.signalKey,
          sourceLabel: hiveAttributionLabel(icpSignal),
          payload: icpSignal.payload,
          updatedAt: icpSignal.updatedAt.toISOString(),
          sampleSize: icpSignal.sampleSize
        };
      }
    } catch {
      dashboard.hive.icp = null;
    }

    // Hive Phase 4: Inject Prior Benchmarks
    try {
      const objectionSignal = await getHiveSignalWithFallback('objection', tenant.flavor || 'network-marketer', tenant.region || 'us-en');
      if (objectionSignal) {
        dashboard.hive.benchmarks['objection'] = {
          signalKey: objectionSignal.signalKey,
          sourceLabel: hiveAttributionLabel(objectionSignal),
          payload: objectionSignal.payload
        };
      }
    } catch {
      dashboard.hive.benchmarks['objection'] = null;
    }

    return res.json(dashboard);
  } catch (err) {
    console.error("[dashboard] GET /:slug error:", err instanceof Error ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /dashboard/:slug/update-key — inline key update, no wizard required
router.post("/:slug/update-key", requireSession, async (req: Request, res: Response) => {
    try {
        const slug = req.params["slug"]!;
        const { key, provider, model } = req.body as { key: string; provider: string; model?: string };

        if (!key || !provider) {
            return res.status(400).json({ error: "key and provider are required" });
        }

        const tenant = await getTenantBySlug(slug);
        if (!tenant) return res.status(404).json({ error: "Tenant not found" });

        // Ownership check: session must belong to this tenant
        const session = res.locals["session"] as { botId: string };
        if (session.botId !== tenant.id) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const { valid, error: validationError } = await validateAIKey(provider, key);
        if (!valid) {
            return res.status(400).json({ error: validationError ?? "Key validation failed" });
        }

        const encrypted = encryptToken(key);
        const preview = `${key.slice(0, 4)}...${key.slice(-4)}`;
        await addAIKey({
            botId: tenant.id,
            provider,
            model: model ?? (provider === 'google' ? 'gemini-2.0-flash' : 'gpt-4o-mini'),
            encryptedKey: encrypted,
            keyPreview: preview,
            priority: 1,
        });

        await getPool().query(
            `UPDATE tenants SET key_health = 'healthy' WHERE id = $1`,
            [tenant.id]
        );

        return res.json({ success: true, preview });
    } catch (err) {
        console.error("[dashboard] POST update-key error:", err);
        return res.status(500).json({ error: "Failed to update key" });
    }
});

export default router;
