import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tiger_settings } from '../tiger_settings.js'
import { makeContext, type ToolResult } from './helpers.js'

let mockTenantState: Record<string, any> = {}

vi.mock('../../services/tenant_data.js', () => ({
  getTenantState: vi.fn(async (_tid: string, file: string) => mockTenantState[file] ?? null),
  saveTenantState: vi.fn(async (_tid: string, file: string, data: unknown) => {
    mockTenantState[file] = data
  }),
}))

describe('tiger_settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTenantState = {}
  })

  it('returns current settings when action is get', async () => {
    const ctx = makeContext()
    const result: ToolResult = await tiger_settings.execute({ action: 'get' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('manualApproval')
  })

  it('updates manualApproval with set action', async () => {
    const ctx = makeContext()
    const result = await tiger_settings.execute({ action: 'set', key: 'manualApproval', value: true }, ctx)

    expect(result.ok).toBe(true)
    const saved = mockTenantState['settings.json']
    expect(saved.manualApproval).toBe(true)
  })

  it('updates language setting', async () => {
    const ctx = makeContext()
    const result = await tiger_settings.execute({ action: 'set', key: 'language', value: 'es' }, ctx)

    expect(result.ok).toBe(true)
    const saved = mockTenantState['settings.json']
    expect(saved.language).toBe('es')
  })

  it('reports the updated value in output after set', async () => {
    const ctx = makeContext()
    const result = await tiger_settings.execute({ action: 'set', key: 'timezone', value: 'America/New_York' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('America/New_York')
  })

  it('returns ok:false when setting an unknown key', async () => {
    const ctx = makeContext()
    const result = await tiger_settings.execute({ action: 'set', key: 'nonExistentSetting', value: 'x' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns ok:false when value type does not match setting type', async () => {
    const ctx = makeContext()
    // manualApproval expects boolean; 'not-a-bool' cannot be coerced
    const result = await tiger_settings.execute({ action: 'set', key: 'manualApproval', value: 'not-a-bool' }, ctx)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('toggles scoutEnabled to false and persists', async () => {
    const ctx = makeContext()
    await tiger_settings.execute({ action: 'set', key: 'scoutEnabled', value: false }, ctx)

    const saved = mockTenantState['settings.json']
    expect(saved.scoutEnabled).toBe(false)
  })

  it('reset action restores all settings to defaults', async () => {
    mockTenantState['settings.json'] = {
      manualApproval: true,
      hiveOptIn: true,
      language: 'th',
      updatedFields: ['manualApproval', 'hiveOptIn'],
      lastUpdatedAt: new Date().toISOString(),
    }
    const ctx = makeContext()
    const result = await tiger_settings.execute({ action: 'reset' }, ctx)

    expect(result.ok).toBe(true)
    const saved = mockTenantState['settings.json']
    expect(saved.manualApproval).toBe(false) // default
  })

  it('initializes settings with defaults when storage is empty', async () => {
    const ctx = makeContext()
    const result = await tiger_settings.execute({ action: 'get' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
  })

  it('returns ok:false for unknown action', async () => {
    const ctx = makeContext()
    const result = await tiger_settings.execute({ action: 'warp' }, ctx)

    expect(result.ok).toBe(false)
  })
})
