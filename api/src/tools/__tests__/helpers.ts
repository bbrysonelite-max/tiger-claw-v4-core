/**
 * Shared test helpers for tiger tool tests.
 *
 * Every tool accepts a ToolContext and returns a ToolResult:
 *   { ok: boolean, output?: string, error?: string, data?: unknown }
 *
 * makeContext() builds a minimal in-memory context so tools can be tested
 * without any database or filesystem access.
 */
import { vi } from 'vitest'

export type Storage = Map<string, unknown>

export function makeContext(storage: Storage = new Map(), overrides: Record<string, unknown> = {}) {
  const ac = new AbortController();
  return {
    sessionKey: 'test-session',
    agentId: 'test-agent',
    workdir: '/tmp/test-workdir',
    config: {
      TIGER_CLAW_TENANT_ID: 'test-tenant',
      TIGER_CLAW_TENANT_SLUG: 'test-slug',
      BOT_FLAVOR: 'default',
      REGION: 'us-en',
      PREFERRED_LANGUAGE: 'en',
      TIGER_CLAW_API_URL: 'http://localhost:4000',
      ...(overrides.config as Record<string, string> || {}),
    },
    abortSignal: ac.signal,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    storage: {
      get: vi.fn(async (key: string) => storage.get(key) ?? null),
      set: vi.fn(async (key: string, value: unknown) => { storage.set(key, value) }),
    },
    ...overrides,
  } as any // Cast to any internally to soothe generic overrides without importing ToolContext explicitly here
}

export type ToolResult = {
  ok: boolean
  output?: string
  error?: string
  data?: unknown
}
