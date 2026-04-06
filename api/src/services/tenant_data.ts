import { withClient, getPool } from "./db.js";

// ---------------------------------------------------------------------------
// Types (matching the tool expectations)
// ---------------------------------------------------------------------------

export interface LeadRecord {
  id: string;
  platform: string;
  platformId: string;
  displayName: string;
  profileUrl?: string;
  builderScore: number;
  customerScore: number;
  qualifyingScore: number;
  qualified: boolean;
  optedOut: boolean;
  manualStatus?: string;
  discoveredAt: string;
  lastScoredAt: string;
  [key: string]: any;
}

export interface ContactRecord {
  leadId: string;
  status: string;
  [key: string]: any;
}

export interface NurtureRecord {
  leadId: string;
  status: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Leads (Replaces leads.json)
// ---------------------------------------------------------------------------

export async function getLeads(tenantId: string): Promise<Record<string, LeadRecord>> {
    const pool = getPool();
    const { rows } = await pool.query(
        "SELECT id, raw_data FROM tenant_leads WHERE tenant_id = $1",
        [tenantId]
    );

    const leadsMap: Record<string, LeadRecord> = {};
    for (const row of rows) {
        leadsMap[row.id] = row.raw_data as LeadRecord;
    }
    return leadsMap;
}

export async function saveLeads(tenantId: string, leads: Record<string, LeadRecord>): Promise<void> {
    const leadsArray = Object.values(leads);
    if (leadsArray.length === 0) return;

    await withClient(async (client) => {
        await client.query("BEGIN");

        // We use UPSERT (ON CONFLICT id DO UPDATE)
        const query = `
            INSERT INTO tenant_leads (
                id, tenant_id, platform, platform_id, display_name, profile_url,
                builder_score, customer_score, qualifying_score, qualified, opted_out,
                manual_status, discovered_at, last_scored_at, raw_data, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
                builder_score = EXCLUDED.builder_score,
                customer_score = EXCLUDED.customer_score,
                qualifying_score = EXCLUDED.qualifying_score,
                qualified = EXCLUDED.qualified,
                opted_out = EXCLUDED.opted_out,
                manual_status = EXCLUDED.manual_status,
                last_scored_at = EXCLUDED.last_scored_at,
                raw_data = EXCLUDED.raw_data,
                updated_at = NOW();
        `;

        for (const lead of leadsArray) {
            await client.query(query, [
                lead.id,
                tenantId,
                lead.platform || "unknown",
                lead.platformId || "unknown",
                lead.displayName || "Unknown Lead",
                lead.profileUrl || null,
                lead.builderScore || 0,
                lead.customerScore || 0,
                lead.qualifyingScore || 0,
                lead.qualified || false,
                lead.optedOut || false,
                lead.manualStatus || null,
                lead.discoveredAt || new Date().toISOString(),
                lead.lastScoredAt || new Date().toISOString(),
                lead, // raw_data
            ]);
        }

        await client.query("COMMIT");
    });
}

// ---------------------------------------------------------------------------
// Contacts (Replaces contacts.json)
// ---------------------------------------------------------------------------

export async function getContacts(tenantId: string): Promise<Record<string, ContactRecord>> {
    const pool = getPool();
    const { rows } = await pool.query(
        "SELECT lead_id, raw_data FROM tenant_contacts WHERE tenant_id = $1",
        [tenantId]
    );

    const contactsMap: Record<string, ContactRecord> = {};
    for (const row of rows) {
        contactsMap[row.lead_id] = row.raw_data as ContactRecord;
    }
    return contactsMap;
}

export async function saveContacts(tenantId: string, contacts: Record<string, ContactRecord>): Promise<void> {
    const contactsArray = Object.values(contacts);
    if (contactsArray.length === 0) return;

    await withClient(async (client) => {
        await client.query("BEGIN");

        const query = `
            INSERT INTO tenant_contacts (id, tenant_id, lead_id, status, raw_data, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
            ON CONFLICT (tenant_id, lead_id) DO UPDATE SET
                status = EXCLUDED.status,
                raw_data = EXCLUDED.raw_data,
                updated_at = NOW();
        `;

        for (const contact of contactsArray) {
            await client.query(query, [
                tenantId,
                contact.leadId,
                contact.status || "new",
                contact, // raw_data
            ]);
        }

        await client.query("COMMIT");
    });
}

// ---------------------------------------------------------------------------
// Nurture (Replaces nurture.json)
// ---------------------------------------------------------------------------

export async function getNurture(tenantId: string): Promise<Record<string, NurtureRecord>> {
    const pool = getPool();
    const { rows } = await pool.query(
        "SELECT lead_id, raw_data FROM tenant_nurture WHERE tenant_id = $1",
        [tenantId]
    );

    const nurtureMap: Record<string, NurtureRecord> = {};
    for (const row of rows) {
        nurtureMap[row.lead_id] = row.raw_data as NurtureRecord;
    }
    return nurtureMap;
}

export async function saveNurture(tenantId: string, nurture: Record<string, NurtureRecord>): Promise<void> {
    const nurtureArray = Object.values(nurture);
    if (nurtureArray.length === 0) return;

    await withClient(async (client) => {
        await client.query("BEGIN");

        const query = `
            INSERT INTO tenant_nurture (id, tenant_id, lead_id, status, raw_data, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
            ON CONFLICT (tenant_id, lead_id) DO UPDATE SET
                status = EXCLUDED.status,
                raw_data = EXCLUDED.raw_data,
                updated_at = NOW();
        `;

        for (const item of nurtureArray) {
            await client.query(query, [
                tenantId,
                item.leadId,
                item.status || "active",
                item, // raw_data
            ]);
        }

        await client.query("COMMIT");
    });
}

// ---------------------------------------------------------------------------
// States (Replaces scout_state.json, onboard_state.json, settings.json, etc)
// ---------------------------------------------------------------------------

export async function getTenantState<T>(tenantId: string, stateKey: string): Promise<T | null> {
    const pool = getPool();
    const { rows } = await pool.query(
        "SELECT state_data FROM tenant_states WHERE tenant_id = $1 AND state_key = $2",
        [tenantId, stateKey]
    );

    if (rows.length === 0) return null;
    return rows[0].state_data as T;
}

export async function saveTenantState<T>(tenantId: string, stateKey: string, data: T): Promise<void> {
    const pool = getPool();
    await pool.query(
        `
        INSERT INTO tenant_states (tenant_id, state_key, state_data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (tenant_id, state_key) DO UPDATE SET
            state_data = EXCLUDED.state_data,
            updated_at = NOW();
        `,
        [tenantId, stateKey, data]
    );
}

// ---------------------------------------------------------------------------
// Active Context — per-tenant working state
// What the agent is currently focused on, injected into every system prompt.
// ---------------------------------------------------------------------------

export interface ActiveContext {
    currentFocus?: string;
    activeLead?: string;
    lastAction?: string;
    lastActionAt?: string;
    pendingFollowUps?: Array<{ name: string; dueDate: string; note?: string }>;
    leadsInPipeline?: number;
    updatedAt: string;
}

export async function getActiveContext(tenantId: string): Promise<ActiveContext | null> {
    return getTenantState<ActiveContext>(tenantId, 'active_context');
}

export async function updateActiveContext(
    tenantId: string,
    patch: Partial<Omit<ActiveContext, 'updatedAt'>>
): Promise<void> {
    const current = await getActiveContext(tenantId) ?? {} as Partial<ActiveContext>;
    await saveTenantState<ActiveContext>(tenantId, 'active_context', {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
    } as ActiveContext);
}
