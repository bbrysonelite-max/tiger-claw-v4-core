export interface TenantConfig {
  [key: string]: string | undefined;
  TIGER_CLAW_TENANT_ID: string;
  TIGER_CLAW_TENANT_SLUG: string;
  BOT_FLAVOR: string;
  REGION: string;
  PREFERRED_LANGUAGE: string;
  TIGER_CLAW_API_URL: string;
}

export interface ToolStorage {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any): Promise<void>;
}

export interface ToolContext {
  sessionKey: string;
  agentId: string;
  workdir: string;
  config: TenantConfig;
  abortSignal: AbortSignal;
  logger: {
    debug(msg: string, ...args: unknown[]): void;
    info(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
  };
  storage: ToolStorage;
}

export interface ToolResult {
  ok: boolean;
  output?: string;
  error?: string;
  data?: unknown;
  file?: {
    filename: string;
    content: string;
    mimeType: string;
    encoding: string;
  };
}
