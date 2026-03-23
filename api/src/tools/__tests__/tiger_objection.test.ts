import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tiger_objection } from '../tiger_objection.js'
import { makeContext, type ToolResult } from './helpers.js'

vi.mock('../../services/tenant_data.js', () => ({
  getTenantState: vi.fn(async () => ({ entries: [] })),
  saveTenantState: vi.fn(),
}))

vi.mock('../../services/db.js', () => ({
  getBotState: vi.fn(async () => ({ phase: 'complete', flavor: 'network-marketer', identity: {} })),
  getHiveSignalWithFallback: vi.fn(async () => null),
}))

vi.mock('../../services/hiveEmitter.js', () => ({
  emitHiveEvent: vi.fn(),
  hiveAttributionLabel: vi.fn(),
}))

describe.skip('tiger_objection', () => {
  it('classifies an objection and returns a suggested response', async () => {
    const ctx = makeContext();
    const result: ToolResult = await tiger_objection.execute({
      action: 'classify',
      prospectText: 'This looks like a pyramid scheme to me',
    }, ctx)

    expect(result.ok).toBe(true)
    // Pyramid words map to the 'reputation' bucket in network-marketer flavor
    expect(result.data).toMatchObject({ bucket: 'reputation' })
  })

  it('handles empty prospect text gracefully', async () => {
    const ctx = makeContext();
    const result = await tiger_objection.execute({ action: 'classify', prospectText: '' }, ctx)

    expect(result.ok).toBe(false)
  })

  it('delivers pattern interrupt stories', async () => {
    const ctx = makeContext();
    const result = await tiger_objection.execute({ action: 'pattern_interrupt', moment: 'stall' }, ctx)

    expect(result.ok).toBe(true)
    expect(result.output).toBeTruthy()
  })

  it('rejects unknown actions', async () => {
    const ctx = makeContext();
    const result = await tiger_objection.execute({ action: 'unknown' as any }, ctx)

    expect(result.ok).toBe(false)
  })
})
