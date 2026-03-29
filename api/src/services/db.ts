// Tiger Claw API — Database Layer
// Platform PostgreSQL: tenant registry + hive patterns
// TIGERCLAW-MASTER-SPEC-v2.md Block 1.4, Block 5.1
//
// Schema (auto-applied on startup via initSchema):
//   tenants     — tenant registry, lifecycle states, container metadata
//   hive_patterns — cross-tenant anonymous learning patterns (opt-in only)
//   key_events    — API key rotation log (platform-level)
//   admin_events  — audit log for admin actions

import { Pool, PoolClient } from "pg";

// ---------------------------------------------------------------------------
// Connection pools (Write + Read splitting)
// ---------------------------------------------------------------------------

let writePool: Pool | null = null;
let readPool: Pool | null = null;

export function getWritePool(): Pool {
  if (!writePool) {
    const dbUrl = process.env["DATABASE_URL"];
    if (!dbUrl) throw new Error("[FATAL] DATABASE_URL environment variable is required");
    writePool = new Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    writePool.on("error", (err) => {
      console.error("[db] Write Pool error:", err.message);
    });
  }
  return writePool;
}

export function getReadPool(): Pool {
  // If no read URL provided, fallback to write pool (standard behavior)
  const readUrl = process.env["DATABASE_READ_URL"];
  if (!readUrl) return getWritePool();

  if (!readPool) {
    readPool = new Pool({
      connectionString: readUrl,
      max: 20, // Replicas can handle more concurrent read connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    readPool.on("error", (err) => {
      console.error("[db] Read Pool error:", err.message);
    });
  }
  return readPool;
}

export async function closePools(): Promise<void> {
  if (writePool) {
    await writePool.end();
    writePool = null;
  }
  if (readPool) {
    await readPool.end();
    readPool = null;
  }
}

/** Legacy alias for backward compatibility */
export function getPool(): Pool {
  return getWritePool();
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getWritePool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** 
 * Utility for read-only clients. 
 */
export async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getReadPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Schema initialization
// ---------------------------------------------------------------------------

export async function initSchema(): Promise<void> {
  // runMigrations() is called explicitly in index.ts main() before this function.
  // Do NOT call it here — it would run migrations twice.
  console.log("[db] Schema ready.");
}

// ---------------------------------------------------------------------------
// Tenant types + queries
// ---------------------------------------------------------------------------

export type TenantStatus =
  | "pending"
  | "waitlisted"
  | "onboarding"
  | "active"
  | "live"
  | "updating"
  | "paused"
  | "suspended"
  | "terminated";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  email?: string;
  status: TenantStatus;
  flavor: string;
  region: string;
  language: string;
  preferredChannel: string;
  botToken?: string;
  botUsername?: string;
  port?: number;
  containerId?: string;
  containerName?: string;
  onboardingKeyUsed: number;
  canaryGroup: boolean;
  whatsappEnabled: boolean;
  lineToken?: string;
  lineChannelSecret?: string;
  lineChannelAccessToken?: string;
  lastActivityAt?: Date;
  suspendedAt?: Date;
  suspendedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

function rowToTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row["id"] as string,
    slug: row["slug"] as string,
    name: row["name"] as string,
    email: row["email"] as string | undefined,
    status: row["status"] as TenantStatus,
    flavor: row["flavor"] as string,
    region: row["region"] as string,
    language: row["language"] as string,
    preferredChannel: row["preferred_channel"] as string,
    botToken: row["bot_token"] as string | undefined,
    botUsername: row["bot_username"] as string | undefined,
    port: row["port"] as number | undefined,
    containerId: row["container_id"] as string | undefined,
    containerName: row["container_name"] as string | undefined,
    onboardingKeyUsed: row["onboarding_key_used"] as number,
    canaryGroup: (row["canary_group"] as boolean) ?? false,
    whatsappEnabled: (row["whatsapp_enabled"] as boolean) ?? false,
    lineToken: row["line_token"] as string | undefined,
    lineChannelSecret: row["line_channel_secret"] as string | undefined,
    lineChannelAccessToken: row["line_channel_access_token"] as string | undefined,
    lastActivityAt: row["last_activity_at"] ? new Date(row["last_activity_at"] as string) : undefined,
    suspendedAt: row["suspended_at"] ? new Date(row["suspended_at"] as string) : undefined,
    suspendedReason: row["suspended_reason"] as string | undefined,
    createdAt: new Date(row["created_at"] as string),
    updatedAt: new Date(row["updated_at"] as string),
  };
}
// ---------------------------------------------------------------------------
// Schema-per-Tenant Generation
// ---------------------------------------------------------------------------

export async function createTenantSchema(tenantId: string): Promise<void> {
  // Use double quotes for schema to handle UUIDs safely
  const schemaName = `t_${tenantId.replace(/-/g, '_')}`;
  
  await getPool().query(`
    CREATE SCHEMA IF NOT EXISTS "${schemaName}";

    CREATE TABLE IF NOT EXISTS "${schemaName}".contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      telegram_id TEXT UNIQUE,
      whatsapp_id TEXT UNIQUE,
      line_id TEXT UNIQUE,
      name TEXT,
      phone TEXT,
      email TEXT,
      score INTEGER DEFAULT 0,
      stage TEXT DEFAULT 'cold',
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id UUID REFERENCES "${schemaName}".contacts(id),
      channel TEXT NOT NULL,
      direction TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens_used INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".bot_states (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      state_key TEXT NOT NULL UNIQUE,
      state_value JSONB,
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "${schemaName}".appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id UUID REFERENCES "${schemaName}".contacts(id),
      title TEXT NOT NULL,
      status TEXT DEFAULT 'scheduled',
      scheduled_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log(`[db] Schema generated for tenant: ${tenantId}`);
}
export async function createTenant(data: {
  slug: string;
  name: string;
  email?: string;
  flavor: string;
  region: string;
  language: string;
  preferredChannel: string;
  botToken?: string;
  botUsername?: string;
  port?: number;
}): Promise<Tenant> {
  const containerName = `tiger-claw-${data.slug}`;
  const result = await getPool().query(
    `INSERT INTO tenants
       (slug, name, email, flavor, region, language, preferred_channel, bot_token, bot_username, port, container_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [data.slug, data.name, data.email ?? null, data.flavor, data.region,
    data.language, data.preferredChannel, data.botToken ?? null, data.botUsername ?? null, data.port, containerName]
  );
  
  const tenant = result.rows[0];
  await createTenantSchema(tenant.id);
  
  return rowToTenant(tenant);
}

export async function getTenant(id: string): Promise<Tenant | null> {
  const result = await getReadPool().query("SELECT * FROM tenants WHERE id = $1", [id]);
  return result.rows[0] ? rowToTenant(result.rows[0]) : null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const result = await getReadPool().query("SELECT * FROM tenants WHERE slug = $1", [slug]);
  return result.rows[0] ? rowToTenant(result.rows[0]) : null;
}

export async function getTenantByEmail(email: string): Promise<Tenant | null> {
  const result = await getReadPool().query(
    "SELECT * FROM tenants WHERE email = $1 ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  return result.rows[0] ? rowToTenant(result.rows[0]) : null;
}

export async function listTenants(status?: TenantStatus): Promise<Tenant[]> {
  const result = status
    ? await getReadPool().query("SELECT * FROM tenants WHERE status = $1 ORDER BY created_at DESC", [status])
    : await getReadPool().query("SELECT * FROM tenants ORDER BY created_at DESC");
  return result.rows.map(rowToTenant);
}

export async function updateTenantStatus(
  id: string,
  status: TenantStatus,
  extra?: { suspendedReason?: string; containerId?: string }
): Promise<void> {
  await getPool().query(
    `UPDATE tenants SET status=$1, updated_at=NOW(),
       suspended_at = CASE WHEN $1='suspended' THEN NOW() ELSE suspended_at END,
       suspended_reason = COALESCE($3, suspended_reason),
       container_id = COALESCE($4, container_id)
     WHERE id=$2`,
    [status, id, extra?.suspendedReason ?? null, extra?.containerId ?? null]
  );
}

export async function updateTenantActivity(id: string): Promise<void> {
  await getPool().query(
    "UPDATE tenants SET last_activity_at=NOW(), updated_at=NOW() WHERE id=$1",
    [id]
  );
}

export async function setCanaryGroup(id: string, inGroup: boolean): Promise<void> {
  await getPool().query(
    "UPDATE tenants SET canary_group=$1, updated_at=NOW() WHERE id=$2",
    [inGroup, id]
  );
}

export async function listCanaryTenants(): Promise<Tenant[]> {
  const result = await getPool().query(
    "SELECT * FROM tenants WHERE canary_group = TRUE ORDER BY created_at ASC"
  );
  return result.rows.map(rowToTenant);
}

export async function getNextAvailablePort(): Promise<number> {
  const result = await getPool().query(
    "SELECT COALESCE(MAX(port), 18800) + 1 AS next_port FROM tenants"
  );
  return result.rows[0]["next_port"] as number;
}

export async function logAdminEvent(
  eventOrAction: string | { action: string; tenantId?: string; details?: Record<string, unknown> },
  tenantId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  // Support both positional args and object form
  const action = typeof eventOrAction === "string" ? eventOrAction : eventOrAction.action;
  const tid = typeof eventOrAction === "string" ? tenantId : eventOrAction.tenantId;
  const det = typeof eventOrAction === "string" ? details : eventOrAction.details;
  await getPool().query(
    "INSERT INTO admin_events (action, tenant_id, details) VALUES ($1,$2,$3)",
    [action, tid ?? null, det ? JSON.stringify(det) : null]
  );
}

export interface AdminEvent {
  id: string;
  action: string;
  tenantId?: string;
  tenantName?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export async function getRecentAdminEvents(sinceHours = 24): Promise<AdminEvent[]> {
  const result = await getPool().query(
    `SELECT e.id, e.action, e.tenant_id, t.name AS tenant_name, e.details, e.created_at
     FROM admin_events e
     LEFT JOIN tenants t ON t.id = e.tenant_id
     WHERE e.created_at > NOW() - INTERVAL '1 hour' * $1
     ORDER BY e.created_at DESC
     LIMIT 200`,
    [sinceHours]
  );
  return result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    action: r.action as string,
    tenantId: r.tenant_id as string | undefined,
    tenantName: r.tenant_name as string | undefined,
    details: r.details as Record<string, unknown> | undefined,
    createdAt: (r.created_at as Date).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Hive pattern queries
// ---------------------------------------------------------------------------

export interface HivePattern {
  id: string;
  flavor: string;
  region: string;
  category: string;
  observation: string;
  dataPoints: number;
  confidence: number;
  anonymous: boolean;
  submittedAt: Date;
}

function rowToPattern(row: Record<string, unknown>): HivePattern {
  return {
    id: row["id"] as string,
    flavor: row["flavor"] as string,
    region: row["region"] as string,
    category: row["category"] as string,
    observation: row["observation"] as string,
    dataPoints: row["data_points"] as number,
    confidence: row["confidence"] as number,
    anonymous: row["anonymous"] as boolean,
    submittedAt: new Date(row["submitted_at"] as string),
  };
}

export async function queryHivePatterns(params: {
  flavor: string;
  region?: string;
  category?: string;
  limit?: number;
}): Promise<HivePattern[]> {
  const conditions: string[] = ["flavor = $1", "approved = TRUE"];
  const values: unknown[] = [params.flavor];
  let idx = 2;

  if (params.region) { conditions.push(`region = $${idx++}`); values.push(params.region); }
  if (params.category) { conditions.push(`category = $${idx++}`); values.push(params.category); }

  const limit = Math.min(params.limit ?? 10, 50);
  const result = await getPool().query(
    `SELECT * FROM hive_patterns WHERE ${conditions.join(" AND ")}
     ORDER BY confidence DESC, data_points DESC
     LIMIT $${idx}`,
    [...values, limit]
  );
  return result.rows.map(rowToPattern);
}

export async function insertHivePattern(data: {
  flavor: string;
  region: string;
  category: string;
  observation: string;
  dataPoints: number;
  confidence: number;
  tenantHash?: string;
}): Promise<HivePattern> {
  const result = await getPool().query(
    `INSERT INTO hive_patterns
       (flavor, region, category, observation, data_points, confidence, anonymous, tenant_hash)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)
     RETURNING *`,
    [data.flavor, data.region, data.category, data.observation,
    data.dataPoints, data.confidence, data.tenantHash ?? null]
  );
  return rowToPattern(result.rows[0]);
}

// ---------------------------------------------------------------------------
// Bot pool queries
// Tokens are stored encrypted (see api/src/services/pool.ts for encrypt/decrypt).
// The raw encrypted string is stored here; pool.ts handles all crypto.
// ---------------------------------------------------------------------------

export type BotPoolStatus = "available" | "assigned" | "retired";

export interface BotPoolEntry {
  id: string;
  botToken: string;        // encrypted at rest — decrypt via pool.decryptToken()
  botUsername: string;
  telegramBotId: string;
  status: BotPoolStatus;
  phoneAccount?: string;
  createdAt: Date;
  assignedAt?: Date;
  tenantId?: string;
}

function rowToBotPoolEntry(row: Record<string, unknown>): BotPoolEntry {
  return {
    id: row["id"] as string,
    botToken: row["bot_token"] as string,
    botUsername: row["bot_username"] as string,
    telegramBotId: row["telegram_bot_id"] as string,
    status: row["status"] as BotPoolStatus,
    phoneAccount: row["phone_account"] as string | undefined,
    createdAt: new Date(row["created_at"] as string),
    assignedAt: row["assigned_at"] ? new Date(row["assigned_at"] as string) : undefined,
    tenantId: row["tenant_id"] as string | undefined,
  };
}

export async function insertBotPoolEntry(data: {
  botToken: string;        // already encrypted by caller
  botUsername: string;
  telegramBotId: string;
  phoneAccount?: string;
}): Promise<BotPoolEntry> {
  const result = await getPool().query(
    `INSERT INTO bot_pool (bot_token, bot_username, telegram_bot_id, phone_account)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.botToken, data.botUsername, data.telegramBotId, data.phoneAccount ?? null]
  );
  return rowToBotPoolEntry(result.rows[0]);
}

export async function getNextAvailableBotEntry(): Promise<BotPoolEntry | null> {
  const result = await getPool().query(
    `SELECT * FROM bot_pool WHERE status = 'available' ORDER BY created_at ASC LIMIT 1`
  );
  return result.rows[0] ? rowToBotPoolEntry(result.rows[0]) : null;
}

export async function getBotPoolEntry(id: string): Promise<BotPoolEntry | null> {
  const result = await getPool().query("SELECT * FROM bot_pool WHERE id = $1", [id]);
  return result.rows[0] ? rowToBotPoolEntry(result.rows[0]) : null;
}

export async function getBotPoolEntryByUsername(username: string): Promise<BotPoolEntry | null> {
  const result = await getPool().query(
    "SELECT * FROM bot_pool WHERE bot_username = $1",
    [username.replace(/^@/, "")]
  );
  return result.rows[0] ? rowToBotPoolEntry(result.rows[0]) : null;
}

export async function assignBotToTenant(botId: string, tenantId: string): Promise<void> {
  await getPool().query(
    `UPDATE bot_pool SET status='assigned', tenant_id=$1, assigned_at=NOW() WHERE id=$2`,
    [tenantId, botId]
  );
}

export async function releaseBotToPool(botId: string): Promise<void> {
  // Stamp released_at so assignBotToken can enforce the 30-minute cool-down.
  // A just-released bot's Telegram profile (name/description) may still be cached
  // by Telegram for several minutes after the identity reset calls complete.
  await getPool().query(
    `UPDATE bot_pool SET status='available', tenant_id=NULL, assigned_at=NULL, released_at=NOW() WHERE id=$1`,
    [botId]
  );
}

export async function retireBotFromPool(botId: string): Promise<void> {
  await getPool().query(
    "UPDATE bot_pool SET status='retired' WHERE id=$1",
    [botId]
  );
}

export async function getPoolCounts(): Promise<{ available: number; assigned: number; retired: number }> {
  const result = await getPool().query(`
    SELECT status, COUNT(*)::int AS cnt
    FROM bot_pool
    GROUP BY status
  `);
  const counts = { available: 0, assigned: 0, retired: 0 };
  for (const row of result.rows) {
    const s = row["status"] as string;
    if (s === "available" || s === "assigned" || s === "retired") {
      counts[s] = row["cnt"] as number;
    }
  }
  return counts;
}

export async function listBotPool(status?: BotPoolStatus): Promise<BotPoolEntry[]> {
  const result = status
    ? await getPool().query("SELECT * FROM bot_pool WHERE status=$1 ORDER BY created_at ASC", [status])
    : await getPool().query("SELECT * FROM bot_pool ORDER BY created_at ASC");
  return result.rows.map(rowToBotPoolEntry);
}

/**
 * Atomically assign the oldest available bot token to a tenant.
 * Uses SELECT FOR UPDATE SKIP LOCKED to prevent race conditions
 * under concurrent provisioning.
 */
export async function assignBotToken(
  tenantId: string,
): Promise<{ botToken: string; botUsername: string } | null> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await client.query(
        `SELECT * FROM bot_pool
         WHERE status = 'available'
           AND (released_at IS NULL OR released_at < NOW() - INTERVAL '30 minutes')
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const row = result.rows[0];
      await client.query(
        `UPDATE bot_pool SET status = 'assigned', tenant_id = $1, assigned_at = NOW()
         WHERE id = $2`,
        [tenantId, row["id"]],
      );
      await client.query("COMMIT");

      return {
        botToken: row["bot_token"] as string,
        botUsername: row["bot_username"] as string,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
}

/** Return the bot_token assigned to a tenant, or null. Supports BYOB. */
export async function getTenantBotToken(tenantId: string): Promise<string | null> {
  // 1. Check BYOB token on the tenant record first (v4 path)
  const tRes = await getReadPool().query(
    "SELECT bot_token FROM tenants WHERE id = $1",
    [tenantId]
  );
  if (tRes.rows[0]?.bot_token) {
    return tRes.rows[0].bot_token as string;
  }

  // 2. Fallback to legacy bot pool (migration path)
  const result = await getReadPool().query(
    "SELECT bot_token FROM bot_pool WHERE tenant_id = $1 AND status = 'assigned' LIMIT 1",
    [tenantId],
  );
  return result.rows[0] ? (result.rows[0]["bot_token"] as string) : null;
}

/** Return the bot username assigned to a tenant, or null. Supports BYOB. */
export async function getTenantBotUsername(tenantId: string): Promise<string | null> {
  // 1. Check BYOB username on the tenant record first (v4 path)
  const tRes = await getReadPool().query(
    "SELECT bot_username FROM tenants WHERE id = $1",
    [tenantId]
  );
  if (tRes.rows[0]?.bot_username) {
    return tRes.rows[0].bot_username as string;
  }

  // 2. Fallback to legacy bot pool (migration path)
  const result = await getReadPool().query(
    "SELECT bot_username FROM bot_pool WHERE tenant_id = $1 AND status = 'assigned' LIMIT 1",
    [tenantId],
  );
  return result.rows[0] ? (result.rows[0]["bot_username"] as string) : null;
}

/** Update a tenant's channel config (whatsapp, LINE fields). */
export async function updateTenantChannelConfig(
  id: string,
  config: {
    whatsappEnabled?: boolean;
    lineToken?: string | null;
    lineChannelSecret?: string | null;
    lineChannelAccessToken?: string | null;
  },
): Promise<void> {
  const sets: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [];
  let idx = 1;

  if (config.whatsappEnabled !== undefined) {
    sets.push(`whatsapp_enabled = $${idx++}`);
    values.push(config.whatsappEnabled);
  }
  if (config.lineToken !== undefined) {
    sets.push(`line_token = $${idx++}`);
    values.push(config.lineToken);
  }
  if (config.lineChannelSecret !== undefined) {
    sets.push(`line_channel_secret = $${idx++}`);
    values.push(config.lineChannelSecret);
  }
  if (config.lineChannelAccessToken !== undefined) {
    sets.push(`line_channel_access_token = $${idx++}`);
    values.push(config.lineChannelAccessToken);
  }

  values.push(id);
  await getPool().query(
    `UPDATE tenants SET ${sets.join(", ")} WHERE id = $${idx}`,
    values,
  );
}

/** Pool stats: total, assigned, unassigned counts. */
export async function getPoolStats(): Promise<{ total: number; assigned: number; unassigned: number }> {
  const result = await getPool().query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned,
      COUNT(*) FILTER (WHERE status = 'available')::int AS unassigned
    FROM bot_pool
    WHERE status != 'retired'
  `);
  const row = result.rows[0];
  return {
    total: (row["total"] as number) ?? 0,
    assigned: (row["assigned"] as number) ?? 0,
    unassigned: (row["unassigned"] as number) ?? 0,
  };
}

/** Simple insert into pool (no Telegram validation — use importToken for validated inserts). */
export async function addTokenToPool(botToken: string, botUsername: string): Promise<void> {
  await getPool().query(
    `INSERT INTO bot_pool (bot_token, bot_username, telegram_bot_id, status)
     VALUES ($1, $2, $2, 'available')`,
    [botToken, botUsername],
  );
}

// ---------------------------------------------------------------------------
// BYOK Architecture Queries (Tiger Claw V4.0)
// ---------------------------------------------------------------------------

export async function createBYOKUser(email: string, name?: string, stripeCustomerId?: string): Promise<string> {
  const result = await getPool().query(
    `INSERT INTO users (email, name, stripe_customer_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = $2, stripe_customer_id = COALESCE($3, users.stripe_customer_id)
     RETURNING id`,
    [email, name ?? null, stripeCustomerId ?? null]
  );
  return result.rows[0]["id"] as string;
}

export async function createBYOKBot(
  userId: string,
  name: string,
  niche: string,
  status: string = "pending",
  email?: string
): Promise<string> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) + '-' + Date.now().toString(36);
  const result = await getPool().query(
    `INSERT INTO tenants (user_id, name, slug, email, flavor, status, region, language, preferred_channel, container_name)
     VALUES ($1, $2, $3, $4, $5, $6, 'us-en', 'en', 'telegram', $7)
     RETURNING id`,
    [userId, name, slug, email ?? null, niche, status, `tiger_claw_${slug}`]
  );
  const tenantId = result.rows[0]["id"] as string;
  await createTenantSchema(tenantId);
  return tenantId;
}

/**
 * Returns an existing pending bot for this user+niche if one exists,
 * otherwise creates a new one. Prevents duplicate bot records when the
 * wizard's Step 2 is submitted more than once (e.g. user goes back).
 */
export async function findOrCreateBYOKBot(
  userId: string,
  name: string,
  niche: string
): Promise<string> {
  const existing = await getPool().query(
    `SELECT id FROM bots WHERE user_id = $1 AND niche = $2 AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [userId, niche]
  );
  if (existing.rows[0]) return existing.rows[0]["id"] as string;

  const result = await getPool().query(
    `INSERT INTO bots (user_id, name, niche, status) VALUES ($1, $2, $3, 'pending') RETURNING id`,
    [userId, name, niche]
  );
  const botId = result.rows[0]["id"] as string;
  await createTenantSchema(botId);
  return botId;
}

export async function createBYOKConfig(data: {
  botId: string;
  connectionType: string;
  provider?: string;
  model?: string;
  encryptedKey?: string;
  keyPreview?: string;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO bot_ai_config (bot_id, connection_type, provider, model, encrypted_key, key_preview)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.botId,
      data.connectionType,
      data.provider ?? null,
      data.model ?? null,
      data.encryptedKey ?? null,
      data.keyPreview ?? null
    ]
  );
}

export async function createBYOKSubscription(data: {
  userId: string;
  botId: string; // now representing tenant_id
  stripeSubscriptionId: string;
  planTier: string;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO subscriptions (user_id, tenant_id, stripe_subscription_id, plan_tier, status)
     VALUES ($1, $2, $3, $4, 'active')`,
    [data.userId, data.botId, data.stripeSubscriptionId, data.planTier]
  );
}

export async function getBotState<T>(tenantId: string, stateKey: string): Promise<T | null> {
  const schemaName = `t_${tenantId.replace(/-/g, '_')}`;
  try {
    const result = await getPool().query(
      `SELECT state_value FROM "${schemaName}".bot_states WHERE state_key = $1`,
      [stateKey]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].state_value as T;
  } catch (err: any) {
    // Fallback if schema doesn't exist yet for legacy rows
    return null;
  }
}

export async function setBotState(tenantId: string, stateKey: string, value: any): Promise<void> {
  const schemaName = `t_${tenantId.replace(/-/g, '_')}`;
  
  // Best effort: ensure schema exists before attempting to write state
  await createTenantSchema(tenantId);
  
  await getPool().query(
    `INSERT INTO "${schemaName}".bot_states (state_key, state_value, updated_at) 
     VALUES ($1, $2, NOW()) 
     ON CONFLICT (state_key) 
     DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = NOW()`,
    [stateKey, value]
  );
}

export async function upsertBYOKConfig(data: {
  botId: string; // technically tenant_id now
  connectionType: string;
  provider: string;
  model?: string;
  encryptedKey: string;
  keyPreview: string;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO bot_ai_config (tenant_id, connection_type, provider, model, encrypted_key, key_preview, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (tenant_id)
     DO UPDATE SET connection_type = EXCLUDED.connection_type,
                   provider = EXCLUDED.provider,
                   model = EXCLUDED.model,
                   encrypted_key = EXCLUDED.encrypted_key,
                   key_preview = EXCLUDED.key_preview,
                   updated_at = NOW()`,
    [
      data.botId,
      data.connectionType,
      data.provider,
      data.model ?? null,
      data.encryptedKey,
      data.keyPreview,
    ]
  );
}

export async function addAIKey(data: {
  botId: string; // technically tenant_id
  provider: string;
  model: string;
  encryptedKey: string;
  keyPreview: string;
  priority: number;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO bot_ai_keys (tenant_id, provider, model, encrypted_key, key_preview, priority)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [data.botId, data.provider, data.model, data.encryptedKey, data.keyPreview, data.priority]
  );
}

export async function importContacts(tenantId: string, contacts: { name: string; email?: string; phone?: string }[]): Promise<number> {
  if (contacts.length === 0) return 0;
  
  const schemaName = `t_${tenantId.replace(/-/g, '_')}`;
  let count = 0;
  for (const c of contacts) {
    try {
      await getPool().query(
        `INSERT INTO "${schemaName}".contacts (name, email, phone)
         VALUES ($1, $2, $3)`,
        [c.name, c.email ?? null, c.phone ?? null]
      );
      count++;
    } catch (err) {
      console.warn(`[db] Failed to import contact ${c.name}:`, err);
    }
  }
  return count;
}

export async function getBYOKStatus(tenantId: string) {
  try {
    // BUG FIX: Previous query joined bot_pool.id with bot_ai_config.bot_id which references bots.id —
    // different tables, different UUIDs. The join always produced zero rows.
    // Correct path: tenants.email → users.email → users.id → bots.user_id → bots.id → bot_ai_config.bot_id
    const result = await getPool().query(
      `SELECT c.provider, c.model, c.key_preview, c.connection_type, c.updated_at
       FROM bot_ai_config c
       JOIN bots b ON b.id = c.tenant_id
       JOIN users u ON u.id = b.user_id
       WHERE u.email = (SELECT email FROM tenants WHERE id = $1)
       ORDER BY c.updated_at DESC
       LIMIT 1`,
      [tenantId],
    );

    if (!result.rows[0]) {
      return { configured: false, provider: null, model: null, keyPreview: null, connectionType: null, updatedAt: null };
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      configured: true,
      provider: (row["provider"] as string) ?? null,
      model: (row["model"] as string) ?? null,
      keyPreview: (row["key_preview"] as string) ?? null,
      connectionType: (row["connection_type"] as string) ?? null,
      updatedAt: row["updated_at"] ? (row["updated_at"] as Date).toISOString() : null,
    };
  } catch (err) {
    console.error("[db] getBYOKStatus error:", err instanceof Error ? err.message : err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Hive Phase 1 Foundation Emitters
// ---------------------------------------------------------------------------

export async function insertHiveEvent(event: {
  tenantHash: string;
  vertical: string;
  region: string;
  eventType: 'objection' | 'conversion' | 'score' | 'scout_hit' | 'scout_profile' | 'unicorn_profile' | 'regulatory_violation' | 'tenant_metrics' | 'objection_encountered' | 'objection_resolved';
  payload: Record<string, unknown>;
}): Promise<void> {
  const pool = getWritePool();
  await pool.query(
    `INSERT INTO hive_events (tenant_hash, vertical, region, event_type, payload)
     VALUES ($1, $2, $3, $4, $5)`,
    [event.tenantHash, event.vertical, event.region, event.eventType, event.payload]
  );
}

export async function upsertHiveSignal(
  signalKey: string,
  vertical: string,
  region: string,
  signalType: string,
  payload: Record<string, unknown>,
  sampleSize: number
): Promise<void> {
  const pool = getWritePool();
  await pool.query(
    `INSERT INTO hive_signals (signal_key, vertical, region, signal_type, payload, sample_size, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (signal_key) DO UPDATE SET
       payload = EXCLUDED.payload,
       sample_size = EXCLUDED.sample_size,
       updated_at = now()`,
    [signalKey, vertical, region, signalType, payload, sampleSize]
  );
}

export async function getHiveSignal(signalKey: string): Promise<{
  payload: Record<string, unknown>;
  sampleSize: number;
  updatedAt: Date;
} | null> {
  const pool = getReadPool();
  const res = await pool.query(
    `SELECT payload, sample_size, updated_at FROM hive_signals WHERE signal_key = $1`,
    [signalKey]
  );
  if (!res.rows.length) return null;
  return {
    payload: (res.rows[0] as any).payload,
    sampleSize: (res.rows[0] as any).sample_size,
    updatedAt: (res.rows[0] as any).updated_at
  };
}

export async function getScoutCache(companyKey: string): Promise<Record<string, unknown> | null> {
  const pool = getReadPool();
  const res = await pool.query(`SELECT profile FROM hive_scout_cache WHERE company_key = $1`, [companyKey]);
  return res.rows.length ? ((res.rows[0] as any).profile as Record<string, unknown>) : null;
}

export async function upsertScoutCache(
  companyKey: string,
  profile: Record<string, unknown>
): Promise<void> {
  const pool = getWritePool();
  await pool.query(
    `INSERT INTO hive_scout_cache (company_key, profile, scout_count, first_scouted, last_updated)
     VALUES ($1, $2, 1, now(), now())
     ON CONFLICT (company_key) DO UPDATE SET
       profile = EXCLUDED.profile,
       scout_count = hive_scout_cache.scout_count + 1,
       last_updated = now()`,
    [companyKey, profile]
  );
}

export async function incrementHiveContribution(tenantId: string): Promise<void> {
  const pool = getWritePool();
  await pool.query(
    `UPDATE tenants SET hive_events_contributed = hive_events_contributed + 1 WHERE id = $1`,
    [tenantId]
  );
}

export async function incrementHiveReceived(tenantId: string): Promise<void> {
  const pool = getWritePool();
  await pool.query(
    `UPDATE tenants SET hive_signals_received = hive_signals_received + 1 WHERE id = $1`,
    [tenantId]
  );
}

// ---------------------------------------------------------------------------
// Hive Universal Prior & Founding Member
// ---------------------------------------------------------------------------

export async function getHiveSignalWithFallback(
  signalType: string,
  vertical: string,
  region: string
): Promise<{
  payload:          Record<string, unknown>;
  sampleSize:       number;
  updatedAt:        Date;
  isUniversalPrior: boolean;
  userLabel:        string;
  signalKey:        string;
} | null> {
  const pool = getReadPool();

  const candidates = [
    `${signalType}:${vertical}:${region}`,
    `${signalType}:${vertical}:universal`,
    `${signalType}:universal:${region}`,
    `${signalType}:universal:universal`,
  ];

  for (const key of candidates) {
    const result = await pool.query(
      `SELECT payload, sample_size, updated_at, signal_key
       FROM hive_signals WHERE signal_key = $1`,
      [key]
    );
    if (!result.rows.length) continue;

    const row = result.rows[0];
    const isUniversalPrior = key.includes(':universal');

    // Skip community signals below minimum threshold
    if (!isUniversalPrior && row.sample_size < 50) continue;

    // Skip placeholder signals (sample_size = 0)
    if (row.sample_size === 0) continue;

    const payload   = (row as Record<string, any>).payload as Record<string, unknown>;
    const userLabel = (payload['userLabel'] as string) ?? '';

    return {
      payload,
      sampleSize:       (row as Record<string, any>).sample_size,
      updatedAt:        (row as Record<string, any>).updated_at,
      isUniversalPrior,
      userLabel,
      signalKey:        (row as Record<string, any>).signal_key,
    };
  }
  return null;
}

export async function checkAndGrantFoundingMember(
  tenantId: string,
  vertical: string,
  region: string,
  foundingThreshold: number = 50
): Promise<{ isFoundingMember: boolean; rank: number }> {
  const client = await getWritePool().connect();
  try {
    await client.query('BEGIN');

    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM tenants
       WHERE vertical = $1 AND region = $2 AND id != $3
         AND status != 'terminated'`,
      [vertical, region, tenantId]
    );
    const existingCount = parseInt((countResult.rows[0] as Record<string, any>).count);
    const rank = existingCount + 1;

    if (rank <= foundingThreshold) {
      await client.query(
        `UPDATE tenants SET
           is_founding_member    = true,
           founding_member_since = now(),
           founding_vertical     = $1,
           founding_region       = $2,
           founding_member_rank  = $3
         WHERE id = $4`,
        [vertical, region, rank, tenantId]
      );
      await client.query(
        `INSERT INTO founding_member_events (tenant_id, event_type, payload)
         VALUES ($1, 'granted', $2)`,
        [tenantId, JSON.stringify({ rank, vertical, region, threshold: foundingThreshold })]
      );
      await client.query('COMMIT');
      return { isFoundingMember: true, rank };
    }

    await client.query('COMMIT');
    return { isFoundingMember: false, rank };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getFoundingMemberDisplay(tenantId: string): Promise<{
  isFounding:          boolean;
  rank:                number | null;
  since:               Date | null;
  vertical:            string | null;
  region:              string | null;
  contributed:         number;
  received:            number;
  contributionPct:     number | null;
  totalFoundersInVertical: number;
} | null> {
  const pool = getReadPool();
  const result = await pool.query(
    `SELECT
       t.is_founding_member,
       t.founding_member_rank,
       t.founding_member_since,
       t.founding_vertical,
       t.founding_region,
       t.hive_events_contributed,
       t.hive_signals_received,
       (
         SELECT COUNT(*) FROM tenants t2
         WHERE t2.vertical = t.vertical
           AND t2.region   = t.region
           AND t2.is_founding_member = true
       ) AS total_founders_in_vertical,
       (
         SELECT COUNT(*) FROM tenants t3
         WHERE t3.vertical = t.vertical
           AND t3.region   = t.region
           AND t3.is_founding_member = true
           AND t3.hive_events_contributed < t.hive_events_contributed
       )::float /
       NULLIF((
         SELECT COUNT(*) FROM tenants t4
         WHERE t4.vertical = t.vertical
           AND t4.region   = t.region
           AND t4.is_founding_member = true
       ), 0) AS contribution_percentile
     FROM tenants t WHERE t.id = $1`,
    [tenantId]
  );

  if (!result.rows.length) return null;
  const row = result.rows[0] as Record<string, any>;

  return {
    isFounding:              row.is_founding_member,
    rank:                    row.founding_member_rank,
    since:                   row.founding_member_since,
    vertical:                row.founding_vertical,
    region:                  row.founding_region,
    contributed:             row.hive_events_contributed || 0,
    received:                row.hive_signals_received || 0,
    contributionPct:         row.contribution_percentile
                               ? Math.round(row.contribution_percentile * 100)
                               : null,
    totalFoundersInVertical: parseInt(row.total_founders_in_vertical || '0'),
  };
}

export async function getLeadScoutProfile(
  tenantId: string,
  contactId: string,
  storage?: any
): Promise<{ intentPatternTypes: string[], source: string | null, profileFitScore: number | null }> {
  try {
    const pool = getReadPool();
    const result = await pool.query(
      `SELECT raw_data FROM tenant_leads WHERE tenant_id = $1 AND id = $2`,
      [tenantId, contactId]
    );
    if (!result.rows.length) {
      return { intentPatternTypes: [], source: null, profileFitScore: null };
    }
    const lead = result.rows[0].raw_data as any;
    
    const intentPatternsFired = Array.isArray(lead.intentPatternsFired) ? lead.intentPatternsFired : [];
    const intentPatternTypes = intentPatternsFired.map((p: any) => p.type).filter(Boolean);
    const source = typeof lead.source === 'string' ? lead.source : null;
    const profileFitScore = typeof lead.profileFitScore === 'number' ? lead.profileFitScore : null;

    return { intentPatternTypes, source, profileFitScore };
  } catch (err) {
    console.error(`[db] getLeadScoutProfile error:`, err);
    return { intentPatternTypes: [], source: null, profileFitScore: null };
  }
}

