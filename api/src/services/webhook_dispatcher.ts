// ---------------------------------------------------------------------------
// Refinery Webhook Dispatcher
// ---------------------------------------------------------------------------

export interface WebhookConfig {
  clientId: string;
  endpointUrl: string;
  secretToken: string;
  filters: {
    domains?: string[];
    minConfidence?: number;
  };
}

/**
 * Dispatches refined facts to client endpoints.
 */
export async function dispatchRefinedFact(fact: any, config: WebhookConfig): Promise<boolean> {
  // Apply filters
  if (config.filters.domains && !config.filters.domains.includes(fact.domain)) return false;
  if (config.filters.minConfidence && fact.confidence_score < config.filters.minConfidence) return false;

  try {
    const res = await fetch(config.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tiger-Claw-Secret": config.secretToken,
        "X-Refinery-Event": "fact_purified"
      },
      body: JSON.stringify(fact)
    });

    return res.ok;
  } catch (err) {
    console.error(`[webhook] Dispatch failed for client ${config.clientId}:`, err);
    return false;
  }
}
