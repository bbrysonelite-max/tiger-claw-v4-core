import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_onboard } from '../tiger_onboard.js'
import { makeContext, type ToolResult } from './helpers.js'

// Mutable state store — controls getBotState return value per test
let mockBotStates: Record<string, any> = {}

vi.mock('../../services/db.js', () => ({
  getBotState: vi.fn(async (_tenantId: string, file: string) => mockBotStates[file] ?? null),
  setBotState: vi.fn(async (_tenantId: string, file: string, data: unknown) => {
    mockBotStates[file] = data
  }),
  getPool: vi.fn(() => ({ query: vi.fn().mockResolvedValue({ rows: [] }) })),
  getHiveSignalWithFallback: vi.fn().mockRejectedValue(new Error('no db')),
}))

vi.mock('../../services/pool.js', () => ({
  encryptToken: vi.fn((t: string) => `enc:${t}`),
  decryptToken: vi.fn((t: string) => t.replace('enc:', '')),
}))

vi.mock('../../config/index.js', () => ({
  resolveConfig: vi.fn(async () => ({ BOT_FLAVOR: 'network-marketer', REGION: 'us-en' })),
  generateSoulMd: vi.fn(async () => '# Soul'),
}))

describe('tiger_onboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBotStates = {}
  })

  it('status with no state returns ok:true and not-started message', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_onboard.execute({ action: 'status' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('not started')
    expect((result.data as any)?.phase).toBeNull()
  })

  it('start with no existing state creates session and returns ok:true', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_onboard.execute({ action: 'start' }, ctx)

    expect(result.ok).toBe(true)
    // State was saved
    expect(mockBotStates['onboard_state.json']).toBeTruthy()
    expect(mockBotStates['onboard_state.json'].phase).toBe('identity')
  })

  it('status after start returns current phase', async () => {
    const ctx = makeContext()
    mockBotStates['onboard_state.json'] = {
      phase: 'identity',
      questionIndex: 0,
      identity: {},
      icpBuilder: {},
      icpCustomer: {},
      icpSingle: {},
      primaryKeyValidated: false,
      fallbackKeyValidated: false,
      flavor: 'network-marketer',
      language: 'en',
      tenantId: 'test-tenant',
      startedAt: new Date().toISOString(),
    }

    const result: ToolResult = await tiger_onboard.execute({ action: 'status' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('Identity')
    expect((result.data as any)?.phase).toBe('identity')
  })

  it('returns ok:false when called with non-start action and no state exists', async () => {
    const ctx = makeContext()
    const result = await tiger_onboard.execute({ action: 'save' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("action: 'start'")
  })

  it('already complete state returns ok:true with completion message', async () => {
    const ctx = makeContext()
    mockBotStates['onboard_state.json'] = {
      phase: 'complete',
      questionIndex: 0,
      identity: { name: 'Brent' },
      icpBuilder: {},
      icpCustomer: {},
      icpSingle: {},
      primaryKeyValidated: true,
      fallbackKeyValidated: true,
      flavor: 'network-marketer',
      language: 'en',
      tenantId: 'test-tenant',
      botName: 'Scout',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }

    const result = await tiger_onboard.execute({ action: 'identity' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('already complete')
  })
})
