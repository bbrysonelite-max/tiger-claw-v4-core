// Tiger Claw — Customer Dashboard Route
// GAP 9: Customer-facing dashboard endpoint
// GET /dashboard/:slug — returns bot status, usage, channels, API key status, subscription

import { Router, type Request, type Response } from "express";
import {
    getTenantBySlug,
    getTenantBotUsername,
    getBYOKStatus,
    getFoundingMemberDisplay,
    getHiveSignalWithFallback
} from "../services/db.js";
import { hiveAttributionLabel } from "../services/hiveEmitter.js";

const router = Router();

// GET /dashboard/:slug
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const slug = req.params["slug"]!;
    const tenant = await getTenantBySlug(slug);

    if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
    }

    const botUsername = await getTenantBotUsername(tenant.id);
    const keyStatus = await getBYOKStatus(tenant.id);

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
            isLive: tenant.status === "active" || tenant.status === "onboarding",
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
        // URLs for wizard integrations
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

export default router;
