// Tiger Claw — Config-Driven Flavor System
// Unified TypeScript-based Flavor System — TIGERCLAW-MASTER-SPEC-v2.md Block 2
//
// This loader resolves flavors from the type-safe FLAVOR_REGISTRY in api/src/config/flavors/.
// Legacy JSON support is removed in favor of the stateless v4 architecture.

import { FlavorConfig } from "../config/types.js";
import { FLAVOR_REGISTRY } from "../config/flavors/index.js";

export { FlavorConfig };

// All valid customer-facing flavors.
export const VALID_FLAVOR_KEYS = [
    "network-marketer",
    "real-estate",
    "health-wellness",
    "airbnb-host",
    "lawyer",
    "plumber",
    "sales-tiger",
    "mortgage-broker",
] as const;

export type ValidFlavorKey = typeof VALID_FLAVOR_KEYS[number];

const REQUIRED_FLAVORS = VALID_FLAVOR_KEYS;

/**
 * Loads the consolidated FlavorConfig from the central registry.
 * Falls back to network-marketer if the flavor is not found.
 */
export function loadFlavorConfig(flavor: string): FlavorConfig {
    const safeFlavor = flavor || "network-marketer";

    if (FLAVOR_REGISTRY[safeFlavor]) {
        return FLAVOR_REGISTRY[safeFlavor]!;
    }

    // Fallback to network-marketer
    if (safeFlavor !== "network-marketer") {
        console.warn(`[flavor] ${safeFlavor} not found in registry, falling back to network-marketer`);
        return loadFlavorConfig("network-marketer");
    }

    // The registry should ALWAYS have network-marketer. If it doesn't, we have a boot error.
    throw new Error(`[flavor] Fatal: network-marketer flavor missing from registry.`);
}

/**
 * Boot-time validation: ensures all required flavors are present in the registry.
 */
export function validateAllFlavors(): { valid: boolean; missing: string[]; loaded: string[] } {
    const missing: string[] = [];
    const loaded: string[] = [];

    for (const flavor of REQUIRED_FLAVORS) {
        if (FLAVOR_REGISTRY[flavor]) {
            loaded.push(flavor);
        } else {
            console.error(`[flavor] ❌ Missing required flavor in registry: ${flavor}`);
            missing.push(flavor);
        }
    }

    if (missing.length > 0) {
        console.error(`[flavor] ⚠️ ${missing.length} flavor(s) missing from registry: ${missing.join(", ")}`);
    } else {
        console.log(`[flavor] ✅ All ${REQUIRED_FLAVORS.length} customer flavors loaded from registry.`);
    }

    return { valid: missing.length === 0, missing, loaded };
}

/** Get list of all available flavor IDs */
export function listFlavors(): string[] {
    return Object.keys(FLAVOR_REGISTRY);
}

/**
 * Replaces all occurrences of {{key}} with value in the given template string.
 */
export function fillTemplate(template: string, variables: Record<string, string | undefined>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        const safeValue = value ?? "";
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), safeValue);
    }
    return result;
}
